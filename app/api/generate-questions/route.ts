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
C1 (Pengetahuan): Mengingat أو menyatakan semula fakta/konsep.
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

  if (questionType === "objektif" || questionType === "true_false") {
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
  }

  const langLower = (language || "").toLowerCase();
  const isArabic = langLower.includes("arab") || langLower.includes("arabic");
  const isEnglish = langLower.includes("english") || langLower.includes("inggeris");

  let lines = processedText.split("\n");

  // SAFETY NET BARU: MEMBUANG DOUBLE QUESTION SECARA PAKSA
  if (questionType === "objektif" || questionType === "true_false") {
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // Jika terjumpa baris nombor soalan dan ada tanda soal
      if (/^\d+\.\s+/.test(line) && line.includes('?')) {
        let j = i + 1;
        // Cari baris teks seterusnya yang tidak kosong
        while(j < lines.length && lines[j].trim() === '') j++;
        // Jika baris seterusnya BUKAN pilihan roman/abcd, dan ia ada tanda soal juga (Double Question Detected)
        if (j < lines.length && lines[j].includes('?') && !/^[i|v|x]+\./i.test(lines[j]) && !/^[A-D][\.\)]/i.test(lines[j])) {
          // Buang bahagian soalan dari baris nombor supaya tinggal penyata sahaja
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
      // Ditambah "yang dimaksudkan" ke dalam regex ini supaya pengecualian berlaku 
      const isNounQuestion = /Apakah\s+(tujuan|maksud|definisi|elemen|faktor|fungsi|komponen|pernyataan|konsep|sifat|kesan|cabaran|peranan|kepentingan|aspek|yang\s+dimaksudkan)/i.test(line);

      // Rawak prefix HANYA jika ia tiada dalam pengecualian isNounQuestion
      if (line.includes("Apakah ") && !isNounQuestion && Math.random() > 0.6) {
        const randomPrefix = diverseQuestionPrefixes[Math.floor(Math.random() * diverseQuestionPrefixes.length)];
        lines[i] = line.replace(/Apakah\s+/gi, `${randomPrefix} `);
      }
    }
  }

  let finalResult = lines.join("\n");
  // Final Cleanup keselamatan untuk memastikan sisa frasa lewah dihilangkan sepenuhnya
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
      fullQuestions = ""
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
ورقة الأسئلة:
${fullQuestions}`;
      } else if (isEnglish) {
        schemaPrompt = `You are a UiTM University Examination Examiner.
Provide a COMPLETE ANSWER SCHEME ONLY for the questions present in the QUESTION PAPER below (${language}).
1. IF THE PAPER CONTAINS OBJECTIVE / TRUE-FALSE: State ONLY the question number and answer letter vertically (e.g., 1. A).
2. IF ESSAY QUESTIONS ARE PRESENT: REPEAT THE ORIGINAL QUESTION STATEMENT before providing point-form answers with marks.
QUESTION PAPER:
${fullQuestions}`;
      } else {
        schemaPrompt = `Anda adalah Pemeriksa Kertas Peperiksaan UiTM. 
