import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Had masa Vercel Hobby

// ============================================================
// OPENAI EMBEDDING (PANTAS & RINGAN)
// ============================================================
async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Kunci OPENAI_API_KEY tidak dijumpai.");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small", 
      input: text,
      dimensions: 768, 
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Gagal menjana embedding dari OpenAI");
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================================
// POST - HUBUNGAN TERUS KE CHAT UI & OPENAI
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, subjectId } = body;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Soalan tidak boleh kosong.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. TUKAR SOALAN PENGGUNA KEPADA VEKTOR
    const queryEmbedding = await getEmbedding(question.trim());

    // 2. PENAPIS ID SUBJEK (PERISAI RALAT SUPABASE UUID)
    // Jika subjectId kosong, bernilai "all", atau tidak sah, kita paksa ia menjadi null 
    // supaya Supabase tidak crash akibat ralat format UUID.
    const safeSubjectId = (subjectId && typeof subjectId === 'string' && subjectId.trim() !== '' && subjectId !== 'all') 
      ? subjectId.trim() 
      : null;

    // 3. CARI BONGKAH NOTA RELEVAN (VECTOR MATCHING)
    const { data: docs, error: matchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Rendahkan sikit ambang supaya mudah tangkap maklumat
      match_count: 5,
      filter_subject_id: safeSubjectId 
    });

    // JIKA SUPABASE CRASH, KITA PULANGKAN JSON, BUKAN HTML
    if (matchError) {
      console.error("Supabase RPC Error:", matchError);
      return NextResponse.json({ 
        error: `Ralat Carian Pangkalan Data: ${matchError.message}` 
      }, { status: 500 });
    }

    let contextText = '';
    let sources: any[] = [];

    // 4. SUSUN NOTA UNTUK DISUAP KEPADA OPENAI
    if (docs && docs.length > 0) {
      contextText = docs.map((d: any) => `[Petikan Rujukan]\n${d.content || ''}`).join('\n\n---\n\n');
      sources = docs.map((d: any) => ({ content: `📄 "${(d.content || '').substring(0, 80)}..."` }));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Kunci OPENAI_API_KEY tidak dikonfigurasi.' }, { status: 500 });
    }

    const systemPrompt = `Anda adalah Pembantu AI ABQARI untuk pensyarah UiTM.
Tugas utama anda adalah menjawab soalan berdasarkan teks "Rujukan Nota Dokumen (RAG)" yang diberikan.

ARAHAN WAJIB:
1. BACA DAN ANALISIS "Rujukan Nota Dokumen (RAG)" terlebih dahulu.
2. JIKA jawapan terdapat di dalam nota tersebut, HANYA gunakan maklumat dari nota itu untuk menjawab.
3. JIKA nota tersebut kosong atau tidak mengandungi maklumat yang berkaitan, barulah anda dibenarkan menggunakan pengetahuan am.
4. JIKA anda menggunakan pengetahuan am, anda DIWAJIBKAN meletakkan penafian ini pada akhir jawapan: "*Nota: Maklumat ini dijana berdasarkan pengetahuan am AI, bukan daripada dokumen rujukan anda.*"

Rujukan Nota Dokumen (RAG):
${contextText || '(Tiada nota spesifik ditemui untuk soalan ini)'}`;

    // 5. MINTA JAWAPAN DARIPADA OPENAI
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
      return NextResponse.json({ 
        error: openaiData.error?.message || 'Gagal mendapat maklum balas dari OpenAI.' 
      }, { status: openaiRes.status });
    }

    const answerText = openaiData.choices?.[0]?.message?.content || 'Tiada jawapan diterima dari OpenAI.';

    return NextResponse.json({
      success: true,
      answer: answerText,
      sources: sources
    });

  } catch (error: any) {
    console.error('Ralat API Chat RAG (Crash Besar):', error);
    // WAJIB MEMULANGKAN JSON SUPAYA FRONTEND TIDAK ERROR PARSE
    return NextResponse.json({ 
      error: error.message || 'Ralat pelayan yang tidak dijangka.' 
    }, { status: 500 });
  }
}