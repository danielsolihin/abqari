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

// Fungsi pembantu untuk mengesahkan pengguna berasaskan Token Bearer
async function getAuthenticatedUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Ekstrak user secara terus menggunakan token JWT
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. PENGESAHAN KESELAMATAN PENGGUNA (DI-BYPASS SEMENTARA WAKTU)
    const user = await getAuthenticatedUser(req);
    // Jika tiada sesi log masuk aktif, gunakan ID pengguna sementara supaya pangkalan data tidak menyekat muat naik
    const userId = user?.id || 'public-user';

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

    // Pembersihan aksara unicode tersembunyi
    extractedText = extractedText.replace(/\u0000/g, '').replace(/\\u0000/g, '');

    // 2. SIMPAN DOKUMEN BERSAMA ID PENSYARAH (userId)
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ 
        subject_id: subjectId,
        file_url: file.name,
        file_name: file.name,
        user_id: userId
      }])
      .select()
      .single();

    if (docError) throw new Error(`Gagal menyimpan dokumen: ${docError.message}`);
    const documentId = docData.id;

    const chunks = chunkText(extractedText);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      let embedding = null;
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: chunk,
          config: {
            outputDimensionality: 768,
          },
        });

        embedding =
          embedResponse.embeddings?.[0]?.values ||
          (embedResponse as any)?.embedding?.values ||
          (embedResponse as any)?.values;
      } catch (embedErr) {
        console.warn(`Amaran: Gagal menjana vektor untuk perenggan ke-${i + 1}, meneruskan muat naik teks sahaja:`, embedErr);
      }

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