Sediakan SKEMA JAWAPAN LENGKAP HANYA bagi soalan yang wujud dalam KERTAS SOALAN di bawah (${language}).
1. JIKA KERTAS SOALAN HANYA ADA OBJEKTIF / BENAR-SALAH: HANYA nyatakan nombor soalan dan abjad jawapan (Contoh: 1. A).
2. JIKA ADA SOALAN ESEI: WAJIB MENYERTAKAN SEMULA SOALAN ASAL sebelum memberikan skema jawapan dalam bentuk POINT (Bullet) berserta markah.
KERTAS SOALAN:
${fullQuestions}`;
      }

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: aiModel || "gpt-4o-mini",
          messages: [{ role: "system", content: schemaPrompt }],
          temperature: 0.1
        })
      });

      const openaiData = await openaiRes.json();
      if (!openaiRes.ok) throw new Error(openaiData.error?.message || "Gagal menjana skema.");
      return NextResponse.json({ success: true, data: openaiData.choices?.[0]?.message?.content || "" });
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

    const totalSectionMarks = parseNum(sectionData?.marks) || parseNum(activeSec?.marks) || 10;
    const subMarks = Math.max(1, Math.floor(totalSectionMarks / (count * 2)));

    const activeBloomLevels = Object.entries(bloomSpec)
      .filter(([_, cnt]) => Number(cnt) > 0)
      .map(([lvl]) => lvl.toUpperCase());

    let bloomVerbsInstruction = "";
    if (activeBloomLevels.length > 0 && questionType === "essay") {
      bloomVerbsInstruction = "\nARAHAN KATA TUGAS / KATA PERINTAH BLOOM (WAJIB GUNAKAN PADA ANAK SOALAN 'a.' & 'b.' SAHAJA):\n";
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
             qFormatMs = "FORMAT WAJIB: SOALAN BIASA TUNGGAL (A, B, C, D sahaja. DILARANG GUNA ITEM ROMAN i, ii, iii, iv). ";
             qFormatEn = "MANDATORY FORMAT: REGULAR SINGLE QUESTION (A, B, C, D only. NO ROMAN NUMERALS i, ii, iii, iv). ";
             qFormatAr = "تنسيق إلزامي: سؤال عادي فردي (A, B, C, D فقط. بدون أرقام رومانية). ";
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
2. لا تضع سؤالين في رقم واحد. استخدم علامة استفهام واحدة (?) لكل سؤال.
3. لأسئلة C1 و C2، يُمنع منعاً باتاً استخدام عبارة تقريرية في البداية. ابدأ مباشرة بسؤال مباشر.

تعليمات الأسئلة العادية:
- قاعدة المحاذاة: يجب وضع Tab (\\t) واحد مباشرة بعد رقم السؤال، و Tab (\\t) واحد قبل جميع الخيارات.
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

[مثال خاطئ - لا تفعل هذا أبداً]:
2. علم الفلك مهم. ما هو تطبيقه؟ (خاطئ: يحتوي على علامة استفهام في السطر الأول)

ما هو التطبيق المناسب؟ (خاطئ: تكرار السؤال مرتين)

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
        formatInstructions = `صيغة الأسئلة المقالية (${count} أسئلة). 
- تحذير حرج: توقف عن التوليد فوراً بعد السؤال رقم ${count}.
${bloomMappingAr}
${bloomVerbsInstruction}

قواعد المقال:
1. يجب أن يبدأ السؤال الرئيسي (رقم 1 ، 2 ...) ببيان / جملة تقريرية كاملة. يُمنع منعاً باتاً بدء السؤال الرئيسي بكلمة أمر أو سؤال!
2. تُستخدم أفعال بلوم فقط في الأسئلة الفرعية ('a.' و 'b.').

مثال:
1.\tتلعب أصول الفقه دوراً محورياً في ضبط عملية الاجتهاد واستنباط الأحكام الشرعية. (هذه جملة تقريرية)

\ta. ناقش أهمية القواعد الأصولية في فهم النصوص الشرعية. (${subMarks} درجات)
\tb. بين كيف يتم التعامل مع التعارض الظاهري بين الأدلة. (${subMarks} درجات)
\t[C4] [CO2]`;
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
2. NO DOUBLE QUESTIONS: DO NOT ask two separate questions (two question marks '?') in the same item.
3. C1 & C2 QUESTIONS: DO NOT use declarative statements for C1 and C2. You MUST start directly with the question (e.g., "What is...", "How does...").
4. C3 TO C6 QUESTIONS: You are allowed to use a short statement before the question.
5. PARAGRAPH SPACING (CRITICAL): For Regular Questions, if using a statement, it MUST be merged with the question on the SAME line (NO ENTER). BUT for Branched Questions, the statement and the question MUST be separated by EXACTLY ONE BLANK LINE (ENTER)!

REGULAR OBJECTIVE INSTRUCTIONS:
- For regular objective questions, DO NOT leave a blank line between the statement and the question. Keep them in the exact same paragraph.
- You MUST leave exactly ONE BLANK LINE before starting the A, B, C, D options.
EXAMPLE for C3-C6 (Statement and Question merged):
1.\tIntegration serves as a foundational concept. How is this concept applied in advanced calculus?

\tA. As the limit of the rate
\tB. As the maximum value
\tC. As the definite integral
\tD. As the static slope
\t[C3] [CO2]

BRANCHED OBJECTIVE INSTRUCTIONS:
- The very first line (the numbered line) MUST ONLY be a DECLARATIVE FACTUAL STATEMENT ending with a full stop (.). DO NOT put a question mark (?) or question words on this first line!
- Then, LEAVE A BLANK LINE (Press Enter), and ask ONE formally complete question based on the statement.

[WRONG EXAMPLE - DO NOT DO THIS]:
2. Astronomy is important. What is its application? (WRONG: Has a question mark on the first line)

What is the relevant application? (WRONG: Asking question twice)

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
        formatInstructions = `Format Essay (${count} questions).
