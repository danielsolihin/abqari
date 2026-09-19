import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, subjectId } = body;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Soalan tidak boleh kosong.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let query = supabase.from('documents').select('id, title, file_name, content, subject_id');
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }
    
    const { data: docs } = await query.limit(5);

    let contextText = '';
    let sources: any[] = [];

    if (docs && docs.length > 0) {
      contextText = docs.map(d => `[Fail: ${d.file_name || d.title || 'Dokumen'}]\n${d.content || ''}`).join('\n\n');
      sources = docs.map(d => ({ content: `📄 ${d.file_name || d.title || 'Dokumen Nota'}` }));
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Kunci OPENAI_API_KEY tidak dijumpai. Sila pastikan ia diisi di dalam fail .env.local anda.' 
      }, { status: 500 });
    }

    // ==========================================
    // PROMPT BAHARU (SANGAT KETAT & BERSYARAT)
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
${contextText || '(Tiada nota spesifik yang dimuat naik untuk subjek ini)'}`;

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
        // Suhu diturunkan ke 0.4 supaya AI lebih patuh pada fakta teks dan kurang merepek
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
    console.error('Ralat API Chat RAG (OpenAI):', error);
    return NextResponse.json(
      { error: error.message || 'Ralat pelayan semasa memproses sembang RAG OpenAI.' },
      { status: 500 }
    );
  }
}