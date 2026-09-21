import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFParser from "pdf2json";
import { Buffer } from 'buffer'; // WAJIB: Mencegah ralat kehilangan Buffer di Vercel

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // WAJIB: Mengelak ralat keliru cache Next.js
export const maxDuration = 60; 

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// GANTI KEPADA OPENAI EMBEDDING (PENGHANTARAN PUKAL / BATCHING)
// ============================================================
async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY tidak dijumpai.");

  const results: number[][] = [];
  const batchSize = 20; // Hantar 20 perenggan serentak untuk kelajuan kilat

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small", 
        input: batch, 
        dimensions: 768, 
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Error: ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    // Susun semula vektor mengikut urutan asal perenggan
    const sortedEmbeddings = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding);
      
    results.push(...sortedEmbeddings);
  }
  
  return results;
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
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || 'public-user';

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;

    if (!file) return NextResponse.json({ error: 'Fail PDF diperlukan.' }, { status: 400 });
    if (!subjectId) return NextResponse.json({ error: 'ID Subjek diperlukan.' }, { status: 400 });

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawText = await extractPdfText(buffer);

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'Teks kosong atau PDF berbentuk imbasan gambar.' }, { status: 400 });
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ subject_id: subjectId, file_url: file.name, file_name: file.name, user_id: userId }])
      .select('id')
      .single();

    if (docError || !docData) throw new Error(`Gagal menyimpan rekod dokumen.`);
    createdDocumentId = docData.id;

    const cleanExtractedText = sanitizeForDb(rawText);
    const chunks = chunkText(cleanExtractedText);
    
    // Tapis dan asingkan perenggan yang sah sahaja
    const validChunks = chunks.map(c => sanitizeForDb(c)).filter(c => c.length > 0);

    // Proses Pukal (Batched) OpenAI Embeddings
    if (validChunks.length > 0) {
      const embeddings = await getEmbeddingsBatch(validChunks);

      const chunkRows = validChunks.map((chunk, index) => ({
        document_id: createdDocumentId,
        content: chunk,
        embedding: embeddings[index]
      }));

      const { error: chunkError } = await supabase.from('document_chunks').insert(chunkRows);
      if (chunkError) throw new Error(`Gagal menyimpan data vektor: ${chunkError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Enjin RAG (OpenAI): Fail "${file.name}" disahkan dan diekstrak menjadi ${validChunks.length} memori AI.`,
      documentId: createdDocumentId,
    });

  } catch (error: any) {
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