- CRITICAL WARNING: STOP GENERATING IMMEDIATELY AFTER QUESTION ${count}.
${bloomMappingEn} 
${bloomVerbsInstruction}

RULES FOR ESSAY:
1. The main stem (number 1, 2...) MUST ONLY be a DECLARATIVE FACTUAL STATEMENT ending with a full stop (.). DO NOT start the main stem with a question or command word, and NEVER end it with a question mark (?)!
2. Bloom's command verbs MUST ONLY be used in the sub-questions ('a.' and 'b.').

EXAMPLE:
1.\tIntegration serves as a foundational concept in advanced calculus. (THIS IS A FACTUAL STATEMENT)

\ta. Explain the process of evaluating a definite integral. (${subMarks} Marks)
\tb. Derive the rate of change for the differential equation. (${subMarks} Marks)
\t[C4] [CO2]`;
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
1. WAJIB ADA PILIHAN JAWAPAN (A, B, C, D): Setiap soalan yang dijana WAJIB mempunyai tepat 4 pilihan jawapan. JANGAN SESEKALI tinggalkan soalan tanpa memberikan pilihan jawapan! Ini adalah soalan objektif!
2. LARANGAN DUA SOALAN: DILARANG SAMA SEKALI terdapat DUA ayat pertanyaan (dua tanda soal '?') dalam satu nombor soalan yang sama. Hanya SATU tanda soal dibenarkan.
3. GAYA SOALAN C1 & C2: DILARANG menggunakan sebarang ayat penyata (stimulus) di awal soalan bagi aras C1 dan C2. WAJIB terus gunakan soalan langsung (Direct Question) seperti "Apakah...", "Bagaimanakah...", "Manakah...".
4. GAYA SOALAN C3 HINGGA C6: DIBENARKAN memulakan soalan dengan SATU ayat penyata ringkas, diikuti dengan persoalan. (Guna dengan kadar terkawal).
5. PEMISAHAN AYAT (SANGAT PENTING): Untuk Soalan Biasa, jika ada penyata, ia MESTI ditaip bersambung dengan soalan dalam baris yang sama (TIADA ENTER). TETAPI, untuk Soalan Beranak, ayat penyata di baris pertama WAJIB DIPISAHKAN daripada ayat soalan di baris berikutnya dengan SATU BARIS KOSONG (ENTER)!
6. "Siapakah" HANYA KHUSUS untuk orang atau tokoh. DILARANG menggunakan "Siapakah" untuk benda atau konsep.
7. DILARANG menggunakan soalan tergantung seperti "dalam artikel ini" atau "dalam petikan ini".
8. HARAM MENGGUNAKAN IMBUHAN "-lah": DILARANG SAMA SEKALI menggunakan perkataan berimbuhan seperti "Analisislah", "Jelaskanlah", "Bincangkanlah". Soalan objektif mestilah bertanyakan soalan secara terus.

ARAHAN SOALAN BIASA (TUNGGAL):
- SOALAN MESTI BERCANTUM: Ayat penyata dan ayat pertanyaan mesti berada dalam satu perenggan yang sama.
- WAJIB TINGGALKAN SATU BARIS KOSONG (SELANG SEBARIS) sebelum bermulanya pilihan jawapan A, B, C, D.
CONTOH LENGKAP C3-C6 (Penyata & Soalan Bercantum):
1.\tFalsafah Pendidikan Kebangsaan menekankan aspek keseimbangan. Bagaimanakah aspek ini diterapkan dalam kurikulum sekolah?

\tA. Melalui pengasingan subjek sains dan sastera
\tB. Dengan memperkenalkan subjek pendidikan rohani
\tC. Melalui penglibatan pelajar dalam aktiviti kokurikulum secara holistik
\tD. Mengurangkan waktu pembelajaran teori
\t[C3] [CO2]

AMARAN PALING KERAS UNTUK SOALAN BERANAK (BERLAPIS):
- Baris PERTAMA yang bernombor (cth: "2.") WAJIB HANYA AYAT PENYATA FAKTA (Stimulus) yang diakhiri dengan titik (.).
- DIHARAMKAN SAMA SEKALI meletakkan sebarang persoalan, kata tanya ("Apakah", "Bagaimanakah"), atau tanda soal (?) pada baris pertama ini! Jika anda letak tanda soal di baris pertama, ia adalah SALAH!
- WAJIB TEKAN 'ENTER' (SELANG SEBARIS)!
- Barulah kemukakan HANYA SATU soalan formal pada baris baharu.

[CONTOH SALAH - JANGAN BUAT BEGINI!]:
2. Astronomi penting. Apakah aplikasinya? (SALAH: Ada tanda soal di baris pertama)

Apakah aplikasi yang relevan? (SALAH: Soalan berulang dua kali)

[CONTOH BETUL - WAJIB IKUT]:
2.\tPendidikan yang berteraskan Falsafah Pendidikan Kebangsaan perlu mengambil kira pelbagai aspek penting.

\tManakah antara berikut merupakan aspek yang paling utama bagi mencapai hasrat tersebut?

\ti. Kurikulum yang inklusif
\tii. Pengajaran bahasa ibunda
\tiii. Pendidikan moral
\tiv. Aktiviti sukan

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
        formatInstructions = `Format Esei (${count} soalan). 
