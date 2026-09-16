import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// -------------------------------------------------------------------
// TETAPAN PENTING: Paksa Vercel beri masa maksimum (60 saat) 
// untuk membolehkan AI membaca nota tebal & menjana soalan berkualiti
// -------------------------------------------------------------------
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Had maksimum untuk akaun Vercel Hobby (Percuma)

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

    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select(`id, content, embedding, documents!inner(subject_id)`)
      .eq('documents.subject_id', subjectId);

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Tiada dokumen PDF dijumpai untuk subjek ini.' }, { status: 404 });
    }

    const activeTopics = topicDistribution?.filter((t: any) => t.name.trim() !== '') || [];
    const queryTopicText = activeTopics.map((t: any) => t.name).join(' ') || theme;
    
    let relevantChunks = chunks;

    try {
      const queryEmbedResponse = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: `${queryTopicText} ${THEME_KEYWORDS[theme] || ''}`,
      });

      const queryVector =
        queryEmbedResponse.embeddings?.[0]?.values ||
        (queryEmbedResponse as any)?.embedding?.values ||
        (queryEmbedResponse as any)?.values;

      if (queryVector) {
        const scoredChunks = chunks.map((c: any) => {
          let score = 0;
          if (Array.isArray(c.embedding)) {
            score = calculateCosineSimilarity(queryVector, c.embedding);
          }
          return { ...c, score };
        });

        scoredChunks.sort((a, b) => b.score - a.score);
        // KUALITI MAKSIMUM: Menggunakan 20 kepingan teks (Chunks) paling relevan (Hampir 3-4 muka surat padat)
        relevantChunks = scoredChunks.slice(0, 20);
      }
    } catch (embedError) {
      console.warn('Amaran: Gagal carian vektor, guna fallback chunks:', embedError);
      relevantChunks = chunks.slice(0, 20);
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
TABURAN TOPIK KURSUS:
Anda mesti mengagihkan penghasilan soalan berpandukan peratusan topik di bawah:
${topicList}
`;
    }

    let formatPrompt = "";
    let skemaPrompt = "";

    const generateSectionPrompt = (sectionName: string, sectionData: any) => {
      if (!sectionData || !sectionData.enabled || sectionData.count <= 0) return;

      formatPrompt += `\nBAHAGIAN ${sectionName} (${sectionData.marks} MARKAH)\n`;
      skemaPrompt += `\nBAHAGIAN ${sectionName}\n`;

      if (sectionData.type === 'objektif') {
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan berformat Objektif (A, B, C, D).\n`;
        formatPrompt += `1. [Soalan] [C: ..] [LO: ..] [Aras: CX]\n   A. [Pilihan 1]\n   B. [Pilihan 2]\n   C. [Pilihan 3]\n   D. [Pilihan 4]\n`;
        skemaPrompt += `1. [Jawapan A/B/C/D]\n...(Teruskan sehingga soalan ke-${sectionData.count})\n`;
      } 
      else if (sectionData.type === 'true_false') {
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan berformat Benar/Salah.\n`;
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
        
        formatPrompt += `WAJIB hasilkan TEPAT ${sectionData.count} soalan utama berformat Esei/Subjektif.\n${subQFormat}...(Teruskan sehingga Soalan ${sectionData.count})\n`;
        skemaPrompt += `${subQSkema}...(Teruskan skema ini sehingga Soalan ${sectionData.count})\n`;
      }
    };

    generateSectionPrompt('A', sections.A);
    generateSectionPrompt('B', sections.B);
    generateSectionPrompt('C', sections.C);

    const prompt = `Anda adalah Penggubal Soalan Peperiksaan Akademik Rasmi UiTM bertaraf Profesor.
Tugas anda adalah menjana ISI KANDUNGAN SOALAN untuk SET SOALAN ${setSoalan} dan SKEMA JAWAPAN sahaja. JANGAN jana maklumat "Header".

==================================================
HIRARKI KEUTAMAAN MUTLAK & RESHUFFLE ARAS BLOOM:
==================================================

KEUTAMAAN #1 (KUOTA ARAS BLOOM & SUSUNAN RAWAK / RESHUFFLE):
1. KUOTA TEPAT 100%: Anda WAJIB memastikan JUMLAH KESELURUHAN TAG [Aras: CX] TEPAT KETAT sepadan dengan sasaran nombor di bawah:
   - Aras [Aras: C1] (Pengetahuan) : WAJIB TEPAT ${bloomCounts.C1} soalan
   - Aras [Aras: C2] (Pemahaman)   : WAJIB TEPAT ${bloomCounts.C2} soalan
   - Aras [Aras: C3] (Aplikasi)    : WAJIB TEPAT ${bloomCounts.C3} soalan
   - Aras [Aras: C4] (Analisis)    : WAJIB TEPAT ${bloomCounts.C4} soalan
   - Aras [Aras: C5] (Sintesis)    : WAJIB TEPAT ${bloomCounts.C5} soalan
   - Aras [Aras: C6] (Penilaian)   : WAJIB TEPAT ${bloomCounts.C6} soalan

2. ARAHAN RESHUFFLE (SUSUNAN RAWAK & BERSERTAAN):
   - DILARANG SAMA SEKALI menyusun aras soalan secara berkelompok berturutan.
   - Anda WAJIB MENGACAK / MERAWAKKAN (RESHUFFLE) taburan aras Bloom secara dinamik sepanjang kertas soalan.

KEUTAMAAN #2 (JUMLAH & STRUKTUR BAHAGIAN SOALAN):
1. ANDA WAJIB menghasilkan JUMLAH SOALAN YANG TEPAT seperti yang dinyatakan.

KEUTAMAAN #3 (TEMA, TOPIK, DOMAIN CO & LO):
- Tema Pilihan: **${theme.toUpperCase()}**
- Fokus Konsep: ${currentThemeKeywords}
${themeWarning}
${topicPrompt}
- Pilihan Domain: ${coListString}
- Pilihan LO: ${loListString}

KEUTAMAAN #4 (KAWALAN SUMBER & FAKTA MUTLAK):
1. Fakta asas dan jawapan MESTI berasal 100% HANYA dari "TEKS SUMBER KURSUS". Dilarang mereka cipta fakta luar.

FORMAT SOALAN YANG DIKEHENDAKI:
${formatPrompt}

TEKS SUMBER KURSUS:
"""
${contextText}
"""

[PENJANAAN SKEMA JAWAPAN]
${skemaPrompt}
SKEMA JAWAPAN TAMAT
`;

    let response;
    let lastError = '';

    // UTAMAKAN MODEL 'PRO' UNTUK KUALITI TINGGI (TIADA KOMPROMI)
    const candidateModels = ['gemini-1.5-pro', 'gemini-1.5-flash'];

    for (const modelName of candidateModels) {
      try {
        console.log(`Mencuba penjanaan dengan model kualiti tinggi: ${modelName}...`);
        response = await ai.models.generateContent({ 
          model: modelName, 
          contents: prompt 
        });
        if (response && response.text) break;
      } catch (err: any) {
        lastError = err.message || JSON.stringify(err);
        console.warn(`[Model ${modelName} Gagal]: ${lastError}`);
      }
    }

    if (!response || !response.text) {
      throw new Error(`Google AI API Error: ${lastError || 'Gagal mendapat respon, kemungkinan kuota API penuh atau server Google sedang sibuk.'}`);
    }

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