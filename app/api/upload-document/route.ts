import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

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
    const pdfParse = require('pdf-parse');

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;

    if (!file || !subjectId) {
      return NextResponse.json({ success: false, error: 'Fail PDF dan ID Subjek diperlukan.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const parsePdf = typeof pdfParse === 'function' ? pdfParse : (pdfParse.default || pdfParse);
    const pdfData = await parsePdf(buffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Gagal mengekstrak teks daripada fail PDF ini.' }, { status: 400 });
    }

    // Rekod dokumen utama ke Supabase
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

    if (docError) {
      console.error('Ralat simpan dokumen Supabase:', docError);
      throw new Error(`Ralat pangkalan data: ${docError.message}`);
    }

    const textChunks = splitTextIntoChunks(extractedText);
    const chunkRecords = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];

      let embeddingVector = null;
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: chunkText,
        });

        embeddingVector =
          embedResponse.embeddings?.[0]?.values ||
          (embedResponse as any)?.embedding?.values ||
          (embedResponse as any)?.values ||
          null;
      } catch (err) {
        console.warn(`Amaran: Gagal jana embedding untuk chunk ${i} (menggunakan fallback teks biasa):`, err);
      }

      chunkRecords.push({
        document_id: docRecord.id,
        content: chunkText,
        chunk_index: i,
        embedding: embeddingVector
      });
    }

    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (chunkError) {
      console.error('Ralat simpan chunks Supabase:', chunkError);
      throw new Error(`Ralat menyimpan cebisan teks: ${chunkError.message}`);
    }

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');

    let query = supabase.from('documents').select('*, subjects(name, course_code)').order('created_at', { ascending: false });
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}