- AMARAN KERAS: ANDA WAJIB BERHENTI MENJANA SEBAIK SAHAJA SOALAN KE-${count} SELESAI.
${bloomMappingMs}
${bloomVerbsInstruction}

PERATURAN FORMAT ESEI & TATABAHASA (AMARAN KERAS MUTLAK):
1. KEPALA SOALAN (sebelah nombor 1, 2, 3...) WAJIB merupakan AYAT PENYATA LENGKAP (Fakta/Stimulus) yang DITAMATKAN DENGAN TITIK (.). DILARANG SAMA SEKALI memulakan kepala soalan dengan kata perintah, dan DILARANG mengakhirinya dengan tanda soal (?)!
2. KATA PERINTAH BLOOM HANYA BOLEH DIGUNAKAN PADA ANAK SOALAN ('a.' dan 'b.') SAHAJA. (Pastikan ia adalah ayat perintah murni bebas imbuhan Me, Meng, Men - Contoh yang betul: "Bincangkan", "Huraikan", "Nilaikan", "Rekaciptakan").

CONTOH STRUKTUR ESEI WAJIB PATUH:
1.\tPendidikan memainkan peranan signifikan dalam pembangunan negara dan pembentukan jati diri bangsa. (INI ADALAH AYAT PENYATA LENGKAP)

\ta. Bincangkan peranan pendidikan dalam memupuk patriotisme. (${subMarks} Markah)
\tb. Huraikan langkah proaktif oleh pihak sekolah. (${subMarks} Markah)
\t[C4] [CO2]`;
      }
    }

    let systemPrompt = "";
    if (isArabic) {
      systemPrompt = `أنت خبير في إعداد الامتحانات الجامعية (UiTM) لمادة ${courseCode} - ${courseName}.
شرط اللغة الصارم: يجب عليك إنشاء جميع الأسئلة والنصوص والخيارات والفقرات بنسبة 100% باللغة العربية.

قاعدة الربط بالنص المرفق (STRICT CONTEXT GROUNDING):
1. يجب عليك إنشاء الأسئلة بناءً على النص المرفق أدناه فقط بنسبة 100%.
2. يُمنع منعاً باتاً اختراع أو إدخال أي مواضيع عامة خارج نطاق النص المرفق.

${RUBRIK_AKADEMIK}

قم بإنشاء ${count} أسئلة بالضبط.
${formatInstructions}

قواعد مطلقة:
1. وسم JSU الكامل يجب وضعه في السطر الأخير لكل سؤال ويكون محاذى بـ Tab (\\t). (وسمين فقط: مستويات بلوم و CO).
2. يُمنع استخدام النجوم (* أو **).
3. يمنع منعا باتا كتابة تعليقات أو تبريرات أو شرح لخياراتك داخل ورقة الأسئلة. فقط اكتب الأسئلة والخيارات والوسم النهائي.
4. للأسئلة الموضوعية: يجب عليك توفير 4 خيارات (A, B, C, D) لكل سؤال. لا تترك أي سؤال بدون خيارات.
5. توزيع المواضيع: يجب تنويع الأسئلة لتشمل جميع المواضيع في النص المعطى بشكل متوازن. لا تركز فقط على موضوع واحد إذا كانت هناك مواضيع أخرى.

