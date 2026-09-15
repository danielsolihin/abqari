import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Memastikan enjin API serverless berjalan live di Vercel

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

const THEME_KEYWORDS: Record<string, string> = {
  "Agama": "Al-Quran, Hadis, Aqidah, Ibadah, Akhlak, Fiqh, Usul Fiqh, Tafsir, Ulum al-Quran, Ulum al-Hadis, Sirah Nabi, Sejarah Islam, Syariah, Muamalat, Munakahat, Jinayat, Maqasid al-Syariah, Dakwah, Tasawuf, Pemikiran Islam, Perbandingan Agama, Etika Islam, Halal dan Haram, Zakat, Wakaf, Ekonomi Islam, Kewangan Islam.",
  "Falsafah": "Falsafah, Epistemologi, Ontologi, Metafizik, Aksiologi, Logik, Etika, Estetika, Falsafah Sains, Falsafah Pendidikan, Falsafah Bahasa, Falsafah Politik, Falsafah Ekonomi, Falsafah Undang-undang, Falsafah Islam, Falsafah Barat, Falsafah Timur, Pemikiran Kritis, Pemikiran Analitis, Teori Pengetahuan, Falsafah Insan, Falsafah Alam, Falsafah Teknologi.",
  "Saintifik": "Biologi, Kimia, Fizik, Matematik, Astronomi, Geologi, Geografi, Perubatan, Farmasi, Sains Kesihatan, Sains Alam Sekitar, Sains Makanan, Sains Komputer, Teknologi Maklumat, Kejuruteraan, Bioteknologi, Nanoteknologi, Sains Data, Kecerdasan Buatan (AI), Robotik, Neurosains, Genetik, Mikrobiologi, Sains Bahan, Sains Sosial, Psikologi, Sosiologi, Ekonomi, Antropologi, Kaedah Penyelidikan Saintifik.",
  "Semua Tema": "Integrasi dan gabungan menyeluruh merangkumi Agama, Falsafah, dan Saintifik."
};

