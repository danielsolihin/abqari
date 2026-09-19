import "pdf-parse/worker"; 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

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

// -------------------------------------------------------------
// FUNGSI PEMBERSIH ULTRA-AGRESIF (KHAS UNTUK PDF BERGAMBAR)
// -------------------------------------------------------------
function sanitizeForDb(text: string): string {
  if (!text) return '';
  
  let clean = text;
  
  // 1. Buang unicode rosak/tergantung (Lone Surrogates) yang merosakkan JSON DB
  if (typeof clean.toWellFormed === 'function') {
     clean = clean.toWellFormed();
  } else {
     clean = clean.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
  }

  // 2. Musnahkan semua Null Bytes
  clean = clean.replace(/\0/g, '').replace(/\u0000/g, '').replace(/\\u0000/g, '');

  // 3. Buang Control Characters dari imbasan gambar, TAPI biarkan newline (\n) dan tab (\t) untuk Koding!
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

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: `Fail "${file.name}" telah wujud untuk subjek ini. Sila padam fail lama.` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const rawModule = eval('require')('pdf-parse');
    const parseFunc = typeof rawModule === 'function' ? rawModule : (rawModule.PDFParse || rawModule.default);

    let resultInstance;
    try {
      resultInstance = await parseFunc(uint8Array);
    } catch (parseError: any) {
      if (parseError.message && parseError.message.includes("without 'new'")) {
        resultInstance = new (parseFunc as any)(uint8Array);
      } else {
        throw parseError;
      }
    }
    if (resultInstance && typeof resultInstance.then === 'function') resultInstance = await resultInstance;

    let extractedText = '';
    if (resultInstance && typeof resultInstance.getText === 'function') {
      const parsed = await resultInstance.getText();
      extractedText = parsed.text;
      if (typeof resultInstance.destroy === 'function') await resultInstance.destroy();
    } else if (resultInstance && resultInstance.text) {
      extractedText = resultInstance.text;
    }

    if (!extractedText || !extractedText.trim()) {
      return NextResponse.json({ error: 'Teks kosong atau PDF berbentuk imbasan penuh.' }, { status: 400 });
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ subject_id: subjectId, file_url: file.name, file_name: file.name, user_id: userId }])
      .select()
      .single();

    if (docError) throw new Error(`Gagal menyimpan dokumen: ${docError.message}`);
    const documentId = docData.id;

    // Bersihkan seluruh teks sebelum masuk loop!
    const cleanExtractedText = sanitizeForDb(extractedText);
    const chunks = chunkText(cleanExtractedText);

    for (let i = 0; i < chunks.length; i++) {
      const safeChunk = sanitizeForDb(chunks[i]);
      
      // ==========================================
      // PENYELAMAT NYAWA: ABAIKAN PERENGGAN KOSONG
      // ==========================================
      if (!safeChunk || safeChunk.length === 0) {
        console.warn(`Perenggan ke-${i + 1} hanya mengandungi sisa gambar. Diabaikan.`);
        continue; 
      }

      let embedding = null;
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: safeChunk,
          config: { outputDimensionality: 768 },
        });

        const rawVector = embedResponse.embeddings?.[0]?.values || (embedResponse as any)?.embedding?.values || (embedResponse as any)?.values;
        
        // PENGESAHAN VEKTOR KETAT: Jika ada elemen rosak, buang supaya DB tak error
        if (Array.isArray(rawVector) && rawVector.length > 0) {
           const isValid = rawVector.every(v => typeof v === 'number' && !isNaN(v));
           if (isValid) {
             embedding = rawVector;
           }
        }
      } catch (embedErr) {
        console.warn(`Amaran Google AI pada perenggan ke-${i + 1}:`, embedErr);
      }

      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert([{ document_id: documentId, content: safeChunk, embedding: embedding }]);

      if (chunkError) throw new Error(`Gagal menyimpan perenggan ke-${i + 1}: ${chunkError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Fail PDF (bersama gambar/kod) berjaya dibersihkan dan disimpan.',
      documentId,
    });
  } catch (error: any) {
    console.error('Ralat Muat Naik PDF:', error);
    return NextResponse.json({ error: error.message || 'Ralat pelayan semasa memproses PDF.' }, { status: 500 });
  }
}