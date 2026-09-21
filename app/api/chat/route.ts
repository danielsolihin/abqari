import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

export const dynamic = 'force-dynamic';
// Disesuaikan kepada 60 saat mengikut had maksimum Vercel Hobby Tier bagi mengelakkan ralat 504 / JSON Parse
export const maxDuration = 60; 

// ============================================================
// SINGLETON LOCAL EMBEDDING (Xenova/bge-base-en-v1.5)
// ============================================================
class PipelineSingleton {
  static task = "feature-extraction" as const;
  static model = "Xenova/bge-base-en-v1.5";
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
// POST - HUBUNGAN TERUS KE CHAT UI & OPENAI
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, subjectId } = body;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Soalan tidak boleh kosong.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    // Guna Service Role Key untuk pastikan carian vektor berkesan (RLS dipaling)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. TUKAR SOALAN PENGGUNA KEPADA VEKTOR TEMPATAN
    const queryEmbedding = await getLocalEmbedding(question.trim());

    // 2. CARI BONGKAH NOTA RELEVAN (VECTOR MATCHING)
    const { data: docs, error: matchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // Ambang kejituan
      match_count: 5,
      filter_subject_id: subjectId || null // Berfungsi dengan SQL baharu
    });

    if (matchError) {
      console.error("Supabase RPC Error:", matchError);
    }

    let contextText = '';
    let sources: any[] = [];

    // 3. SUSUN NOTA UNTUK DISUAP KEPADA OPENAI
    if (docs && docs.length > 0) {
      contextText = docs.map((d: any) => `[Petikan Rujukan]\n${d.content || ''}`).join('\n\n---\n\n');
      // Paparkan cebisan teks di kotak rujukan kuning dalam UI Prof
      sources = docs.map((d: any) => ({ content: `📄 "${(d.content || '').substring(0, 80)}..."` }));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Kunci OPENAI_API_KEY tidak dijumpai. Sila pastikan ia diisi di dalam fail .env.local anda.' 
      }, { status: 500 });
    }

    // ==========================================
    // PROMPT ASAL PROF (SANGAT KETAT & BERSYARAT)
    // ==========================================
    const systemPrompt = `Anda adalah Pembantu AI ABQARI untuk pensyarah UiTM.
Tugas utama anda adalah menjawab soalan berdasarkan teks "Rujukan Nota Dokumen (RAG)" yang diberikan.

ARAHAN WAJIB (Sila ikut turutan ini dengan ketat):
1. BACA DAN ANALISIS "Rujukan Nota Dokumen (RAG)" terlebih dahulu.
2. JIKA jawapan terdapat di dalam nota tersebut, HANYA gunakan maklumat dari nota itu untuk menjawab. Jangan tambah maklumat luar jika nota sudah mencukupi.
3. JIKA DAN HANYA JIKA nota tersebut kosong atau tidak mengandungi maklumat yang berkaitan langsung dengan soalan, barulah anda dibenarkan menggunakan pengetahuan am luaran anda.
4. JIKA anda terpaksa menggunakan sumber luar/pengetahuan am (seperti di Langkah 3), anda DIWAJIBKAN meletakkan penafian ini pada ayat terakhir jawapan anda: 
  "*Nota: Maklumat ini dijana berdasarkan pengetahuan am AI dan sumber luar, bukan daripada dokumen rujukan anda.*"

Rujukan Nota Dokumen (RAG):
${contextText || '(Tiada nota spesifik ditemui untuk soalan ini)'}`;

    // 4. MINTA JAWAPAN DARIPADA OPENAI GPT-4O-MINI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.4 
      })
    });

    const openaiData = await openaiRes.json();

    if (!openaiRes.ok) {
      const errMsg = openaiData.error?.message || 'Gagal mendapat maklum balas dari OpenAI API.';
      return NextResponse.json({ error: errMsg }, { status: openaiRes.status });
    }

    const answerText = openaiData.choices?.[0]?.message?.content || 'Tiada jawapan diterima dari OpenAI.';

    return NextResponse.json({
      success: true,
      answer: answerText,
      sources: sources
    });

  } catch (error: any) {
    console.error('Ralat API Chat RAG (OpenAI + Local Vector):', error);
    return NextResponse.json(
      { error: error.message || 'Ralat pelayan semasa memproses sembang RAG.' },
      { status: 500 }
    );
  }
}