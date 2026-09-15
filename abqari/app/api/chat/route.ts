import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, subjectId } = await req.json();

    if (!question) {
      return NextResponse.json({ error: 'Soalan diperlukan.' }, { status: 400 });
    }

    // 1. Tukar soalan pengguna kepada vektor guna @google/genai (selamat untuk TypeScript)
    const embedResponse = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: question,
      config: {
        outputDimensionality: 768,
      },
    });

    // Semak pelbagai struktur pulangan daripada SDK secara selamat (bypass type check)
    const resAny = embedResponse as any;
    const queryEmbedding =
      resAny?.embedding?.values ||
      resAny?.values ||
      resAny?.embeddings?.[0]?.values;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.error('Struktur penuh embedResponse:', JSON.stringify(embedResponse, null, 2));
      throw new Error('Gagal menjana vektor soalan daripada Gemini API.');
    }

    // 2. Cari perenggan paling relevan di Supabase pgvector guna fungsi RPC
    const { data: matchedChunks, error: rpcError } = await supabase.rpc(
      'match_document_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
        filter_subject_id: subjectId || null,
      }
    );

    if (rpcError) throw new Error(`Ralat carian pgvector: ${rpcError.message}`);

    // 3. Gabungkan perenggan yang ditemui sebagai konteks
    const contextText = matchedChunks && matchedChunks.length > 0
      ? matchedChunks.map((c: any) => c.content).join('\n\n---\n\n')
      : 'Tiada perenggan relevan ditemui dalam pangkalan data.';

    // 4. Bina prompt RAG untuk Gemini
    const prompt = `Anda ialah pembantu AI yang membantu menjawab soalan berdasarkan dokumen yang dimuat naik.
Sila jawab soalan di bawah berdasarkan KONTEKS yang diberikan sahaja. Jika jawapan tiada dalam konteks, nyatakan bahawa anda tidak menemui maklumat tersebut dalam dokumen.

KONTEKS DOKUMEN:
${contextText}

SOALAN:
${question}`;

    // 5. Jana jawapan akhir menggunakan Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return NextResponse.json({
      success: true,
      answer: response.text,
      sources: matchedChunks || [],
    });
  } catch (error: any) {
    console.error('Ralat API Chat:', error.message || error);
    return NextResponse.json(
      { error: error.message || 'Ralat tidak diketahui berlaku.' },
      { status: 500 }
    );
  }
}