سياق الملاحظات:
${finalContext}`;
    } else if (isEnglish) {
      systemPrompt = `You are a University Examination Question Setter (UiTM) for ${courseCode} - ${courseName}.
CRITICAL LANGUAGE MANDATE: You MUST generate ALL questions, statements, options, and text 100% ENTIRELY IN ENGLISH.

STRICT CONTEXT GROUNDING RULE:
1. You MUST generate questions 100% EXCLUSIVELY and STRICTLY based on the facts present in the COURSE NOTES / CONTEXT provided below.
2. DO NOT hallucinate or introduce outside general knowledge facts!

${RUBRIK_AKADEMIK}

GENERATE EXACTLY ${count} QUESTIONS ONLY.
${formatInstructions}

ABSOLUTE RULES:
1. FULL JSU TAG MUST be placed at the very bottom line of every question and MUST be indented with 1 tab (\\t). (EXACTLY 2 TAGS: Bloom and CO).
2. DO NOT use bullet points (* or **).
3. STRICT PROHIBITION: DO NOT write any comments, rationale, justifications, or Bloom's explanations inside the question paper. ONLY output the questions, options, and the final tag.
4. FOR OBJECTIVE QUESTIONS: You MUST provide 4 options (A, B, C, D) for every single question. NEVER leave a question without options.
5. TOPIC DISTRIBUTION: You MUST vary the questions to cover ALL topics provided in the context evenly. DO NOT focus repeatedly on a single topic if other topics are present.

COURSE NOTES CONTEXT:
${finalContext}`;
    } else {
      systemPrompt = `Anda adalah Pakar Penggubal Soalan Peperiksaan Universiti (UiTM) bagi ${courseCode} - ${courseName} dalam ${language}.

ARAHAN PENGIKATAN DOKUMEN / NOTA (STRICT CONTEXT GROUNDING MUTLAK):
1. Anda WAJIB menggubal soalan 100% BERDASARKAN DAN BERSUMBERKAN TEKS NOTA KURSUS di bawah SAHAJA.
2. DILARANG SAMA SEKALI mereka-reka atau membawa masuk fakta am di luar kandungan dokumen!

${RUBRIK_AKADEMIK}

JANA TEPAT ${count} SOALAN SAHAJA.
${formatInstructions}

PERATURAN MUTLAK KERTAS SOALAN:
1. TAG JSU LENGKAP WAJIB ada di baris akhir setiap soalan dan WAJIB di-tab (\\t). Rujuk Peta Susunan yang diberi. (TEPAT 2 TAG SAHAJA: Bloom dan CO).
2. DILARANG menggunakan tanda bintik (* atau **).
3. AMARAN KERAS: DILARANG SAMA SEKALI menulis ulasan, rasional, justifikasi rubrik atau sebarang nota penerangan di dalam kertas soalan! Anda hanya dibenarkan mencetak TEKS SOALAN, PILIHAN JAWAPAN, dan TAG JSU SAHAJA.
4. BUKAN SOALAN SUBJEKTIF: Ini adalah soalan Objektif. Anda WAJIB menjana tepat 4 pilihan jawapan (A, B, C, D) bagi SETIAP soalan sebelum meletakkan tag JSU.
5. PENGAGIHAN TOPIK: Anda WAJIB memvariasikan soalan merangkumi KESELURUHAN topik/konteks yang diberikan secara seimbang. JANGAN tertumpu pada satu topik berulang kali (contohnya Falsafah Pendidikan Kebangsaan) jika ada topik lain di dalam nota.

NOTA KURSUS:
${finalContext}`;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: aiModel || "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.1 
      })
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) throw new Error(openaiData.error?.message || "Gagal mendapat maklum balas OpenAI.");

    let rawOutput = openaiData.choices?.[0]?.message?.content || "";

    const finalCleanData = cleanAndTransformQuestions(rawOutput, language, questionType);

    // ============================================================
    // PEMASUKAN AUTOMATIK KE SUPABASE
    // ============================================================
    if (targetSubjectId) {
      const individualQuestions = splitIntoIndividualQuestions(finalCleanData);
      const exactQuestions = individualQuestions.slice(0, count);

      if (exactQuestions.length > 0) {
        const insertPayload = exactQuestions.map((qText) => {
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