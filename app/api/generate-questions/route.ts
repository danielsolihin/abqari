import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// PEMETAAN KATA TUGAS / KATA PERINTAH TAKSONOMI BLOOM (KHAS ESEI SAHAJA)
// ============================================================
const BLOOM_VERBS_MAP: Record<string, string[]> = {
  C1: ["Aktifkan", "Perihalkan", "Kenal pasti", "Labelkan", "Senaraikan", "Padankan", "Namakan", "Lakarkan", "Nyatakan kembali", "Hasilkan semula", "Pilih", "Nyatakan"],
  C2: ["Ubah", "Tafsirkan", "Jelaskan", "Rumuskan", "Wajarkan", "Terangkan", "Ramalkan", "Terjemahkan", "Anggarkan", "Bina inferens", "Tulis semula"],
  C3: ["Itlakkan", "Hitung", "Tunjuk cara", "Teroka", "Ubah suai", "Sediakan", "Selesaikan", "Jana", "Manipulasikan", "Ramal", "Tunjukkan", "Hubungkaitkan"],
  C4: ["Analisis", "Pilih", "Asingkan", "Bandingkan", "Bezakan", "Jelaskan dengan gambar rajah", "Huraikan", "Tunjukkan perbezaan", "Diskriminasikan", "Kenal pasti", "Ilustrasikan", "Bina inferens", "Lakarkan", "Hubungkaitkan"],
  C5: ["Gabungkan", "Karang", "Jana", "Organisasikan", "Bina semula", "Rekaciptakan", "Ubah suai", "Atur semula", "Tulis", "Semak", "Huraikan", "Rancang", "Himpunkan", "Hubungkaitkan", "Organisasikan semula", "Rumuskan", "Tulis semula"],
  C6: ["Taksir", "Bandingkan", "Simpulkan", "Bezakan", "Kritik", "Wajarkan", "Diskriminasikan", "Nilaikan", "Tafsirkan", "Adili", "Bincangkan kewajaran", "Rumuskan dan sokong"]
};

// ============================================================
// DEFINISI RUBRIK CO & BLOOM (BERDASARKAN DOKUMEN RASMI)
// ============================================================
const RUBRIK_AKADEMIK = `
PANDUAN RUBRIK COURSE OUTCOMES (CO) & ARAS BLOOM:
Anda DIWAJIBKAN untuk menggubal soalan dan menetapkan tag supaya selari dengan takrifan rubrik berikut secara 100%:

[COURSE OUTCOMES (CO)]
CO1: Pengetahuan dan Kefahaman - Keupayaan pelajar memahami, menerangkan dan menggunakan pengetahuan berkaitan bidang.
CO2: Kemahiran Kognitif - Keupayaan pelajar berfikir secara kritis, menganalisis, menilai dan menyelesaikan masalah.
CO3: Kemahiran Praktikal - Keupayaan mengaplikasikan pengetahuan dan kemahiran praktikal.
CO4: Kemahiran Interpersonal - Keupayaan berinteraksi dan bekerjasama.
CO5: Kemahiran Komunikasi - Penyampaian idea secara lisan/tulisan dengan jelas.
CO6: Kemahiran Digital - Guna teknologi/sumber digital.
CO7: Kemahiran Numerasi - Guna nombor, data, statistik.
CO8: Kepimpinan, Autonomi dan Tanggungjawab - Memimpin, buat keputusan kendiri.
CO9: Kemahiran Kendiri - Urus diri, belajar kendiri.
CO10: Kemahiran Keusahawanan - Peluang perniagaan, inisiatif.
CO11: Etika dan Profesionalisme - Nilai, etika, integriti.

[DOMAIN KOGNITIF / ARAS BLOOM (C)]
C1 (Pengetahuan): Mengingat atau menyatakan semula fakta/konsep.
C2 (Pemahaman): Menerangkan, menghuraikan, memberikan contoh.
C3 (Aplikasi): Menggunakan pengetahuan dalam situasi tertentu.
C4 (Analisis): Memecahkan maklumat, mengenal pasti hubungan/perbandingan.
C5 (Sintesis): Menggabungkan pengetahuan untuk menghasilkan idea baharu.
C6 (Penilaian): Membuat pertimbangan, justifikasi berdasarkan standard tertentu.
`;