// Algoritma Matematik Cosine Similarity untuk Vektor Embeddings
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subjectId, courseName, courseCode, examPeriod, duration, theme, sections, bloomCounts, setSoalan, co, lo, topicDistribution, subQuestions 
    } = body;

    if (!subjectId) return NextResponse.json({ error: 'ID Subjek diperlukan.' }, { status: 400 });

    // 1. Ambil semua dokumen & cebisan teks (chunks) berserta vektor embedding
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select(`id, content, embedding, documents!inner(subject_id)`)
      .eq('documents.subject_id', subjectId);

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Tiada dokumen PDF dijumpai untuk subjek ini.' }, { status: 404 });
    }

    // 2. BINA CARIAN VEKTOR PINTAR (VECTOR SIMILARITY SEARCH)
    const activeTopics = topicDistribution?.filter((t: any) => t.name.trim() !== '') || [];
    const queryTopicText = activeTopics.map((t: any) => t.name).join(' ') || theme;
    
    let relevantChunks = chunks;

    try {
      // Jana vector embedding untuk kata kunci topik sasaran (Model baharu gemini-embedding-001 dengan 768 dimensi)
      const queryEmbedResponse = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: `${queryTopicText} ${THEME_KEYWORDS[theme] || ''}`,
        config: {
          outputDimensionality: 768,
        },
      });

      const queryVector =
        queryEmbedResponse.embeddings?.[0]?.values ||
        (queryEmbedResponse as any)?.embedding?.values ||
        (queryEmbedResponse as any)?.values;

      if (queryVector) {
        // Kira Cosine Similarity untuk setiap chunk dan susun mengikut skor tertinggi
        const scoredChunks = chunks.map((c: any) => {
          let score = 0;
          if (Array.isArray(c.embedding)) {
            score = calculateCosineSimilarity(queryVector, c.embedding);
          }
          return { ...c, score };
        });

        scoredChunks.sort((a, b) => b.score - a.score);
        // Pilih top 15 chunks paling relevan sahaja
        relevantChunks = scoredChunks.slice(0, 15);
      }
    } catch (embedError) {
      console.warn('Amaran: Gagal melaksanakan carian vektor, menggunakan mod fail-safe:', embedError);
    }

    const contextText = relevantChunks.map(c => c.content).join('\n\n');
    const currentThemeKeywords = THEME_KEYWORDS[theme] || THEME_KEYWORDS["Semua Tema"];

    const themeWarning = theme === 'Semua Tema'
      ? `AMARAN: Anda dibenarkan menggabungkan konteks secara bebas dan bersepadu.`
      : `AMARAN MUTLAK: DILARANG menjana soalan yang tersasar daripada tema ${theme.toUpperCase()}.`;

    const coListString = Array.isArray(co) && co.length > 0 ? co.join(', ') : 'Tiada';
    const loListString = Array.isArray(lo) && lo.length > 0 ? lo.join(', ') : 'Tiada';

    let topicPrompt = '';
    if (activeTopics.length > 0) {
      const topicList = activeTopics.map((t: any) => `- ${t.name} (${t.percentage}%)`).join('\n');
      topicPrompt = `
TABURAN TOPIK KURSUS (WAJIB DIPATUHI):
Anda mesti mengagihkan penghasilan soalan berpandukan peratusan (pemberat) topik-topik di bawah sedekat yang mungkin berdasarkan jumlah soalan:
${topicList}
Pastikan fokus maklumat yang diekstrak mewakili pemberat topik ini.
`;
    }

    let formatPrompt = "";
    let skemaPrompt = "";

    const generateSectionPrompt = (sectionName: string, sectionData: any) => {
      if (!sectionData || !sectionData.enabled || sectionData.count <= 0) return;

      formatPrompt += `\nBAHAGIAN ${sectionName} (${sectionData.marks} MARKAH)\n`;
      skemaPrompt += `\nBAHAGIAN ${sectionName}\n`;

      if (sectionData.type === 'objektif') {
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan berformat Objektif (A, B, C, D). JANGAN KURANG, JANGAN LEBIH!\n`;
        formatPrompt += `1. [Soalan] [C: ..] [LO: ..] [Aras: CX]\n   A. [Pilihan 1]\n   B. [Pilihan 2]\n   C. [Pilihan 3]\n   D. [Pilihan 4]\n`;
        skemaPrompt += `1. [Jawapan A/B/C/D]\n...(Teruskan sehingga soalan ke-${sectionData.count})\n`;
      } 
      else if (sectionData.type === 'true_false') {
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan berformat Benar/Salah. JANGAN KURANG, JANGAN LEBIH!\n`;
        formatPrompt += `1. [Soalan] [C: ..] [LO: ..] [Aras: CX]\n   A. BENAR\n   B. SALAH\n`;
        skemaPrompt += `1. [Jawapan BENAR/SALAH]\n...(Teruskan sehingga soalan ke-${sectionData.count})\n`;
      } 
      else if (sectionData.type === 'essay') {
        let subQFormat = `SOALAN 1\na) [Soalan] [C: ..] [LO: ..] [Aras: CX] (X Markah)\n`;
        let subQSkema = `SOALAN 1\na) Fakta (1m) + Huraian ringkas (1m) -> Jumlah Markah\n`;
        
        if (subQuestions && subQuestions.enabled && subQuestions.count > 0) {
          subQFormat = `SOALAN 1\n`;
          subQSkema = `SOALAN 1\n`;
          const alphabets = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
          const actualCount = Math.min(subQuestions.count, 10);
          for (let i = 0; i < actualCount; i++) {
            subQFormat += `   ${alphabets[i]}) [Sub-soalan ${alphabets[i]}] [C: ..] [LO: ..] [Aras: CX] (X Markah)\n`;
            subQSkema += `   ${alphabets[i]}) Fakta (1m) + Huraian ringkas (1m) -> Jumlah Markah\n`;
          }
        }
        
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan utama berformat Esei/Subjektif.\nPENTING: Jawab SEMUA soalan di bawah ini.\n${subQFormat}...(Teruskan mematuhi format ini untuk Soalan 2, Soalan 3 dan seterusnya sehingga Soalan ${sectionData.count})\n`;
        skemaPrompt += `${subQSkema}...(Teruskan skema ini sehingga Soalan ${sectionData.count})\n`;
      }
    };

    generateSectionPrompt('A', sections.A);
    generateSectionPrompt('B', sections.B);
    generateSectionPrompt('C', sections.C);

    const prompt = `Anda adalah Penggubal Soalan Peperiksaan Akademik Rasmi UiTM bertaraf Profesor.
Tugas anda adalah menjana ISI KANDUNGAN SOALAN untuk SET SOALAN ${setSoalan} dan SKEMA JAWAPAN sahaja. JANGAN jana maklumat "Header".

AMARAN KERAS (WAJIB PATUH JUMLAH & STRUKTUR):
1. JIKA sesuatu format (Bahagian A, B, atau C) TIDAK DIMINTA di dalam arahan "FORMAT SOALAN YANG DIKEHENDAKI" di bawah, ANDA DILARANG SAMA SEKALI mewujudkannya.
2. ANDA WAJIB menghasilkan JUMLAH SOALAN YANG TEPAT seperti yang dinyatakan. Jika diminta 20 soalan, anda mesti kira dan cetak dari nombor 1 hingga nombor 20 TANPA GAGAL.
3. Untuk Soalan Bertingkat (jika ada diminta), pastikan anda pecahkan soalan kepada a, b, c mengikut jumlah yang ditetapkan.

KAWALAN SUMBER & KREATIVITI OLAHAN ("MENGGORENG TERKAWAL"):
1. KEBENARAN MENGOLAH KREATIF: Bagi memastikan sasaran kuota soalan tercapai, anda DIBENARKAN MENGGORENG, mengolah, memanipulasi, membina senario aplikasi (kes/situasi), dan memutarbelitkan bentuk soalan seluas-luasnya. 
2. SYARAT MUTLAK: Walaupun anda menggoreng ayat senario atau struktur soalan secara meluas, FAKTA ASAS dan JAWAPAN yang menyokong soalan tersebut MESTILAH berasal 100% dari "TEKS SUMBER KURSUS" di bawah.

KETEPATAN ISTILAH & LARAS BAHASA AGAMA (KONTEKS MALAYSIA):
1. Peperiksaan rasmi di Malaysia.
2. Gunakan "Al-Quran" apabila merujuk kitab suci secara khusus.
3. Sentiasa utamakan terma tepat dari Teks Sumber.

KEUTAMAAN TERTINGGI (SASARAN KUOTA ARAS BLOOM):
- C1 (Pengetahuan) : ${bloomCounts.C1} soalan
- C2 (Pemahaman)   : ${bloomCounts.C2} soalan
- C3 (Aplikasi)    : ${bloomCounts.C3} soalan
- C4 (Analisis)    : ${bloomCounts.C4} soalan
- C5 (Sintesis)    : ${bloomCounts.C5} soalan
- C6 (Penilaian)   : ${bloomCounts.C6} soalan

TEMA SOALAN & FOKUS:
- Tema Pilihan: **${theme.toUpperCase()}**
- Fokus Konsep: ${currentThemeKeywords}
${themeWarning}
${topicPrompt}

SENARAI DOMAIN DAN LO:
- Pilihan Domain: ${coListString}
- Pilihan LO: ${loListString}

FORMAT SOALAN YANG DIKEHENDAKI:
${formatPrompt}

TEKS SUMBER KURSUS (CEBISAN RELEVAN HASIL CARIAN VEKTOR):
"""
${contextText}
"""

[PENJANAAN SKEMA JAWAPAN]
${skemaPrompt}
SKEMA JAWAPAN TAMAT
`;

    // DITUKAR: Naik taraf kepada model rasmi baharu gemini-3.6-flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const generatedText = response.text || '';

    let qText = generatedText;
    let sText = '';
    const splitIdx = generatedText.indexOf('[PENJANAAN SKEMA JAWAPAN]');
    if (splitIdx !== -1) {
      qText = generatedText.substring(0, splitIdx).trim();
      sText = generatedText.substring(splitIdx).replace('[PENJANAAN SKEMA JAWAPAN]', '').trim();
    }

    await supabase.from('archives').insert([
      {
        course_code: courseCode || 'TIADA',
        subject_name: courseName || 'Subjek Tanpa Nama',
        exam_period: examPeriod || 'JULAI 2026',
        type: `Set ${setSoalan} (${theme})`,
        generator_name: 'Prof. Dr. Ahmad Fakhruddin',
        status: 'Selesai',
        questions_text: qText,
        scheme_text: sText
      }
    ]);

    return NextResponse.json({ success: true, data: generatedText });
  } catch (error: any) {
    console.error('Ralat AI Penjana:', error);
    return NextResponse.json({ error: error.message || 'Gagal menjana soalan.' }, { status: 500 });
  }
}