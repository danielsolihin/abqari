import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai'; // Berdasarkan kod asal Prof

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// Tambah 'placeholder' supaya build tidak ralat jika kunci tiada di lokal
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'placeholder' });

export async function POST(req: NextRequest) {
  try {
    // pdf-parse selamat dipanggil di dalam fungsi ini
    const pdfParse = require('pdf-parse');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const subjectId = formData.get('subjectId') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Fail dokumen tidak ditemui.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pdfText = '';
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const parsedData = await pdfParse(buffer);
      pdfText = parsedData.text || '';
    } else {
      pdfText = buffer.toString('utf-8');
    }

    const sanitizedFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents')
      .upload(sanitizedFileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) console.warn('Amaran Supabase Storage:', storageError.message);
    const filePath = storageData?.path || sanitizedFileName;

    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          title: file.name,
          file_path: filePath,
          content: pdfText,
          subject_id: subjectId || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (dbError) console.warn('Amaran Simpan Pangkalan Data:', dbError.message);

    return NextResponse.json({
      success: true,
      message: 'Dokumen berjaya diproses.',
      data: dbData || { title: file.name, filePath },
      extractedTextLength: pdfText.length,
    });
  } catch (error: any) {
    console.error('Ralat Upload Document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses dokumen.' },
      { status: 500 }
    );
  }
}