// ============================================================
// OPENAI EMBEDDING
// ============================================================
async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY tidak dijumpai untuk fungsi embedding.");

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
// FUNGSI PENAPIS AUTOMATIK PEKA BAHASA & TATABAHASA DBP
// ============================================================
function cleanAndTransformQuestions(text: string, language: string = "Bahasa Melayu", questionType: string = "objektif"): string {
  if (!text) return "";

  let processedText = text.replace(/\\t/g, "\t");
  processedText = processedText.replace(/\bDiskusikan\b/gi, "Bincangkan");

  // PEMBETULAN AUTOMATIK EJAAN ETIKA
  processedText = processedText.replace(/\bEthika\b/g, "Etika");
  processedText = processedText.replace(/\bethika\b/g, "etika");

  if (questionType === "objektif" || questionType === "true_false") {
    
    // PEMBETULAN BARU: Halang soalan tergantung "merujuk kepada:"
    processedText = processedText.replace(/^(\d+\.[\t\s]+)(.*?)\s+merujuk\s+kepada\s*:?\s*$/gmi, "$1Manakah antara berikut merujuk kepada maksud $2?");
    processedText = processedText.replace(/^(\d+\.[\t\s]+)(.*?)\s+(adalah|ialah)\s*:?\s*$/gmi, "$1Apakah yang dimaksudkan dengan $2?");
    
    // Tukar titik bertindih di akhir baris utama soalan kepada tanda soal
    processedText = processedText.replace(/:\s*\n/g, "?\n");

    // PEMBETULAN KHAS: Menghalang "Yang manakah" di awal soalan
    processedText = processedText.replace(/^(\d+\.[\t\s]*)Yang\s+manakah\b/gmi, "$1Manakah antara berikut");
    processedText = processedText.replace(/Yang\s+manakah/gi, "Manakah antara berikut");
    processedText = processedText.replace(/Manakah\s+antara\s+berikut\s+KECUALI\s+merupakan/gi, "Antara berikut, yang manakah merupakan");
    
    // PEMBETULAN KHAS: Menyelamatkan ayat penyata (Soalan Beranak) yang tergantung oleh AI
    processedText = processedText.replace(/^(\d+\.[\t\s]+)(yang\s+dimaksudkan\s+dengan\s+[^.]+)\./gmi, "$1Pernyataan berikut menerangkan $2.");
    
    // Baiki ralat ejaan minor
    processedText = processedText.replace(/yang manakah kembali/gi, "yang manakah");
    
    // TUKAR "SINTESIS" ATAU "SINTESISKAN" KEPADA "RUMUSKAN" KHAS UNTUK OBJEKTIF
    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Sintesis(kan|lah|kanlah)?\b/gmi, "$1Rumuskan");

    // 1. TANGKAP GABUNGAN "KATA PERINTAH + KATA TANYA" TERMASUK IMBUHAN "-lah" SEBELUM IA DITUKAR MENJADI "ANTARA BERIKUT"
    const verbBagaimana = /^(\s*(?:\d+[\.\)])?\s*)(?:Senaraikan|Perihalkan|Analisis|Lakarkan|Jelaskan|Huraikan|Bincangkan|Wajarkan|Nilaikan|Taksir|Kritik|Adili|Aktifkan|Kirakan|Hubungkan|Terangkan|Tafsirkan|Kenal pasti|Hitung)(?:lah|kan|kanlah)?\s+bagaimana(kah)?\b/gmi;
    processedText = processedText.replace(verbBagaimana, "$1Bagaimanakah");

    const verbApakah = /^(\s*(?:\d+[\.\)])?\s*)(?:Senaraikan|Perihalkan|Analisis|Lakarkan|Jelaskan|Huraikan|Bincangkan|Wajarkan|Nilaikan|Taksir|Kritik|Adili|Aktifkan|Kirakan|Hubungkan|Terangkan|Tafsirkan|Kenal pasti|Hitung)(?:lah|kan|kanlah)?\s+apa(kah)?\b/gmi;
    processedText = processedText.replace(verbApakah, "$1Apakah");

    const verbSiapakah = /^(\s*(?:\d+[\.\)])?\s*)(?:Senaraikan|Perihalkan|Analisis|Lakarkan|Jelaskan|Huraikan|Bincangkan|Wajarkan|Nilaikan|Taksir|Kritik|Adili|Aktifkan|Kirakan|Hubungkan|Terangkan|Tafsirkan|Kenal pasti|Hitung)(?:lah|kan|kanlah)?\s+siapa(kah)?\b/gmi;
    processedText = processedText.replace(verbSiapakah, "$1Siapakah");

    const verbMengapakah = /^(\s*(?:\d+[\.\)])?\s*)(?:Senaraikan|Perihalkan|Analisis|Lakarkan|Jelaskan|Huraikan|Bincangkan|Wajarkan|Nilaikan|Taksir|Kritik|Adili|Aktifkan|Kirakan|Hubungkan|Terangkan|Tafsirkan|Kenal pasti|Hitung)(?:lah|kan|kanlah)?\s+mengapa(kah)?\b/gmi;
    processedText = processedText.replace(verbMengapakah, "$1Mengapakah");

    // 2. TAPIS DAN TUKAR KATA PERINTAH ESEI TUNGGAL (TERMASUK IMBUHAN -lah) KEPADA "ANTARA BERIKUT"
    const essayVerbsPattern = /^(\s*(?:\d+[\.\)])?\s*)(?:Senaraikan|Perihalkan|Analisis|Lakarkan|Jelaskan|Huraikan|Bincangkan|Wajarkan|Nilaikan|Taksir|Kritik|Adili|Aktifkan|Kirakan|Hubungkan|Terangkan|Tafsirkan|Kenal pasti|Hitung)(?:lah|kan|kanlah)?\b/gmi;
    processedText = processedText.replace(essayVerbsPattern, "$1Antara berikut, yang manakah");

    // 3. JARING KESELAMATAN (SAFETY NET) UNTUK TATABAHASA BERLAPIS YANG PELIK
    processedText = processedText.replace(/Antara berikut,?\s*yang manakah\s+bagaimana(kah)?/gi, "Bagaimanakah");
    processedText = processedText.replace(/Manakah\s+antara\s+berikut,?\s*bagaimana(kah)?/gi, "Bagaimanakah");
    processedText = processedText.replace(/Antara berikut,?\s*yang manakah\s+apa(kah)?/gi, "Apakah");
    processedText = processedText.replace(/Manakah\s+antara\s+berikut,?\s*apa(kah)?/gi, "Apakah");
    processedText = processedText.replace(/Antara berikut,?\s*yang manakah\s+siapa(kah)?/gi, "Siapakah");
    processedText = processedText.replace(/Manakah\s+antara\s+berikut,?\s*siapa(kah)?/gi, "Siapakah");
    processedText = processedText.replace(/Antara berikut,?\s*yang manakah\s+mengapa(kah)?/gi, "Mengapakah");
    processedText = processedText.replace(/Manakah\s+antara\s+berikut,?\s*mengapa(kah)?/gi, "Mengapakah");

    // 4. PEMBETULAN SOALAN TERGANTUNG / TIDAK FORMAL / LEWAH (REDUNDANT)
    processedText = processedText.replace(/(menggambarkan|menerangkan|menjelaskan)\s+(?:yang\s+)?dimaksudkan\s+dengan/gi, "$1 maksud");
    
    processedText = processedText.replace(/Antara berikut,\s*yang manakah\s+terhadap\s+([a-zA-Z0-9\-\s]+)\s+menunjukkan bahawa\.\.\./gi, "Apakah kesimpulan yang boleh diambil mengenai $1?");
    
    processedText = processedText.replace(/\bApakah maksudnya\?/gi, "Apakah yang dimaksudkan dengan pernyataan ini?");
    processedText = processedText.replace(/\bApakah maksud pernyataan di atas\?/gi, "Apakah yang dimaksudkan dengan pernyataan ini?");
    
    processedText = processedText.replace(/([a-zA-Z0-9\-\s]+)\s+aspek apa\?/gi, "Apakah aspek yang perlu diambil kira dalam $1?");
    processedText = processedText.replace(/([a-zA-Z0-9\-\s]+)\s+(apa|bagaimana|kenapa)\?/gi, "Apakah $1?");

    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Sejauh manakah\s+(?:yang\s+dimaksudkan\s+dengan)?/gmi, "$1Antara berikut, yang manakah");
    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Mengapakah\s+yang\s+dimaksudkan\s+dengan\b/gmi, "$1Manakah antara berikut, jawapan yang menerangkan maksud");
    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Mengapakah\s+(kepentingan|tujuan|peranan|fungsi|faktor|maksud|definisi|elemen|konsep|kesan|cabaran|aspek)\b/gmi, "$1Manakah antara berikut $2");
    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Mengapakah\b/gmi, "$1Manakah antara berikut");

    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Nyatakan\s+(?:dua|tiga|empat|beberapa)\s+aspek/gmi, "$1Manakah antara berikut aspek");
    processedText = processedText.replace(/^(\s*(?:\d+[\.\)])?\s*)Nyatakan\s+(?:satu|dua|tiga|empat|beberapa)?\s*/gmi, "$1Antara berikut, yang manakah ");

    processedText = processedText.replace(/\bdalam artikel ini\b/gi, "dalam topik ini");
    processedText = processedText.replace(/\bdalam petikan ini\b/gi, "berdasarkan topik ini");

    // ============================================================
    // POST-PROCESSING: MEMAKSA PENUKARAN PERKATAAN MALAS AI
    // ============================================================
    processedText = processedText.replace(/\b(mengabaikan)\b/gi, "Mengurangkan tumpuan terhadap");
    processedText = processedText.replace(/\b(pengabaian)\b/gi, "pengetepian elemen penting");
    processedText = processedText.replace(/\b(semata-mata)\b/gi, "secara eksklusif tanpa elemen tambahan");
    processedText = processedText.replace(/\b(sahaja)\b/gi, "sebagai satu-satunya rujukan");
    processedText = processedText.replace(/\b(tidak sah)\b/gi, "kaedah alternatif yang tidak konvensional");
    processedText = processedText.replace(/\b(mengasingkan)\b/gi, "Mewujudkan pengkhususan tertutup bagi");
    processedText = processedText.replace(/\b(menghapuskan)\b/gi, "Menyelaras semula dasar sedia ada untuk");
  }

  // PEMBERSIHAN TANDA BACA BERTINDIH
  processedText = processedText.replace(/,[\s\.]*\./g, ".");
  processedText = processedText.replace(/,[\s,]+/g, ", ");
  processedText = processedText.replace(/\.\.+/g, ".");

  // PEMBAIKAN KHAS ENJIN PREMIUM: MEMISAHKAN PILIHAN JAWAPAN 'A.' JIKA IA TERCANTUM SEBARIS DENGAN SOALAN
  if (questionType === "objektif") {
    processedText = processedText.replace(/(\?|\.|:|\n)[\t\s]+(A[\.\)][\t\s]+)/g, "$1\n\n\t$2");
    processedText = processedText.replace(/([^\n])[\t\s]+([B-D][\.\)][\t\s]+)/g, "$1\n\t$2");
  }

  // PEMBAIKAN KHAS SOALAN BERANAK: MEMISAHKAN AYAT PENYATA DAN SOALAN UTAMA PADA BARIS BAHARU
  if (questionType === "objektif") {
    processedText = processedText.replace(/^(\d+\.[\t\s]+[^\n\?]+)\?\s*((?:Apakah|Bagaimanakah|Manakah|Mengapakah|Siapakah|Pilih|Pernyataan|Kombinasi|Langkah|Antara)[^\n\?]+\?)(?=\s*\n+[\t\s]*i\.)/gmi, (match, p1, p2) => {
      const cleanStmt = p1.replace(/\b(Apakah|Bagaimanakah|Manakah|Mengapakah|Siapakah)\s+/gi, '').trim();
      return `${cleanStmt}.\n\n\t${p2}`;
    });

    processedText = processedText.replace(/^(\d+\.[\t\s]+[^\n\?]+\.)[\t\s]+((?:Apakah|Bagaimanakah|Manakah|Mengapakah|Siapakah|Pilih|Pernyataan|Kombinasi|Langkah|Antara)[^\n\?]+\?)(?=\s*\n+[\t\s]*i\.)/gmi, "$1\n\n\t$2");
  }

  const langLower = (language || "").toLowerCase();
  const isArabic = langLower.includes("arab") || langLower.includes("arabic");
  const isEnglish = langLower.includes("english") || langLower.includes("inggeris");

  let lines = processedText.split("\n");

  // SAFETY NET BARU: MEMBUANG DOUBLE QUESTION SECARA PAKSA
  if (questionType === "objektif" || questionType === "true_false") {
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^\d+\.\s+/.test(line) && line.includes('?')) {
        let j = i + 1;
        while(j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length && lines[j].includes('?') && !/^[i|v|x]+\./i.test(lines[j]) && !/^[A-D][\.\)]/i.test(lines[j])) {
          const cleanLine = line.replace(/\s*(?:Apakah|Bagaimanakah|Manakah|Mengapakah|Siapakah|What|How|Which|كيف|ما|لماذا)[^?]*\?/gi, '.').replace(/\.+$/, '.');
          lines[i] = cleanLine;
        }
      }
    }
  }

  if (isArabic) {
    const backupFactDArabic = [
      "D.\tتطبيق القواعد الأصولية في استنباط الأحكام الشرعية",
      "D.\tمراعاة المقاصد الشرعية في القضايا المستحدثة",
      "D.\tالاعتماد على الأدلة الإجمالية في الفقه الإسلامي",
      "D.\tتحقيق التوازن بين النصوص والاجتهاد المعاصر"
    ];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/D\.\s+(جميع ما ذكر|جميع ما سبق|All of the above)/i.test(line)) {
        lines[i] = `\t${backupFactDArabic[Math.floor(Math.random() * backupFactDArabic.length)]}`;
      }
    }
  }

  if (isEnglish) {
    const backupFactDEnglish = [
      "D.\tCalculating the instantaneous rate of change at a specific point",
      "D.\tEvaluating the continuous limit of the target function",
      "D.\tDetermining the exact area enclosed beneath the curve",
      "D.\tIdentifying the critical boundaries of the system"
    ];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/D\.\s+All of the above/i.test(line)) {
        lines[i] = `\t${backupFactDEnglish[Math.floor(Math.random() * backupFactDEnglish.length)]}`;
      }
    }
  }

  processedText = lines.join("\n");
  processedText = processedText.replace(/Apakah wajar ([a-zA-Z0-9\-\s]+?) yang/gi, "Apakah $1 wajar yang");
  lines = processedText.split("\n");

  const diverseQuestionPrefixes = [
    "Bagaimanakah",
    "Apakah",
    "Manakah antara berikut",
    "Pilih penyataan yang paling tepat berkenaan",
    "Pernyataan manakah yang menggambarkan"
  ];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (/^\d+\.\s+/.test(line)) {
      const isNounQuestion = /Apakah\s+(tujuan|maksud|definisi|elemen|faktor|fungsi|komponen|pernyataan|konsep|sifat|kesan|cabaran|peranan|kepentingan|aspek|yang\s+dimaksudkan)/i.test(line);

      // Kurangkan rawak sekiranya ada penanda analisis supaya strukturnya selamat
      if (line.includes("Apakah ") && !isNounQuestion && !line.includes("KECUALI") && !line.includes("SALAH") && !line.includes("BENAR") && !line.includes("BUKAN") && Math.random() > 0.6) {
        const randomPrefix = diverseQuestionPrefixes[Math.floor(Math.random() * diverseQuestionPrefixes.length)];
        lines[i] = line.replace(/Apakah\s+/gi, `${randomPrefix} `);
      }
    }
  }

  let finalResult = lines.join("\n");
  finalResult = finalResult.replace(/(menggambarkan|berkenaan)\s+(?:yang\s+)?dimaksudkan\s+dengan/gi, "$1 maksud");

  return finalResult;
}

