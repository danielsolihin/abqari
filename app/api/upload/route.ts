import "pdf-parse/worker"; // Membaiki ralat DOMMatrix is not defined
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Melayan pemprosesan fail serverless di Vercel

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;

    if (!file) return NextResponse.json({ error: 'Fail PDF diperlukan.' }, { status: 400 });
    if (!subjectId) return NextResponse.json({ error: 'ID Subjek diperlukan.' }, { status: 400 });

    // ==========================================
    // FUNGSI SEMAKAN FAIL PENDUA
    // ==========================================
    const { data: existingDoc, error: checkError } = await supabase
      .from('documents')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('file_name', file.name)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Ralat menyemak data pendua: ${checkError.message}`);
    }

    if (existingDoc) {
      return NextResponse.json({ 
        error: `Fail "${file.name}" telah wujud untuk subjek ini. Sila padam fail lama jika anda ingin mengemas kini.` 
      }, { status: 400 });
    }
    // ==========================================

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

    if (resultInstance && typeof resultInstance.then === 'function') {
      resultInstance = await resultInstance;
    }

    let extractedText = '';

    if (resultInstance && typeof resultInstance.getText === 'function') {
      const parsed = await resultInstance.getText();
      extractedText = parsed.text;
      
      if (typeof resultInstance.destroy === 'function') {
        await resultInstance.destroy();
      }
    } else if (resultInstance && resultInstance.text) {
      extractedText = resultInstance.text;
    }

    if (!extractedText || !extractedText.trim()) {
      return NextResponse.json({ 
        error: 'Teks kosong! Sila pastikan PDF ini bukan gambar/imbasan semata-mata.' 
      }, { status: 400 });
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ 
        subject_id: subjectId,
        file_url: file.name,
        file_name: file.name
      }])
      .select()
      .single();

    if (docError) throw new Error(`Gagal menyimpan dokumen: ${docError.message}`);
    const documentId = docData.id;

    const chunks = chunkText(extractedText);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // DITUKAR: Gunakan model text-embedding-004 yang disokong oleh v1beta
      const embedResponse = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: chunk,
      });

      const embedding =
        embedResponse.embeddings?.[0]?.values ||
        (embedResponse as any)?.embedding?.values ||
        (embedResponse as any)?.values;

      if (!embedding) throw new Error(`Gagal menjana vektor untuk perenggan ke-${i + 1}`);

      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert([{ document_id: documentId, content: chunk, embedding: embedding }]);

      if (chunkError) throw new Error(`Gagal menyimpan perenggan ke-${i + 1}: ${chunkError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Fail PDF berjaya diproses dan disimpan.',
      documentId,
    });
  } catch (error: any) {
    console.error('Ralat Muat Naik PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Ralat pelayan semasa memproses PDF.' },
      { status: 500 }
    );
  }
}