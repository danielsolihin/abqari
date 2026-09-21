import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFParser from "pdf2json";
import { pipeline } from "@xenova/transformers";

export const runtime = 'nodejs';
// Disesuaikan kepada 60 saat mengikut had maksimum Vercel Hobby Tier
export const maxDuration = 60; 

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// SINGLETON LOCAL EMBEDDING (Xenova/bge-base-en-v1.5)
// ============================================================
class PipelineSingleton {
  static task = "feature-extraction" as const;
  static model = "Xenova/bge-base-en-v1.5"; // 768 Dimensi
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

async function getLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await PipelineSingleton.getInstance();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ============================================================
// CHUNKING & SANITIZER
// ============================================================
function chunkText(text: string, chunkSize = 800, chunkOverlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - chunkOverlap;
  }
  return chunks;
}

// Fungsi Pembersih Ultra-Agresif
function sanitizeForDb(text: string): string {
  if (!text) return '';
  let clean = text;
  
  if (typeof (clean as any).toWellFormed === 'function') {
     clean = (clean as any).toWellFormed();
  } else {
     clean = clean.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
  }
  clean = clean.replace(/\0/g, '').replace(/\u0000/g, '').replace(/\\u0000/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
  return clean.trim();
}

async function getAuthenticatedUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    
    const token = authHeader.split(' ')[1];
    const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
}

// ============================================================
// EXTRACT PDF TEXT (PDF2JSON - Sangat stabil)
// ============================================================
async function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData?.parserError)));
    pdfParser.on("pdfParser_dataReady", () => {
      let rawText = pdfParser.getRawTextContent();
      try { rawText = decodeURIComponent(rawText); } catch {}
      resolve(rawText || "");
    });
    pdfParser.parseBuffer(buffer);
  });
}

// ============================================================
// MAIN POST (API UPLOAD)
// ============================================================
export async function POST(req: NextRequest) {
  let createdDocumentId: string | null = null;
  
  try {
    // 1. Kenal Pasti Pengguna
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || 'public-user';

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;

    if (!file) return NextResponse.json({ error: 'Fail PDF diperlukan.' }, { status: 400 });
    if (!subjectId) return NextResponse.json({ error: 'ID Subjek diperlukan.' }, { status: 400 });

    // 2. Semak Pendua
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('file_name', file.name)
      .maybeSingle();

    if (checkError) throw new Error(`Ralat menyemak data pendua: ${checkError.message}`);
    if (existingDoc) {
      return NextResponse.json({ error: `Fail "${file.name}" telah wujud untuk subjek ini. Sila padam fail lama jika mahu ganti.` }, { status: 400 });
    }

    // 3. Ekstrak Teks Menggunakan PDF2JSON (Stabil)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawText = await extractPdfText(buffer);

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'Teks kosong atau PDF berbentuk imbasan gambar.' }, { status: 400 });
    }

    // 4. Simpan Dokumen Utama
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ subject_id: subjectId, file_url: file.name, file_name: file.name, user_id: userId }])
      .select('id')
      .single();

    if (docError || !docData) throw new Error(`Gagal menyimpan rekod dokumen.`);
    createdDocumentId = docData.id;

    // 5. Bersihkan, Pecahkan (Chunk), dan Jana Vektor (Transformers.js)
    const cleanExtractedText = sanitizeForDb(rawText);
    const chunks = chunkText(cleanExtractedText);
    const chunkRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const safeChunk = sanitizeForDb(chunks[i]);
      
      if (!safeChunk || safeChunk.length === 0) continue; 

      // Dapatkan Vektor Tempatan (768 Dimensi)
      const embedding = await getLocalEmbedding(safeChunk);
      
      chunkRows.push({
        document_id: createdDocumentId,
        content: safeChunk,
        embedding: embedding
      });
    }

    // Simpan semua vektor chunks secara pukal (Bulk Insert) untuk kelajuan maksima
    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabase.from('document_chunks').insert(chunkRows);
      if (chunkError) throw new Error(`Gagal menyimpan data vektor: ${chunkError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Enjin RAG: Fail "${file.name}" disahkan dan diekstrak menjadi ${chunkRows.length} memori AI.`,
      documentId: createdDocumentId,
    });

  } catch (error: any) {
    // Jika ralat, padam semula dokumen (Rollback) secara selamat dan patuh TypeScript
    if (createdDocumentId) {
      try {
        await supabase.from("document_chunks").delete().eq("document_id", createdDocumentId);
        await supabase.from("documents").delete().eq("id", createdDocumentId);
      } catch (rollbackError) {
        console.error('Ralat semasa rollback dokumen:', rollbackError);
      }
    }
    console.error('Ralat API Upload Utama:', error);
    return NextResponse.json({ error: error.message || 'Ralat pelayan semasa memproses PDF.' }, { status: 500 });
  }
}