function splitIntoIndividualQuestions(fullText: string): string[] {
  if (!fullText) return [];
  const parts = fullText.split(/(?=\n?\b\d+\.[\t\s])/g);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode,
      subjectId,
      courseName = "",
      courseCode = "",
      theme = "Semua Tema",
      sectionData,
      sections,
      topicDistribution = [],
      aiModel = "gpt-4o-mini",
      co = [],
      lo = [],
      domain = [],
      language = "Bahasa Melayu",
      fullQuestions = "",
      mixedMode = false, // KAWALAN MOD CAMPURAN
      singleMode = false // KAWALAN MOD SOALAN TUNGGAL
    } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Kunci OPENAI_API_KEY tidak dijumpai." }, { status: 500 });
    }

    const langLower = (language || "").toLowerCase();
    const isArabic = langLower.includes("arab") || langLower.includes("arabic");
    const isEnglish = langLower.includes("english") || langLower.includes("inggeris");
    
    if (mode === "SCHEMA") {
      let schemaPrompt = "";
      if (isArabic) {
        schemaPrompt = `أنت خبير في إعداد نموذج الإجابة لامتحانات جامعة UiTM.
قدم نموذج الإجابة كامل وفقط للأسئلة الموجودة في ورقة الأسئلة أدناه (${language}).
1. إذا كانت الورقة تحتوي على أسئلة اختيار من متعدد فقط: اذكر رقم السؤال وحرف الإجابة فقط العمودية (مثال: 1. A).
2. إذا كانت هناك أسئلة مقالية: أعد كتابة نص السؤال الأصلي قبل تقديم الإجابة في شكل نقاط مع توزيع الدرجات.
3. يُمنع منعاً باتاً استخدام الرموز (*) أو (#) أو العناوين الرئيسية المكررة.
ورقة الأسئلة:
${fullQuestions}`;
      } else if (isEnglish) {
        schemaPrompt = `You are a UiTM University Examination Examiner.
Provide a COMPLETE ANSWER SCHEME ONLY for the questions present in the QUESTION PAPER below (${language}).
1. IF THE PAPER CONTAINS OBJECTIVE / TRUE-FALSE: State ONLY the question number and answer letter vertically (e.g., 1. A).
2. IF ESSAY QUESTIONS ARE PRESENT: REPEAT THE ORIGINAL QUESTION STATEMENT before providing point-form answers with marks.
3. DO NOT use any asterisk (*) or hashtag (#) symbols or document title headers.
QUESTION PAPER:
${fullQuestions}`;
      } else {
        schemaPrompt = `Anda adalah Pemeriksa Kertas Peperiksaan UiTM. 
Sediakan SKEMA JAWAPAN LENGKAP HANYA bagi soalan yang wujud dalam KERTAS SOALAN di bawah (${language}).
1. JIKA KERTAS SOALAN HANYA ADA OBJEKTIF / BENAR-SALAH: HANYA nyatakan nombor soalan dan abjad jawapan (Contoh: 1. A).
2. JIKA ADA SOALAN ESEI: WAJIB MENYERTAKAN SEMULA SOALAN ASAL sebelum memberikan skema jawapan dalam bentuk POINT (Bullet) berserta markah.
3. DILARANG sama sekali menggunakan simbol asterisk (*), hashtag (#), atau tajuk utama seperti "SKEMA JAWAPAN LENGKAP...".
KERTAS SOALAN:
${fullQuestions}`;
      }

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: aiModel === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini",
          messages: [{ role: "system", content: schemaPrompt }],
          temperature: 0.1
        })
      });

      const openaiData = await openaiRes.json();
      if (!openaiRes.ok) throw new Error(openaiData.error?.message || "Gagal menjana skema.");
      
      let cleanSchema = openaiData.choices?.[0]?.message?.content || "";
      cleanSchema = cleanSchema.replace(/[\*#]/g, ''); // Buang simbol * dan #
      cleanSchema = cleanSchema.replace(/SKEMA JAWAPAN LENGKAP[\s\S]*?---\n*/gi, '');
      cleanSchema = cleanSchema.replace(/SKEMA JAWAPAN LENGKAP.*?\n/gi, '');
      cleanSchema = cleanSchema.replace(/^---\n*/gm, '');

      return NextResponse.json({ success: true, data: cleanSchema.trim() });
    }

    let targetSubjectId = subjectId;
    if (!targetSubjectId && courseCode) {
      const { data: sub } = await supabase.from("subjects").select("id").ilike("course_code", `%${courseCode.trim()}%`).maybeSingle();
      if (sub) targetSubjectId = sub.id;
    }

    let chunksFound: string[] = [];
    if (targetSubjectId) {
      const activeTopics = (topicDistribution || []).filter((t: any) => t.name && t.name.trim() !== "");
      if (activeTopics.length > 0) {
        for (const t of activeTopics) {
          const queryEmbedding = await getEmbedding(t.name.trim());
          const { data: matched } = await supabase.rpc("match_document_chunks", { query_embedding: queryEmbedding, match_threshold: 0.01, match_count: 5, filter_subject_id: targetSubjectId });
          if (matched) matched.forEach((c: any) => { if (c.content && !chunksFound.includes(c.content)) chunksFound.push(c.content); });
        }
      }
      if (chunksFound.length < 2) {
        const { data: docs } = await supabase.from("documents").select("id").eq("subject_id", targetSubjectId);
        if (docs && docs.length > 0) {
          const { data: directChunks } = await supabase.from("document_chunks").select("content").in("document_id", docs.map(d => d.id)).limit(15);
          if (directChunks) directChunks.forEach(c => { if (!chunksFound.includes(c.content)) chunksFound.push(c.content); });
        }
      }
    }

    const contextText = chunksFound.join("\n\n---\n\n").trim();
    let finalContext = contextText || `[GENERATE QUESTIONS FOR: ${courseName}]`;

    const activeSec = Array.isArray(sectionData) ? sectionData[0] : (sectionData || (Array.isArray(sections) ? sections[0] : sections) || body);
    
    const isMixedMode = mixedMode === true || String(mixedMode).toLowerCase() === "true" || sectionData?.mixedMode === true || activeSec?.mixedMode === true;
    const isSingleMode = singleMode === true || String(singleMode).toLowerCase() === "true" || sectionData?.singleMode === true || activeSec?.singleMode === true;

    const rawType = String(activeSec?.type || activeSec?.format || activeSec?.questionType || body?.type || body?.format || "objektif").toLowerCase();

    let questionType = sectionData?.type || activeSec?.type || "objektif";
    if (rawType.includes("objektif") || rawType.includes("mcq") || rawType.includes("pilihan") || rawType.includes("objective") || rawType.includes("a, b, c, d")) {
      questionType = "objektif";
    } else if (rawType.includes("true") || rawType.includes("benar") || rawType.includes("salah") || rawType.includes("false")) {
      questionType = "true_false";
    }

    const parseNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };
    const count = parseNum(sectionData?.count) || parseNum(activeSec?.count) || parseNum(body?.count) || 5;
    const beranak = parseNum(sectionData?.beranakCount) || parseNum(activeSec?.beranakCount) || parseNum(activeSec?.beranak) || parseNum(body?.beranakCount) || parseNum(body?.beranak) || 0;
    const biasaCount = Math.max(0, count - beranak);
    
    const bloomSpec = sectionData?.bloom || activeSec?.bloom || {};
    const c1 = parseNum(bloomSpec.C1);
    const c2 = parseNum(bloomSpec.C2);
    const c3 = parseNum(bloomSpec.C3);
    const c4 = parseNum(bloomSpec.C4);
    const c5 = parseNum(bloomSpec.C5);
    const c6 = parseNum(bloomSpec.C6);

    let formattedCOs = (Array.isArray(co) ? co : []).map(c => {
      let str = String(c).toUpperCase().trim();
      if (/^C\d+$/.test(str)) return str.replace('C', 'CO');
      if (/^CO\d+$/.test(str)) return str;
      return null;
    }).filter(Boolean);
    if (formattedCOs.length === 0) formattedCOs = ['CO1', 'CO2'];
    const coOptions = formattedCOs.join(', ');

    // ============================================================
    // PENGIRAAN MARKAH DINAMIK KHAS UNTUK ESEI / SUBJEKTIF
    // ============================================================
    const totalSectionMarks = parseNum(sectionData?.marks) || parseNum(activeSec?.marks) || 10;
    const marksPerQ = count > 0 ? totalSectionMarks / count : 1;
    
    let subCount = 1;
    let exactSubMarks = marksPerQ;

    if (isSingleMode) {
      // JIKA MOD SOALAN TUNGGAL DIAKTIFKAN: HANYA 1 SOALAN TUNGGAL DENGAN MARKAH FULL
      subCount = 1;
      exactSubMarks = marksPerQ;
    } else if (marksPerQ === 1) { subCount = 1; exactSubMarks = 1; }
    else if (marksPerQ === 1.5) { subCount = 1; exactSubMarks = 1.5; }
    else if (marksPerQ === 2) { subCount = 1; exactSubMarks = 2; }
    else if (marksPerQ === 2.5) { subCount = 1; exactSubMarks = 2.5; }
    else if (marksPerQ === 3) { subCount = 2; exactSubMarks = 1.5; }
    else if (marksPerQ === 3.5) { subCount = 1; exactSubMarks = 3.5; } 
    else if (marksPerQ === 4) { subCount = 2; exactSubMarks = 2; }
    else if (marksPerQ === 4.5) { subCount = 3; exactSubMarks = 1.5; }
    else if (marksPerQ === 5) { subCount = 2; exactSubMarks = 2.5; }
    else if (marksPerQ === 5.5) { subCount = 1; exactSubMarks = 5.5; } 
    else if (marksPerQ === 6) { subCount = 3; exactSubMarks = 2; }
    else if (marksPerQ === 7) { subCount = 2; exactSubMarks = 3.5; }
    else if (marksPerQ === 7.5) { subCount = 3; exactSubMarks = 2.5; }
    else if (marksPerQ === 8) { subCount = 4; exactSubMarks = 2; }
    else if (marksPerQ === 9) { subCount = 3; exactSubMarks = 3; }
    else if (marksPerQ === 10) { subCount = 4; exactSubMarks = 2.5; }
    else if (marksPerQ === 11) { subCount = 2; exactSubMarks = 5.5; }
    else if (marksPerQ === 12) { subCount = 4; exactSubMarks = 3; }
    else if (marksPerQ === 13) { subCount = 2; exactSubMarks = 6.5; }
    else if (marksPerQ === 14) { subCount = 4; exactSubMarks = 3.5; }
    else if (marksPerQ === 15) { subCount = 3; exactSubMarks = 5; }
    else if (marksPerQ === 16) { subCount = 4; exactSubMarks = 4; }
    else if (marksPerQ === 17) { subCount = 2; exactSubMarks = 8.5; }
    else if (marksPerQ === 18) { subCount = 4; exactSubMarks = 4.5; }
    else if (marksPerQ === 19) { subCount = 2; exactSubMarks = 9.5; }
    else if (marksPerQ === 20) { subCount = 4; exactSubMarks = 5; }
    else {
      subCount = 1;
      exactSubMarks = marksPerQ;
    }

    const subMarksDisplay = exactSubMarks % 1 === 0 ? exactSubMarks.toString() : exactSubMarks.toFixed(1);
    const subLabelsArr = Array.from({length: subCount}, (_, i) => String.fromCharCode(97 + i) + '.');
    const subLabelsStr = subLabelsArr.join(', ');

    const activeBloomLevels = Object.entries(bloomSpec)
      .filter(([_, cnt]) => Number(cnt) > 0)
      .map(([lvl]) => lvl.toUpperCase());

    let bloomVerbsInstruction = "";
    if (activeBloomLevels.length > 0 && questionType === "essay") {
      if (subCount > 1) {
         bloomVerbsInstruction = "\nARAHAN KATA TUGAS / KATA PERINTAH BLOOM (WAJIB GUNAKAN PADA ANAK SOALAN SAHAJA):\n";
      } else {
         bloomVerbsInstruction = "\nARAHAN KATA TUGAS / KATA PERINTAH BLOOM:\n";
      }
      activeBloomLevels.forEach(level => {
        if (BLOOM_VERBS_MAP[level]) {
          bloomVerbsInstruction += `- Aras ${level}: [${BLOOM_VERBS_MAP[level].join(", ")}]\n`;
        }
      });
    }

    let currentQNum = 1;
    let bloomMappingMs = "";
    let bloomMappingEn = "";
    let bloomMappingAr = "";

    const bloomCounts = [
      { level: 'C1', count: c1 }, { level: 'C2', count: c2 }, { level: 'C3', count: c3 },
      { level: 'C4', count: c4 }, { level: 'C5', count: c5 }, { level: 'C6', count: c6 }
    ];

    for (const b of bloomCounts) {
      for (let i = 0; i < b.count; i++) {
        
        let qFormatMs = "";
        let qFormatEn = "";
        let qFormatAr = "";

        if (questionType === "objektif") {
          if (currentQNum <= biasaCount) {
             const applyMixed = isMixedMode && (biasaCount > 0) && (currentQNum % 3 === 0 || (biasaCount < 3 && currentQNum === biasaCount));

             if (applyMixed) {
                 qFormatMs = "FORMAT WAJIB: SOALAN ANALISIS (WAJIB letak perkataan KECUALI, BUKAN, SALAH, atau BENAR di penghujung ayat soalan (Cth: 'Berikut adalah ciri X, KECUALI:'). DILARANG memulakan soalan dengan perkataan 'Yang'. A, B, C, D sahaja. DILARANG GUNA ITEM ROMAN). ";
                 qFormatEn = "MANDATORY FORMAT: ANALYSIS QUESTION (MUST place EXCEPT, NOT, FALSE, or TRUE at the end of the statement. DO NOT start the question with 'Which'. A, B, C, D only. NO ROMAN NUMERALS). ";
                 qFormatAr = "تنسيق إلزامي: سؤال تحليلي (يجب وضع كلمات مثل باستثناء، خاطئ، أو صحيح في نهاية الجملة. A, B, C, D فقط). ";
             } else {
                 qFormatMs = "FORMAT WAJIB: SOALAN BIASA TUNGGAL (A, B, C, D sahaja. DILARANG GUNA ITEM ROMAN i, ii, iii, iv). ";
                 qFormatEn = "MANDATORY FORMAT: REGULAR SINGLE QUESTION (A, B, C, D only. NO ROMAN NUMERALS i, ii, iii, iv). ";
                 qFormatAr = "تنسيق إلزامي: سؤال عادي فردي (A, B, C, D فقط. بدون أرقام رومانية). ";
             }

          } else {
             qFormatMs = "FORMAT WAJIB: SOALAN BERANAK / BERLAPIS (WAJIB MENGGUNAKAN ITEM ROMAN i, ii, iii, iv sebelum pilihan A, B, C, D). ";
             qFormatEn = "MANDATORY FORMAT: BRANCHED QUESTION (YOU MUST USE ROMAN NUMERALS i, ii, iii, iv before the A, B, C, D options). ";
             qFormatAr = "تنسيق إلزامي: سؤال مركب (يجب استخدام عناصر رومانية i, ii, iii, iv قبل خيارات A, B, C, D). ";
          }
        }

        bloomMappingMs += `- Soalan ${currentQNum}: ${qFormatMs}ARAS WAJIB: [${b.level}]. Bina soalan yang menguji kognitif ${b.level}. Kemudian, PILIH SATU tag CO dari senarai (${coOptions}) yang paling logik dan sepadan dengan rubrik Aras ${b.level}. Format baris akhir: [${b.level}] [CO_PILIHAN]\n`;
        bloomMappingEn += `- Question ${currentQNum}: ${qFormatEn}MANDATORY LEVEL: [${b.level}]. Construct a question that tests ${b.level}. Then, CHOOSE ONE CO tag from (${coOptions}) that logically matches the rubric for Level ${b.level}. Final line format: [${b.level}] [CHOSEN_CO]\n`;
        bloomMappingAr += `- السؤال ${currentQNum}: ${qFormatAr}المستوى الإلزامي: [${b.level}]. قم بصياغة سؤال يختبر ${b.level}. ثم اختر وسم CO واحد من (${coOptions}) يتوافق منطقياً مع معايير ${b.level}. التنسيق النهائي: [${b.level}] [CO_المختار]\n`;
        
        currentQNum++;
      }
    }

    let formatInstructions = "";

    if (isArabic) {
      if (questionType === "objektif") {
        let beranakRuleNoteAr = "";
        if (beranak === 0) {
          beranakRuleNoteAr = `\nتنبيه هام جداً: جميع الأسئلة الـ ${count} يجب أن تكون أسئلة عادية فقط. يُمنع منعاً باتاً إنشاء أسئلة مركبة تتضمن الترقيم الروماني (i, ii, iii, iv).`;
        } else if (beranak > 0 && biasaCount === 0) {
          beranakRuleNoteAr = `\nتنبيه هام جداً: جميع الأسئلة الـ ${count} (من السؤال 1 إلى ${count}) يجب أن تكون أسئلة مركبة (تتضمن الترقيم الروماني i, ii, iii, iv). لا تقم بإنشاء أي سؤال عادي!`;
        } else if (beranak > 0) {
          beranakRuleNoteAr = `\nتنبيه هام جداً لترتيب وكمية الأسئلة (يجب الالتزام به حرفياً):
- عدد الأسئلة العادية: ${biasaCount} أسئلة بالضبط. (الأسئلة المرقمة من 1 إلى ${biasaCount} يجب أن تكون أسئلة عادية فقط).
- عدد الأسئلة المركبة: ${beranak} أسئلة بالضبط. (الأسئلة المرقمة من ${biasaCount + 1} إلى ${count} يجب أن تكون أسئلة مركبة وتستخدم أرقام رومانية).
لا تقم بتغيير هذه الكميات!`;
        }

        formatInstructions = `
متطلبات العدد الصارمة:
- إجمالي الأسئلة: ${count} أسئلة بالضبط (مرقمة من 1 إلى ${count}).
- تحذير حرج: توقف عن التوليد فوراً بعد السؤال رقم ${count}.

${beranakRuleNoteAr}

خريطة التوزيع الصارمة (يجب الالتزام بها 100% لكل سؤال):
${bloomMappingAr}

تحذير صارم لهيكل الأسئلة الموضوعية:
1. يجب توفير خيارات الإجابة: يجب أن يحتوي كل سؤال موضوعي على 4 خيارات للإجابة (A، B، C، D). لا تقم أبداً بإنشاء سؤال بدون خيارات إجابة!
2. يُمنع صيغة "املأ الفراغ": يجب أن تنتهي الأسئلة بعلامة استفهام (؟). يُمنع إنهاء السؤال بنقطتين (:) أو نقاط حذف (...).
3. يمنع تكرار الأسئلة: يجب أن يكون كل سؤال في هذا الاختبار فريداً تماماً ولا يختبر نفس المعلومة مرتين.
4. يمنع الأسئلة الغامضة أو المعلقة: يجب أن يكون السؤال دقيقاً، يُمنع طرح أسئلة مثل "ما هو الجانب الأهم؟" دون تحديد الموضوع بوضوح.

تعليمات الأسئلة العادية:
- قاعدة المحاذاة: يجب وضع Tab (\\t) واحد مباشرة بعد رقم السؤال، و Tab (\\t) واحد قبل جميع الخيارات.
- يمنع استخدام خيار "جميع ما سبق" كخيار D.

مثال للأسئلة العادية (C1/C2 - لا توجد عبارة تقريرية):
1.\tما هو الهدف الرئيسي من الفلسفة؟

\tA. الخيار الأول
\tB. الخيار الثاني
\tC. الخيار الثالث
\tD. الخيار الرابع
\t[C1] [CO1]

تعليمات الأسئلة المركبة:
- السطر الأول الذي يحتوي على رقم السؤال يجب أن يكون عبارة تقريرية فقط وتنتهي بنقطة (.). لا تضع علامة استفهام (؟) في هذا السطر أبداً!
- ثم، اترك سطراً فارغاً واكتب السؤال الفعلي. يجب أن يكون السؤال مكتملاً.

[مثال صحيح - يجب اتباعه]:
2.\tيُعتبر الإجماع المصدر الثالث من مصادر التشريع الإسلامي.

\tبناءً على النص، ما هي شروط الإجماع لتحقيق هذا الهدف؟

\ti. اتفاق المجتهدين
\tii. الاعتماد على مستند
\tiii. صدوره من السلطة
\tiv. بعد وفاة النبي

\tA. i و ii
\tB. ii و iii
\tC. i، ii و iv
\tD. جميع ما ذكر
\t[C4] [CO2]`;
      } else if (questionType === "true_false") {
        formatInstructions = `صيغة صح أم خطأ (${count} أسئلة). 
- تحذير حرج: توقف عن التوليد فوراً بعد السؤال رقم ${count}.

${bloomMappingAr}
مثال:
1.\tيُعتبر القياس من الأدلة المتفق عليها عند جميع العلماء.

\t[صواب] [خطأ]
\t[C1] [CO1]`;
      } else {
        if (subCount > 1) {
           formatInstructions = `صيغة الأسئلة المقالية (${count} أسئلة). 
- تحذير حرج: توقف عن التوليد فوراً بعد السؤال رقم ${count}.
- توزيع الدرجات (إلزامي): كل سؤال رئيسي يساوي ${marksPerQ} درجات. يجب تقسيم كل سؤال رئيسي إلى ${subCount} أسئلة فرعية (${subLabelsStr}) بقيمة ${subMarksDisplay} درجات لكل سؤال فرعي.

${bloomMappingAr}
${bloomVerbsInstruction}

قواعد المقال:
1. يجب أن يبدأ السؤال الرئيسي (رقم 1 ، 2 ...) ببيان / جملة تقريرية كاملة. يُمنع منعاً باتاً بدء السؤال الرئيسي بكلمة أمر أو سؤال!
2. تُستخدم أفعال بلوم فقط في الأسئلة الفرعية (${subLabelsStr}).

مثال:
1.\tتلعب أصول الفقه دوراً محورياً في ضبط عملية الاجتهاد واستنباط الأحكام الشرعية. (هذه جملة تقريرية)

${subLabelsArr.map(lbl => `\t${lbl} ناقش / بين ... (${subMarksDisplay} درجات)`).join('\n')}
\t[C4] [CO2]`;
        } else {
           formatInstructions = `صيغة الأسئلة المقالية (${count} أسئلة). 
- تحذير حرج: توقف عن التوليد فوراً بعد السؤال رقم ${count}.
- توزيع الدرجات (إلزامي): كل سؤال رئيسي يساوي ${marksPerQ} درجات بدون أي تقسيم فرعي.

${bloomMappingAr}
${bloomVerbsInstruction}

قواعد المقال:
1. هذا سؤال مباشر لا يحتوي على تقسيمات فرعية (a, b). اكتب السؤال مباشرة مع ذكر الدرجة (${subMarksDisplay} درجات).

مثال:
1.\tناقش أهمية القواعد الأصولية في فهم النصوص الشرعية. (${subMarksDisplay} درجات)
\t[C4] [CO2]`;
        }
      }
    } else if (isEnglish) {
      if (questionType === "objektif") {
        let beranakRuleNoteEng = "";
        if (beranak === 0) {
          beranakRuleNoteEng = `\nCRITICAL WARNING: ALL ${count} questions MUST be REGULAR SINGLE objective questions. DO NOT generate any branched questions.`;
        } else if (beranak > 0 && biasaCount === 0) {
          beranakRuleNoteEng = `\nCRITICAL ORDER WARNING: ALL ${count} questions (From Question 1 to ${count}) MUST be BRANCHED questions (with roman numerals). DO NOT generate any regular questions!`;
        } else if (beranak > 0) {
          beranakRuleNoteEng = `\nCRITICAL ORDER AND QUANTITY WARNING (YOU MUST STRICTLY FOLLOW THIS):
- REGULAR QUESTIONS AMOUNT: Exactly ${biasaCount} questions. (Question numbers 1 to ${biasaCount} MUST be REGULAR objective questions).
- BRANCHED QUESTIONS AMOUNT: Exactly ${beranak} questions. (Question numbers ${biasaCount + 1} to ${count} MUST be BRANCHED objective questions with roman numerals).
DO NOT change these exact amounts!`;
        }

        formatInstructions = `
STRICT QUANTITY REQUIREMENT:
- TOTAL QUESTIONS: EXACTLY ${count} QUESTIONS.
- CRITICAL WARNING: STOP GENERATING IMMEDIATELY AFTER QUESTION ${count}.

${beranakRuleNoteEng}

STRICT BLOOM'S TAXONOMY INDEX MAPPING:
${bloomMappingEn}

STRICT OBJECTIVE STRUCTURE WARNING (MUST READ):
1. MUST HAVE OPTIONS: Every objective question MUST have exactly 4 answer options (A, B, C, and D). NEVER generate a question without answer options!
2. NO FILL-IN-THE-BLANK: Questions MUST end with a question mark (?). DO NOT end questions with a colon (:) or ellipsis (...). Example of FORBIDDEN: 'Education refers to:'. Example of CORRECT: 'What is the definition of education?'.
3. NO REPEATED QUESTIONS: Every question MUST be strictly unique. Do not repeat facts, concepts, or wording in the same set.
4. NO VAGUE QUESTIONS: Avoid generic hanging questions like 'What is the most important aspect?'. Be highly specific in the question statement.
5. NO DOUBLE QUESTIONS: DO NOT ask two separate questions (two question marks '?') in the same item.
6. C1 & C2 QUESTIONS: DO NOT use declarative statements for C1 and C2. You MUST start directly with the question (e.g., "What is...", "How does...").
7. PARAGRAPH SPACING (CRITICAL): For Regular Questions, write the question stem ending with '?'. THEN LEAVE ONE BLANK LINE (ENTER) and indent Option A with 1 TAB (\\t). NEVER place Option A on the same line as the question!

REGULAR OBJECTIVE INSTRUCTIONS:
- Line 1: Question Number + Question Stem (ending with ?).
- NO "ALL OF THE ABOVE": You are STRICTLY FORBIDDEN to use "All of the above" or "None of the above" as option D in regular single questions. Option D MUST be a valid factual distractor.
- LEAVE ONE BLANK LINE (ENTER).
- Options MUST start on new lines indented with 1 TAB (\\t): \\tA. ..., \\tB. ..., \\tC. ..., \\tD. ...

EXAMPLE for C3-C6 (Statement and Question merged):
1.\tIntegration serves as a foundational concept. How is this concept applied in advanced calculus?

\tA. As the limit of the rate
\tB. As the maximum value
\tC. As the definite integral
\tD. As the static slope
\t[C3] [CO2]

BRANCHED OBJECTIVE INSTRUCTIONS:
- Line 1: Factual Statement / Scenario ending with a period (.). DO NOT put a question mark (?) or question words on this first line!
- Line 2: LEAVE A BLANK LINE (ENTER), and type 1 TAB (\\t) followed by ONLY ONE MAIN QUESTION STATEMENT (e.g. "\\tWhich of the following represents the most accurate combination?").
- Line 3: LEAVE A BLANK LINE (ENTER), and type 1 TAB (\\t) followed by Roman Numeral Items (\\ti., \\tii., \\tiii., \\tiv.).
- Line 4: Options (\\tA., \\tB., \\tC., \\tD.). (Here, "D. All of the above" IS allowed).
- Line 5: JSU Tag.

[CORRECT EXAMPLE - MUST FOLLOW]:
2.\tThe function f(x) = x^2 represents a parabola.

\tBased on the statement above, which properties are the most accurate?

\ti. The value equals 6
\tii. The rate of change is positive
\tiii. The function is strictly increasing
\tiv. The derivative is undefined

\tA. i and ii
\tB. ii and iii
\tC. i, ii, and iii
\tD. All of the above
\t[C4] [CO2]`;
      } else if (questionType === "true_false") {
        formatInstructions = `Format True / False (${count} questions). 
- CRITICAL WARNING: STOP GENERATING IMMEDIATELY AFTER QUESTION ${count}.

${bloomMappingEn}
EXAMPLE:
1.\tThe derivative of a constant function is always zero.

\t[TRUE] [FALSE]
\t[C1] [CO1]`;
      } else {
        if (subCount > 1) {
           formatInstructions = `Format Essay (${count} questions).
- CRITICAL WARNING: STOP GENERATING IMMEDIATELY AFTER QUESTION ${count}.

${bloomMappingEn} 
${bloomVerbsInstruction}

RULES FOR ESSAY:
1. MARKS DISTRIBUTION (MANDATORY): Each main question is worth ${marksPerQ} marks. You MUST split each main question into exactly ${subCount} sub-questions (${subLabelsStr}) worth ${subMarksDisplay} Marks each.
2. The main stem (number 1, 2...) MUST ONLY be a DECLARATIVE FACTUAL STATEMENT ending with a full stop (.). DO NOT start the main stem with a question or command word, and NEVER end it with a question mark (?)!
3. Bloom's command verbs MUST ONLY be used in the sub-questions (${subLabelsStr}).

EXAMPLE:
1.\tIntegration serves as a foundational concept in advanced calculus. (THIS IS A FACTUAL STATEMENT)

${subLabelsArr.map(lbl => `\t${lbl} Explain / Derive ... (${subMarksDisplay} Marks)`).join('\n')}
\t[C4] [CO2]`;
        } else {
           formatInstructions = `Format Essay (${count} questions).
- CRITICAL WARNING: STOP GENERATING IMMEDIATELY AFTER QUESTION ${count}.

${bloomMappingEn} 
${bloomVerbsInstruction}

RULES FOR ESSAY:
1. MARKS DISTRIBUTION (MANDATORY): This is a direct single question format without sub-divisions (no a, b). Do not split the question. State the full mark (${subMarksDisplay} Marks) directly at the end.

EXAMPLE:
1.\tExplain the process of evaluating a definite integral. (${subMarksDisplay} Marks)
\t[C4] [CO2]`;
        }
      }
    } else {
      if (questionType === "objektif") {
        let beranakRuleNote = "";
        if (beranak === 0) {
          beranakRuleNote = `\nAMARAN SANGAT KETAT: KESEMUA ${count} soalan MESTILAH SOALAN BIASA TUNGGAL. DILARANG KERAS menghasilkan sebarang soalan beranak/berlapis.`;
        } else if (beranak > 0 && biasaCount === 0) {
          beranakRuleNote = `\nAMARAN KETAT SUSUNAN: KESEMUA ${count} soalan MESTILAH SOALAN BERANAK (beritem roman i, ii, iii, iv). JANGAN jana soalan biasa!`;
        } else if (beranak > 0) {
          beranakRuleNote = `\nAMARAN KETAT SUSUNAN & KUANTITI SOALAN (ANDA WAJIB PATUH 100%):
- JUMLAH SOALAN BIASA: Tepat ${biasaCount} soalan. (Soalan nombor 1 hingga ${biasaCount} MESTILAH SOALAN BIASA SAHAJA tanpa item roman).
- JUMLAH SOALAN BERANAK: Tepat ${beranak} soalan. (Soalan nombor ${biasaCount + 1} hingga ${count} MESTILAH SOALAN BERANAK beritem roman i, ii, iii, iv).
DILARANG menambah atau mengurangkan kuantiti ini!`;
        }

        formatInstructions = `
PENGATURAN KUANTITI SOALAN (AMARAN SANGAT MUTLAK):
- JUMLAH KESELURUHAN SOALAN: TEPAT ${count} SOALAN SAHAJA.
- AMARAN KERAS: ANDA WAJIB BERHENTI MENJANA SEBAIK SAHAJA SOALAN KE-${count} SELESAI!

${beranakRuleNote}

PETA SUSUNAN ARAS BLOOM & RUBRIK CO (WAJIB DIPATUHI 100%):
${bloomMappingMs}

AMARAN KERAS STRUKTUR & TATABAHASA SOALAN OBJEKTIF (WAJIB BACA):
1. WAJIB ADA PILIHAN JAWAPAN (A, B, C, D): Setiap soalan yang dijana WAJIB mempunyai tepat 4 pilihan jawapan.
2. DILARANG SAMA SEKALI DUA SOALAN TERGABUNG: DILARANG mengulang kata tanya dua kali (cth: 'Bagaimanakah langkah... Bagaimanakah antara berikut...'). Hanya SATU soalan utama dibenarkan per nombor soalan!
3. HARAM MENGGUNAKAN FORMAT "ISI TEMPAT KOSONG": Soalan WAJIB berakhir dengan tanda soal (?). DILARANG KERAS menamatkan soalan dengan titik bertindih (:) atau titik-titik elipsis (...). Contoh SALAH: "Dekolonisasi merujuk kepada:". Contoh BETUL: "Apakah yang dimaksudkan dengan dekolonisasi dalam pendidikan?".
4. SOALAN MESTI SPESIFIK & LENGKAP: DILARANG menggunakan soalan umum atau tergantung seperti "Apakah aspek yang paling penting?". Terus nyatakan subjek dalam ayat tanya secara spesifik.
5. DILARANG SOALAN BERULANG (ANTI-REPETITION): Setiap soalan dalam set ini WAJIB unik dan menyentuh konsep berbeza. DILARANG KERAS MENGULANG konsep, fakta, atau tajuk yang sama bagi mengelakkan pertindihan soalan. Jika Soalan 1 sudah bertanya tentang Topik A, Soalan 2 WAJIB cari Topik B dari nota.
6. GAYA SOALAN C1 & C2: DILARANG menggunakan sebarang ayat penyata (stimulus) di awal soalan bagi aras C1 dan C2. WAJIB terus gunakan soalan langsung (Direct Question).
7. GAYA SOALAN C3 HINGGA C6: DIBENARKAN memulakan soalan dengan SATU ayat penyata ringkas, diikuti dengan persoalan. (Guna dengan kadar terkawal).
8. "Siapakah" HANYA KHUSUS untuk orang atau tokoh. DILARANG menggunakan "Siapakah" untuk benda atau konsep.
9. DILARANG menggunakan soalan tergantung seperti "dalam artikel ini" atau "dalam petikan ini".
10. HARAM MENGGUNAKAN IMBUHAN "-lah": DILARANG SAMA SEKALI menggunakan perkataan berimbuhan seperti "Analisislah", "Jelaskanlah". Soalan objektif mestilah bertanyakan soalan secara terus.

ARAHAN SOALAN BIASA (LANGSUNG / TUNGGAL):
- SOALAN MESTI BERCANTUM: Ayat penyata dan ayat pertanyaan mesti berada dalam satu perenggan yang sama terus di sebelah nombor soalan.
- HARAM PENGGUNAAN JAWAPAN D YANG MUDAH DITEKA: DILARANG KERAS menggunakan pilihan "Semua di atas", "Tiada satu pun di atas", atau "A dan B betul" pada pilihan jawapan D bagi soalan tunggal! Pilihan D WAJIB mengandungi teks fakta distraktor yang sah.
- SUSUNAN BARIS WAJIB:
  Baris 1: Nombor Soalan + Ayat Penyata & Ayat Soalan (diakhiri dengan TANDA SOAL ? SAHAJA. HARAM guna titik bertindih :).
  <ENTER JARAK / SELANG SEBARIS>
  Baris 2: \tA. Pilihan A
  Baris 3: \tB. Pilihan B
  Baris 4: \tC. Pilihan C
  Baris 5: \tD. Pilihan D
  Baris 6: \t[C...] [CO...]

AMARAN MUTLAK: PILIHAN JAWAPAN 'A.' WAJIB BERMULA DI BARIS BAHARU SELEPAS SELANG SEBARIS (ENTER) BERSERTA 1 TAB (\t)! DILARANG KERAS MELETAKKAN PILIHAN 'A.' DI BARIS YANG SAMA DENGAN TEKS SOALAN!

CONTOH LENGKAP C3-C6 (Penyata & Soalan Bercantum):
1.\tFalsafah Pendidikan Kebangsaan menekankan aspek keseimbangan. Bagaimanakah aspek ini diterapkan dalam kurikulum sekolah?

\tA. Melalui pengasingan subjek sains dan sastera
\tB. Melalui penawaran subjek pendidikan rohani
\tC. Melalui penglibatan pelajar dalam aktiviti kokurikulum secara holistik
\tD. Mengurangkan waktu pembelajaran teori khusus
\t[C3] [CO2]

ARAHAN SOALAN BERANAK (BERLAPIS - WAJIB PATUH SUSUNAN KETAT):
- Baris 1: Nombor Soalan + Ayat Penyata Fakta / Senario Lengkap diakhiri dengan TITIK (.) SAHAJA. DILARANG KERAS meletakkan kata tanya ('Apakah'/'Bagaimanakah') atau tanda soal (?) di Baris 1 ini!
- <ENTER JARAK / SELANG SEBARIS> + DITAIP 1 TAB (\\t) + SATU AYAT SOALAN UTAMA LENGKAP BERSERTA TANDA SOAL (cth: "\\tApakah antara berikut yang paling tepat...", "\\tApakah langkah yang perlu diambil...?"). HARAM menamatkan ayat utama dengan titik bertindih (:).
- <ENTER JARAK / SELANG SEBARIS> + DITAIP 1 TAB (\\t) + ITEM ROMAN (\\ti. ..., \\tii. ..., \\tiii. ..., \\tiv. ...).
- Pilihan Jawapan A, B, C, D (\\tA. ..., \\tB. ..., \\tC. ..., \\tD. ...). (Bagi soalan beranak, pilihan gabungan "D. Semua di atas" adalah DIBENARKAN).
- Tag JSU (\\t[C...] [CO...]).

AMARAN KERAS: DILARANG MENGGABUNGKAN AYAT SOALAN UTAMA KE BARIS PERTAMA SOALAN BERANAK ATAU MENGULANGNYA BERSAMA AYAT PENYATA! AYAT SOALAN UTAMA WAJIB BERADA DI BARIS KEDUA BERSERTA 1 TAB (\\t) DAN MEMPUNYAI SELANG SEBARIS (ENTER) SEBELUM DAN SELEPASNYA!

[CONTOH BETUL SOALAN BERANAK - WAJIB PATUH 100%]:
2.\tPendidikan yang berteraskan Falsafah Pendidikan Kebangsaan perlu mengambil kira pelbagai aspek penting.

\tManakah antara berikut merupakan aspek yang paling utama bagi mencapai hasrat tersebut?

\ti. Kurikulum yang inklusif
\tii. Pengajaran bahasa ibunda
\tiii. Pendidikan moral
\tiv. Sistem penaksiran holistik

\tA. i dan ii
\tB. ii dan iii
\tC. i, ii dan iii
\tD. Semua di atas
\t[C4] [CO2]`;
      } else if (questionType === "true_false") {
        formatInstructions = `Format Benar / Salah (${count} soalan). 
- AMARAN KERAS: ANDA WAJIB BERHENTI MENJANA SEBAIK SAHAJA SOALAN KE-${count} SELESAI.

${bloomMappingMs}
CONTOH WAJIB:
1.\tAspirasi negara bangsa adalah penting.

\t[BENAR] [SALAH]
\t[C1] [CO1]`;
      } else {
        if (subCount > 1) {
           formatInstructions = `Format Esei (${count} soalan). 
- AMARAN KERAS: ANDA WAJIB BERHENTI MENJANA SEBAIK SAHAJA SOALAN KE-${count} SELESAI.

${bloomMappingMs}
${bloomVerbsInstruction}

PERATURAN FORMAT ESEI & TATABAHASA (AMARAN KERAS MUTLAK):
1. PENGIRAAN MARKAH (WAJIB PATUH): Setiap soalan utama bernilai ${marksPerQ} markah. Anda WAJIB memecahkan setiap soalan utama kepada TEPAT ${subCount} anak soalan (${subLabelsStr}) dengan nilai ${subMarksDisplay} Markah setiap satu!
2. KEPALA SOALAN (sebelah nombor 1, 2, 3...) WAJIB merupakan AYAT PENYATA LENGKAP (Fakta/Stimulus) yang DITAMATKAN DENGAN TITIK (.). DILARANG SAMA SEKALI memulakan kepala soalan dengan kata perintah, dan DILARANG mengakhirinya dengan tanda soal (?)!
3. KATA PERINTAH BLOOM HANYA BOLEH DIGUNAKAN PADA ANAK SOALAN (${subLabelsStr}) SAHAJA. (Pastikan ia adalah ayat perintah murni bebas imbuhan Me, Meng, Men - Contoh yang betul: "Bincangkan", "Huraikan", "Nilaikan", "Rekaciptakan").

CONTOH STRUKTUR ESEI WAJIB PATUH:
1.\tPendidikan memainkan peranan signifikan dalam pembangunan negara dan pembentukan jati diri bangsa. (INI ADALAH AYAT PENYATA LENGKAP)

${subLabelsArr.map(lbl => `\t${lbl} Bincangkan / Huraikan ... (${subMarksDisplay} Markah)`).join('\n')}
\t[C4] [CO2]`;
        } else {
           formatInstructions = `Format Esei (${count} soalan). 
- AMARAN KERAS: ANDA WAJIB BERHENTI MENJANA SEBAIK SAHAJA SOALAN KE-${count} SELESAI.

${bloomMappingMs}
${bloomVerbsInstruction}

PERATURAN FORMAT ESEI & TATABAHASA (AMARAN KERAS MUTLAK):
1. PENGIRAAN MARKAH (WAJIB PATUH): Ini adalah format soalan langsung berstruktur tanpa pecahan anak soalan (tiada a, b). Anda DILARANG memecahkan soalan ini. Nyatakan terus markah penuh (${subMarksDisplay} Markah) pada hujung soalan.

CONTOH STRUKTUR ESEI WAJIB PATUH:
1.\tBincangkan peranan pendidikan dalam memupuk patriotisme kebangsaan. (${subMarksDisplay} Markah)
\t[C4] [CO2]`;
        }
      }
    }

    let mixedModeInstAr = "";
    let mixedModeInstEn = "";
    let mixedModeInstMs = "";

    if (isMixedMode) {
      mixedModeInstAr = `1. الوضع المختلط (هام جداً):
   - سيتم تحديد بعض الأسئلة على أنها أسئلة استثناء أو تأكيد (في الخريطة أدناه).
   - تنسيق الجملة: يُمنع بدء السؤال بكلمات استفهام غير مناسبة. استخدم بنية مثل "العبارات التالية صحيحة باستثناء:".
   
2. القائمة السوداء للمشتتات (تحذير مطلق!):
   - يُمنع منعاً باتاً استخدام كلمات النفي أو الاستبعاد بأي شكل من أشكالها (مثل: "تجاهل"، "إهمال"، "فقط"، "دون"، "عدو"، "إلغاء"، "عزل") في أي خيار خاطئ. يجب أن تكون الخيارات الخاطئة مصاغة بلغة أكاديمية إيجابية ولكنها غير صحيحة علمياً.
   - [مثال سيء - ممنوع]: "تجاهل احتياجات الفرد" / "التعليم التقني فقط".
   - [مثال جيد - إلزامي]: "تحديد قيود عمرية وقدرات بدنية معينة" / "التركيز على الإنجازات الفنية الفردية".

3. الجملة التقريرية للأسئلة المركبة:
   - يجب أن يكون السطر الأول للأسئلة المركبة جملة تقريرية كاملة (لا تقل عن 6 كلمات) تنتهي بنقطة (.). يُمنع استخدام الجمل المعلقة.`;
      
      mixedModeInstEn = `1. MIXED DISTRIBUTION RULE:
   - You will be instructed to generate specific questions as Analytical Verification/Exception questions in the mapping below.
   - SENTENCE FORMAT: DO NOT start negative questions with poorly phrased interrogatives. Use proper phrasing like "All of the following are elements of X, EXCEPT:".
   
2. DISTRACTOR BLACKLIST & QUALITY (ABSOLUTE WARNING!):
   - YOU ARE STRICTLY FORBIDDEN from using cheap exclusion words or their root forms (e.g., "ignore", "ignoring", "only", "solely", "without", "eliminate", "isolate", "isolation", "enemy") in ANY wrong option. Wrong options MUST sound highly academic, positive, and plausible.
   - [BAD EXAMPLE - FORBIDDEN]: "Ignoring individual needs" / "Technical education solely" / "Isolating subjects".
   - [GOOD EXAMPLE - MANDATORY]: "Setting specific age and physical capacity limits" / "Standardizing a single assessment method for all levels" / "Focusing on individual technical achievements".

3. BRANCHED QUESTION STEMS:
   - The first line of a branched question MUST be a COMPLETE declarative sentence (at least 6 words) ending with a full stop (.). DO NOT use hanging sentences (e.g., "which is meant by X.").`;
      
      mixedModeInstMs = `1. MOD CAMPURAN (ANALISIS PENGESAHAN & PENGECUALIAN):
   - Anda akan diarahkan untuk membina soalan berbentuk Analisis Pengecualian / Pengesahan secara spesifik pada pemetaan soalan di bawah.
   - FORMAT AYAT: DILARANG SAMA SEKALI memulakan soalan dengan perkataan "Yang". Gunakan struktur seperti "Berikut adalah elemen penting X, KECUALI:" atau "Pernyataan manakah yang BENAR mengenai X?".

2. TIGA (3) PERATURAN EMAS DISTRAKTOR (SANGAT PENTING):
   - ATURAN KONSEP RAKAN (PEER CONCEPTS): Distraktor WAJIB dari kategori domain/topik yang sama.
   - SINTAKSIS SELARI (PARALLEL SYNTAX): Keempat-empat pilihan (A, B, C, D) WAJIB bermula dengan struktur tatabahasa yang sama dan ukuran kepanjangan yang setara.

3. SENARAI HITAM KATA AKAR PENOLAK (AMARAN KERAS MUTLAK!):
   - Anda HARAM menggunakan sebarang bentuk kata akar 'abai' (mengabaikan, pengabaian, terabai), 'asing' (mengasingkan, pengasingan), 'hanya', 'sahaja', 'semata-mata', 'hapus' (menghapuskan, penghapusan), 'tidak sah', 'tanpa', atau 'musuh' dalam MANA-MANA pilihan jawapan salah!
   - DISTRAKTOR WAJIB PLAUSIBLE & POSITIF: Pilihan jawapan salah MESTI berbunyi akademik, profesional, menggunakan kata kerja positif (seperti menyediakan, memfokuskan, menyelaras, menetapkan) tetapi KONSEP/FAKTANYA SALAH.
   - [CONTOH DISTRAKTOR BURUK / HARAM DIGUNAKAN]: "Mengabaikan keperluan individu" / "Pendidikan teknikal semata-mata" / "Pengasingan subjek akademik".
   - [CONTOH DISTRAKTOR BERKUALITI / WAJIB DITIRU]: "Menetapkan had umur dan keupayaan fizikal yang khusus" / "Menyeragamkan kaedah pentaksiran tunggal bagi semua tahap" / "Memfokuskan penawaran program elit khas".

4. AYAT PENYATA SOALAN BERANAK:
   - Baris pertama soalan beranak WAJIB satu ayat penyata/fakta LENGKAP sekurang-kurangnya 6 perkataan dan berakhir dengan noktah (.). DILARANG meletakkan ayat tergantung (Contoh salah: "yang dimaksudkan dengan X.").`;
    } else {
      mixedModeInstAr = `1. عناصر السيناريو القياسية:
   - يجب صياغة 50% على الأقل من الأسئلة كسيناريوهات واقعية أو دراسات حالة عملية.
   - يُمنع منعاً باتاً إنشاء أسئلة استثناء أو تأكيد.
   
2. القائمة السوداء للمشتتات (تحذير مطلق!):
   - يُمنع منعاً باتاً استخدام كلمات النفي أو الاستبعاد بأي شكل من أشكالها (مثل: "تجاهل"، "إهمال"، "فقط"، "دون"، "عدو"، "إلغاء"، "عزل") في أي خيار خاطئ. يجب أن تكون الخيارات الخاطئة مصاغة بلغة أكاديمية إيجابية ولكنها غير صحيحة علمياً.
   - [مثال سيء - ممنوع]: "تجاهل قواعد اللعبة" / "الترفيه فقط" / "عزل المواد".
   - [مثال جيد - إلزامي]: "التركيز على تكثيف التدريب البدني للفوز" / "توحيد طرق التقييم لجميع المستويات".

3. الجملة التقريرية للأسئلة المركبة:
   - يجب أن يكون السطر الأول للأسئلة المركبة جملة تقريرية كاملة (لا تقل عن 6 كلمات) تنتهي بنقطة (.). يُمنع استخدام الجمل المعلقة.`;
      
      mixedModeInstEn = `1. STANDARD SCENARIO RULE:
   - You MUST generate at least 50% of the questions as REALISTIC SCENARIOS, CHARACTER-BASED SITUATIONS.
   - YOU ARE STRICTLY FORBIDDEN from generating Exception/Negative questions (e.g., "EXCEPT", "NOT", "FALSE") or Verification questions (e.g., "TRUE").
   
2. DISTRACTOR BLACKLIST & QUALITY (ABSOLUTE WARNING!):
   - YOU ARE STRICTLY FORBIDDEN from using cheap exclusion words or their root forms (e.g., "ignore", "ignoring", "only", "solely", "without", "eliminate", "isolate", "isolation", "enemy") in ANY wrong option. Wrong options MUST sound highly academic, positive, and plausible.
   - [BAD EXAMPLE - FORBIDDEN]: "Ignoring game rules" / "Entertainment solely" / "Isolating subjects".
   - [GOOD EXAMPLE - MANDATORY]: "Maximizing physical training intensity for victory" / "Standardizing a single assessment method for all levels".

3. BRANCHED QUESTION STEMS:
   - The first line of a branched question MUST be a COMPLETE declarative sentence (at least 6 words) ending with a full stop (.). DO NOT use hanging sentences (e.g., "which is meant by X.").`;
      
      mixedModeInstMs = `1. BENTUK SOALAN (STANDARD & SITUASI):
   - Anda WAJIB menggubal sekurang-kurangnya 50% daripada jumlah soalan dalam BENTUK SITUASI REKAAN REALISTIK, SENARIO WATAK (seperti "Ahmad menghadapi situasi...").
   - DILARANG KERAS menggunakan soalan berbentuk Analisis Pengecualian (seperti "KECUALI", "BUKAN", "SALAH") atau Analisis Pengesahan (seperti "BENAR").

2. TIGA (3) PERATURAN EMAS DISTRAKTOR (SANGAT PENTING):
   - ATURAN KONSEP RAKAN (PEER CONCEPTS): Distraktor WAJIB dari kategori domain/topik yang sama.
   - SINTAKSIS SELARI (PARALLEL SYNTAX): Keempat-empat pilihan (A, B, C, D) WAJIB bermula dengan struktur tatabahasa yang sama dan ukuran kepanjangan yang setara.

3. SENARAI HITAM KATA AKAR PENOLAK (AMARAN KERAS MUTLAK!):
   - Anda HARAM menggunakan sebarang bentuk kata akar 'abai' (mengabaikan, pengabaian, terabai), 'asing' (mengasingkan, pengasingan), 'hanya', 'sahaja', 'semata-mata', 'hapus' (menghapuskan, penghapusan), 'tidak sah', 'tanpa', atau 'musuh' dalam MANA-MANA pilihan jawapan salah!
   - DISTRAKTOR WAJIB PLAUSIBLE & POSITIF: Pilihan jawapan salah MESTI berbunyi akademik, profesional, menggunakan kata kerja positif (seperti menyediakan, memfokuskan, menyelaras, menetapkan) tetapi KONSEP/FAKTANYA SALAH.
   - [CONTOH DISTRAKTOR BURUK / HARAM DIGUNAKAN]: "Mengabaikan peraturan permainan" / "Hiburan semata-mata" / "Pengasingan subjek".
   - [CONTOH DISTRAKTOR BERKUALITI / WAJIB DITIRU]: "Memaksimumkan intensiti latihan fizikal untuk kemenangan" / "Menyeragamkan kaedah pentaksiran tunggal bagi semua tahap".

4. AYAT PENYATA SOALAN BERANAK:
   - Baris pertama soalan beranak WAJIB satu ayat penyata/fakta LENGKAP sekurang-kurangnya 6 perkataan dan berakhir dengan noktah (.). DILARANG meletakkan ayat tergantung (Contoh salah: "yang dimaksudkan dengan X.").`;
    }

    let systemPrompt = "";
    if (isArabic) {
      systemPrompt = `أنت خبير في إعداد الامتحانات الجامعية (UiTM) لمادة ${courseCode} - ${courseName}.
شرط اللغة الصارم: يجب عليك إنشاء جميع الأسئلة والنصوص والخيارات والفقرات بنسبة 100% باللغة العربية.

ARAHAN PENGIKATAN DOKUMEN / NOTA:
1. يجب عليك إنشاء الأسئلة بناءً على النص المرفق أدناه فقط بنسبة 100%. (استثناء: يسمح لك بإنشاء أسماء شخصيات أو مواقف خيالية من أجل أسئلة السيناريو التطبيقية).
2. يُمنع منعاً باتاً اختراع أو إدخال أي مواضيع عامة خارج نطاق النص المرفق.

عناصر التنويع وجودة المشتتات (إلزامي 100%):
${mixedModeInstAr}

3. الإملاء: تأكد من كتابة الكلمات بشكل صحيح.

${RUBRIK_AKADEMIK}

قم بإنشاء ${count} أسئلة بالضبط.
${formatInstructions}

قواعد مطلقة:
1. وسم JSU الكامل يجب وضعه في السطر الأخير لكل سؤال ويكون محاذى بـ Tab (\\t). (وسمين فقط: مستويات بلوم و CO).
2. يُمنع استخدام النجوم (* أو **) أو الرمز (#).
3. يمنع منعا باتا كتابة عناوين رئيسية مثل "نموذج الإجابة..." أو أي تعليقات أو تبريرات داخل ورقة الأسئلة.
4. للأسئلة الموضوعية: يجب عليك توفير 4 خيارات (A, B, C, D) لكل سؤال. لا تترك أي سؤال بدون خيارات.
5. توزيع المواضيع: يجب تنويع الأسئلة لتشمل جميع المواضيع في النص المعطى بشكل متوازن. لا تركز فقط على موضوع واحد إذا كانت هناك مواضيع أخرى.
6. تحذير أخير: يُمنع منعاً باتاً استخدام كلمات مثل "تجاهل"، "فقط"، "دون" في الخيارات (A, B, C, D).

سياق الملاحظات:
${finalContext}`;
    } else if (isEnglish) {
      systemPrompt = `You are a University Examination Question Setter (UiTM) for ${courseCode} - ${courseName}.
CRITICAL LANGUAGE MANDATE: You MUST generate ALL questions, statements, options, and text 100% ENTIRELY IN ENGLISH.

STRICT CONTEXT GROUNDING RULE:
1. You MUST generate questions 100% EXCLUSIVELY and STRICTLY based on the facts present in the COURSE NOTES / CONTEXT provided below. (Exception: You are allowed to invent scenario situations or character names for practical application questions).
2. DO NOT hallucinate or introduce outside general knowledge facts!

MIXED MODE DISTRIBUTION & STRICT DISTRACTOR QUALITY (100% MANDATORY):
${mixedModeInstEn}

3. SPELLING: Ensure proper academic spelling throughout.

${RUBRIK_AKADEMIK}

GENERATE EXACTLY ${count} QUESTIONS ONLY.
${formatInstructions}

ABSOLUTE RULES:
1. FULL JSU TAG MUST be placed at the very bottom line of every question and MUST be indented with 1 tab (\\t). (EXACTLY 2 TAGS: Bloom and CO).
2. DO NOT use bullet points (* or **) or hashtags (#).
3. STRICT PROHIBITION: DO NOT write any title headers (such as "QUESTION PAPER..."), comments, rationale, or Bloom's explanations. ONLY output the questions, options, and the final tag.
4. FOR OBJECTIVE QUESTIONS: You MUST provide 4 options (A, B, C, D) for every single question. NEVER leave a question without options.
5. TOPIC DISTRIBUTION: You MUST vary the questions to cover ALL topics provided in the context evenly. DO NOT focus repeatedly on a single topic if other topics are present.
6. FINAL WARNING: DO NOT use the words "ignore", "solely", or "only" in ANY of the options A, B, C, D.

COURSE NOTES CONTEXT:
${finalContext}`;
    } else {
      systemPrompt = `Anda adalah Pakar Penggubal Soalan Peperiksaan Universiti (UiTM) bagi ${courseCode} - ${courseName} dalam ${language}.

ARAHAN PENGIKATAN DOKUMEN / NOTA (STRICT CONTEXT GROUNDING MUTLAK):
1. Anda WAJIB menggubal soalan 100% BERDASARKAN DAN BERSUMBERKAN TEKS NOTA KURSUS di bawah SAHAJA. (Pengecualian: Anda DIBENARKAN mencipta nama watak atau situasi rekaan HANYA untuk tujuan membina soalan berbentuk senario/Kajian Kes, asalkan FAKTA JAWAPAN masih bersumberkan nota).
2. DILARANG SAMA SEKALI mereka-reka atau membawa masuk fakta am di luar kandungan dokumen!

ARAHAN VARIASI SOALAN & KUALITI DISTRAKTOR (WAJIB PATUH 100%):
${mixedModeInstMs}

5. EJAAN: Pastikan ejaan perkataan etika ditaip dengan betul ("etika", BUKAN "ethika").

${RUBRIK_AKADEMIK}

JANA TEPAT ${count} SOALAN SAHAJA.
${formatInstructions}

PERATURAN MUTLAK KERTAS SOALAN:
1. TAG JSU LENGKAP WAJIB ada di baris akhir setiap soalan dan WAJIB di-tab (\\t). Rujuk Peta Susunan yang diberi. (TEPAT 2 TAG SAHAJA: Bloom dan CO).
2. DILARANG menggunakan tanda bintik (* atau **) atau hashtag (#).
3. AMARAN KERAS: DILARANG SAMA SEKALI menulis tajuk pengepala seperti "KERTAS SOALAN...", ulasan, rasional, atau sebarang nota penerangan! Anda hanya dibenarkan mencetak TEKS SOALAN, PILIHAN JAWAPAN, dan TAG JSU SAHAJA.
4. BUKAN SOALAN SUBJEKTIF: Jika ini soalan Objektif, anda WAJIB menjana tepat 4 pilihan jawapan (A, B, C, D) bagi SETIAP soalan sebelum meletakkan tag JSU.
5. PENGAGIHAN TOPIK: Anda WAJIB memvariasikan soalan merangkumi KESELURUHAN topik/konteks yang diberikan secara seimbang. JANGAN tertumpu pada satu topik berulang kali jika ada topik lain di dalam nota.
6. AMARAN TERAKHIR: DILARANG SAMA SEKALI meletakkan perkataan MENGABAIKAN, SEMATA-MATA, atau SAHAJA dalam senarai pilihan jawapan A, B, C, D.

NOTA KURSUS:
${finalContext}`;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: aiModel === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.35
      })
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(openaiData.error?.message || "Gagal mendapat maklum balas OpenAI.");

    let rawOutput = openaiData.choices?.[0]?.message?.content || "";

    let finalCleanData = cleanAndTransformQuestions(rawOutput, language, questionType);

    // ============================================================
    // PEMBERSIHAN KETAT UNTUK PENGEMASAN KERTAS SOALAN (NO METADATA, NO *, NO #, NO [JSU])
    // ============================================================
    // 1. Buang pengepala metadata jika terjana
    finalCleanData = finalCleanData.replace(/KERTAS SOALAN PEPERIKSAAN[\s\S]*?---\n*/gi, '');
    finalCleanData = finalCleanData.replace(/KURSUS:[\s\S]*?---\n*/gi, '');
    finalCleanData = finalCleanData.replace(/^---\n*/gm, '');

    // 2. Buang perkataan tag [JSU] secara selamat (tidak memadam huruf J, S, U dalam perkataan biasa)
    finalCleanData = finalCleanData.split('[JSU]').join('');
    finalCleanData = finalCleanData.split('[jsu]').join('');
    finalCleanData = finalCleanData.split('[Jsu]').join('');

    // 3. Buang sebarang simbol * dan #
    finalCleanData = finalCleanData.replace(/[\*#]/g, '');

    // 4. Buang nota penutup di bahagian bawah
    finalCleanData = finalCleanData.replace(/---\s*Nota:[\s\S]*$/gi, '');
    finalCleanData = finalCleanData.replace(/Nota:[\s\S]*$/gi, '');

    finalCleanData = finalCleanData.trim();

    // ============================================================
    // KAWALAN KUANTITI MUTLAK (HARD CUT-OFF) JIKA AI BERHALUSINASI
    // ============================================================
    if (mode !== "SCHEMA") {
      const individualQuestions = splitIntoIndividualQuestions(finalCleanData);
      if (individualQuestions.length > count) {
        finalCleanData = individualQuestions.slice(0, count).join('\n\n');
      }
    }

    // ============================================================
    // PEMASUKAN AUTOMATIK KE SUPABASE
    // ============================================================
    if (targetSubjectId) {
      const exactQuestionsForDb = splitIntoIndividualQuestions(finalCleanData);

      if (exactQuestionsForDb.length > 0) {
        const insertPayload = exactQuestionsForDb.map((qText) => {
          const bloomMatch = qText.match(/\[(C[1-6]\vert{}P[1-5]\vert{}A[1-5])\]/i);
          const detectedBloom = bloomMatch ? bloomMatch[1].toUpperCase() : "C1";

          const coMatch = qText.match(/\[(CO\d*)\]/i);

          return {
            subject_id: targetSubjectId,
            question_text: qText,
            answer_scheme: "",
            marks: questionType === "objektif" ? 1 : totalSectionMarks / count,
            bloom_level: detectedBloom,
            difficulty: "Sederhana",
            co_code: coMatch ? coMatch[1].toUpperCase() : (formattedCOs.length > 0 ? formattedCOs[0] : 'CO1'),
            lo_code: 'LO1', 
          };
        });

        await supabase.from("questions").insert(insertPayload);
      }
    }

    return NextResponse.json({ success: true, data: finalCleanData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ralat API OpenAI." }, { status: 500 });
  }
}