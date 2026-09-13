import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

// Gunakan require untuk menyokong modul CommonJS pdf-parse di Turbopack
const pdfParse = require('pdf-parse');

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

// Fungsi memecahkan teks kepada cebisan (Chunking)
function splitTextIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let index = 0;

  while (index < cleanedText.length) {
    const chunk = cleanedText.slice(index, index + chunkSize);
    chunks.push(chunk);
    index += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;

    if (!file || !subjectId) {
      return NextResponse.json({ success: false, error: 'Fail PDF dan ID Subjek diperlukan.' }, { status: 400 });
    }

    // 1. Baca kandungan fail PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Pengendalian fungsi parser yang selamat dari isu import ESM/CJS
    const parsePdf = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
    const pdfData = await parsePdf(buffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Gagal mengekstrak teks daripada fail PDF ini.' }, { status: 400 });
    }

    // 2. Simpan rekod dokumen utama ke jadual 'documents'
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert([
        {
          subject_id: subjectId,
          filename: file.name,
          file_size: file.size,
        }
      ])
      .select()
      .single();

    if (docError) throw docError;

    // 3. Pecahkan teks kepada Chunks
    const textChunks = splitTextIntoChunks(extractedText);

    // 4. Jana Vector Embeddings menggunakan Gemini & Simpan ke 'document_chunks'
    const chunkRecords = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];

      let embeddingVector = null;
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: chunkText,
        });
        embeddingVector = embedResponse.embedding?.values || null;
      } catch (err) {
        console.warn(`Amaran: Gagal jana embedding untuk chunk ${i}:`, err);
      }

      chunkRecords.push({
        document_id: docRecord.id,
        content: chunkText,
        chunk_index: i,
        embedding: embeddingVector
      });
    }

    // Simpan kesemua chunks ke Supabase
    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (chunkError) throw chunkError;

    return NextResponse.json({
      success: true,
      message: `Dokumen '${file.name}' berjaya diproses! (${textChunks.length} cebisan teks disimpan).`,
      documentId: docRecord.id
    });

  } catch (error: any) {
    console.error('Ralat Upload Document:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal memproses dokumen.' }, { status: 500 });
  }
}

// GET: Ambil senarai dokumen mengikut Subjek
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    let query = supabase.from('documents').select('*, subjects(name, course_code)').order('created_at', { ascending: false });
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}