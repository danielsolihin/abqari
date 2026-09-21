import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
// FUNGSI PENAPIS AUTOMATIK PEKA BAHASA (3-LANGUAGES SUPPORT)
// ============================================================
function cleanAndTransformQuestions(text: string, language: string = "Bahasa Melayu"): string {
  if (!text) return "";

  // Pembersihan simbol '\t' mentah & pertukaran istilah 'Diskusikan'
  let processedText = text.replace(/\\t/g, "\t");
  processedText = processedText.replace(/\bDiskusikan\b/gi, "Bincangkan");

  const langLower = (language || "").toLowerCase();
  const isArabic = langLower.includes("arab") || langLower.includes("arabic");
  const isEnglish = langLower.includes("english") || langLower.includes("inggeris");

  let lines = processedText.split("\n");
  let isNested = false;

  // 1. JIKA BAHASA ARAB
  if (isArabic) {
    const backupFactDArabic = [
      "D.\tتطبيق القواعد الأصولية في استنباط الأحكام الشرعية",
      "D.\tمراعاة المقاصد الشرعية في القضايا المستحدثة",
      "D.\tالاعتماد على الأدلة الإجمالية في الفقه الإسلامي",
      "D.\tتحقيق التوازن بين النصوص والاجتهاد المعاصر"
    ];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^\s*i\.\s+/i.test(line)) isNested = true;
      if (/^\d+\.\s+/.test(line)) isNested = false;

      if (!isNested && /D\.\s+(جميع ما ذكر|جميع ما سبق|All of the above)/i.test(line)) {
        const randomD = backupFactDArabic[Math.floor(Math.random() * backupFactDArabic.length)];
        lines[i] = `\t${randomD}`;
      }
    }
    return lines.join("\n");
  }

  // 2. JIKA BAHASA INGGERIS
  if (isEnglish) {
    const backupFactDEnglish = [
      "D.\tCalculating the instantaneous rate of change at a specific point",
      "D.\tEvaluating the continuous limit of the target function",
      "D.\tDetermining the exact area enclosed beneath the curve",
      "D.\tIdentifying the critical boundaries of the system"
    ];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^\s*i\.\s+/i.test(line)) isNested = true;
      if (/^\d+\.\s+/.test(line)) isNested = false;

      if (!isNested && /D\.\s+All of the above/i.test(line)) {
        const randomD = backupFactDEnglish[Math.floor(Math.random() * backupFactDEnglish.length)];
        lines[i] = `\t${randomD}`;
      }
    }
    return lines.join("\n");
  }

  // 3. JIKA BAHASA MELAYU
  processedText = processedText.replace(/Apakah wajar ([a-zA-Z0-9\-\s]+?) yang/gi, "Apakah $1 wajar yang");
  lines = processedText.split("\n");

  const questionPrefixes = [
    "Mengapakah",
    "Bagaimanakah",
    "Sejauh manakah",
    "Manakah antara berikut",
    "Apakah"
  ];

  const backupFactD = [
    "D.\tMeningkatkan sistem pentadbiran dan pertahanan negara",
    "D.\tMemperkasa peranan institusi pendidikan antarabangsa",
    "D.\tMengukuhkan kerjasama ekonomi serantau",
    "D.\tMemastikan pengagihan sumber kewangan secara berkala"
  ];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (/^\s*i\.\s+/i.test(line)) isNested = true;

    if (/^\d+\.\s+/.test(line)) {
      isNested = false;
      if (line.includes("Apakah ") && Math.random() > 0.4) {
        const randomPrefix = questionPrefixes[Math.floor(Math.random() * questionPrefixes.length)];
        lines[i] = line.replace(/Apakah\s+/gi, `${randomPrefix} `);
      }
    }

    if (!isNested && /D\.\s+Semua di atas/i.test(line)) {
      const randomD = backupFactD[Math.floor(Math.random() * backupFactD.length)];
      lines[i] = `\t${randomD}`;
    }
  }

  return lines.join("\n");
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

    // ============================================================
    // MOD 1: SKEMA JAWAPAN
    // ============================================================
    if (mode === "SCHEMA") {
      let schemaPrompt = "";
      if (isArabic) {
        schemaPrompt = `أنت خبير في إعداد نموذج الإجابة لامتحانات جامعة UiTM.
قدم نموذج إجابة كامل وفقط للأسئلة الموجودة في ورقة الأسئلة أدناه (${language}).
1. إذا كانت الورقة تحتوي على أسئلة اختيار من متعدد فقط: اذكر رقم السؤال وحرف الإجابة فقط العمودية (مثال: 1. A).
2. إذا كانت هناك أسئلة مقالية: أعد كتابة نص السؤال الأصلي قبل تقديم الإجابة في شكل نقاط مع توزيع الدرجات.
ورقة الأسئلة:
${fullQuestions}`;
      } else if (isEnglish) {
        schemaPrompt = `You are a UiTM University Examination Examiner.
Provide a COMPLETE ANSWER SCHEME ONLY for the questions present in the QUESTION PAPER below (${language}).
1. IF THE QUESTION PAPER CONTAINS ONLY OBJECTIVE / TRUE-FALSE: State ONLY the question number and answer letter vertically (e.g., 1. A).
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

    // ============================================================
    // MOD 2: PENJANAAN SOALAN (RAG RETRIEVAL)
    // ============================================================
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
          const queryEmbedding = await getLocalEmbedding(t.name.trim());
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

    // Pengesanan Format Pilihan UI
    const activeSec = Array.isArray(sectionData) ? sectionData[0] : (sectionData || (Array.isArray(sections) ? sections[0] : sections) || body);
    const rawType = String(activeSec?.type || activeSec?.format || activeSec?.questionType || body?.type || body?.format || "objektif").toLowerCase();

    let questionType = sectionData?.type || "objektif";
    if (rawType.includes("objektif") || rawType.includes("mcq") || rawType.includes("pilihan") || rawType.includes("objective") || rawType.includes("a, b, c, d")) {
      questionType = "objektif";
    } else if (rawType.includes("true") || rawType.includes("benar") || rawType.includes("salah") || rawType.includes("false")) {
      questionType = "true_false";
    }

    const bloomStr = Object.entries(sectionData?.bloom || {}).filter(([_, count]) => Number(count) > 0).map(([lvl]) => `${lvl}`).join(", ") || "C1";
    const count = Number(sectionData?.count || activeSec?.count || 5);
    const beranak = Number(sectionData?.beranakCount || activeSec?.beranakCount || activeSec?.beranak || 0);
    const biasaCount = Math.max(0, count - beranak);
    
    const domainStr = domain.length > 0 ? domain[0] : "P3";
    const coStr = co.length > 0 ? co[0] : "CO1";
    const loStr = lo.length > 0 ? lo[0] : "LO1";

    let formatInstructions = "";

    if (isArabic) {
      if (questionType === "objektif") {
        formatInstructions = `
متطلبات العدد الصارمة:
- إجمالي الأسئلة: ${count} أسئلة بالضبط.
- الأسئلة المركبة (ذات البيانات والترقيم الروماني): ${beranak} أسئلة بالضبط.
- الأسئلة العادية: ${biasaCount} أسئلة بالضبط.

تعليمات الأسئلة العادية:
- استخدم أدوات استفهام متنوعة (كيف, لماذا, إلى أي مدى, أي مما يلي, ما هي).
- يجب أن يكون كل خيار (A, B, C, D) حقيقة مختلفة ومحددة ومستخرجة من النص فقط.
- مثال للالتزام به تماماً:
1. كيف يُعرّف أصول الفقه في التشريع الإسلامي؟

\tA. أدلة الفقه الإجمالية وكيفية الاستفادة منها
\tB. الأحكام الشرعية الفرعية المتعلقة بأفعال المكلفين
\tC. القواعد الفقهية الكلية للفتوى
\tD. التواريخ التاريخية لتطور المذاهب
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

تعليمات الأسئلة المركبة (بالضبط ${beranak} أسئلة):
- يجب أن يبدأ كل سؤال مركب ببيان/نص مكتمل بجانب رقم السؤال.
- مثال للالتزام به تماماً:
2. يُعتبر الإجماع المصدر الثالث من مصادر التشريع الإسلامي بعد الكتاب والسنة.

\tبناءً على النص أعلاه، أي من العناصر التالية تُعدّ شروطاً لحجية الإجماع؟

\ti. اتفاق جميع المجتهدين في العصر
\tii. أن يكون الاعتماد على مستند شرعي
\tiii. صدوره من أصحاب السلطة السياسية
\tiv. أن يكون بعد وفاة النبي صلى الله عليه وسلم

\tA. i و ii
\tB. ii و iii
\tC. i و ii و iv
\tD. جميع ما ذكر
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      } else if (questionType === "true_false") {
        formatInstructions = `صيغة صح أم خطأ (${count} أسئلة). مثال:
1. يُعتبر القياس من الأدلة المتفق عليها عند جميع العلماء.
\t[صواب] [خطأ]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `صيغة الأسئلة المقالية (${count} أسئلة). مثال:
1. تلعب أصول الفقه دوراً محورياً في ضبط عملية الاجتهاد واستنباط الأحكام الشرعية.

\ta. ناقش أهمية القواعد الأصولية في فهم النصوص الشرعية. (${(sectionData?.marks || 10) / count / 2} درجات)
\tb. بين كيف يتم التعامل مع التعارض الظاهري بين الأدلة. (${(sectionData?.marks || 10) / count / 2} درجات)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    } else if (isEnglish) {
      if (questionType === "objektif") {
        formatInstructions = `
STRICT QUANTITY REQUIREMENT:
- TOTAL QUESTIONS: EXACTLY ${count} QUESTIONS.
- BRANCHED OBJECTIVE QUESTIONS: EXACTLY ${beranak} QUESTIONS.
- REGULAR OBJECTIVE QUESTIONS: EXACTLY ${biasaCount} QUESTIONS.

REGULAR OBJECTIVE INSTRUCTIONS:
- Use diverse academic question starters (How, Why, To what extent, Which of the following, Determine).
- Each option (A, B, C, D) MUST be a distinct, specific statement derived strictly from the text provided.
- EXAMPLE TO FOLLOW EXACTLY:
1. How is the fundamental definition of a derivative expressed in calculus?

\tA. As the limit of the average rate of change
\tB. As the maximum value of a continuous function
\tC. As the definite integral over a closed interval
\tD. As the static slope of a horizontal line
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

BRANCHED OBJECTIVE INSTRUCTIONS (EXACTLY ${beranak} QUESTIONS):
- Every branched question MUST start with 1 COMPLETE CONTEXT STATEMENT next to the question number.
- EXAMPLE TO FOLLOW EXACTLY:
2. The function f(x) = x^2 represents a parabola with a continuous derivative f'(x) = 2x.

\tBased on the statement above, which of the following properties hold true for f'(3)?

\ti. The value equals 6
\tii. The rate of change is positive
\tiii. The function is strictly increasing at x = 3
\tiv. The derivative is undefined

\tA. i and ii
\tB. ii and iii
\tC. i, ii, and iii
\tD. All of the above
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      } else if (questionType === "true_false") {
        formatInstructions = `Format True / False (${count} questions). EXAMPLE:
1. The derivative of a constant function is always zero.
\t[TRUE] [FALSE]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `Format Essay (${count} questions). EXAMPLE:
1. Integration serves as a foundational concept in computing areas and volumes under curves.

\ta. Explain the process of evaluating a definite integral using the Fundamental Theorem of Calculus. (${(sectionData?.marks || 10) / count / 2} Marks)
\tb. Derive the rate of change for the given differential equation in continuous time. (${(sectionData?.marks || 10) / count / 2} Marks)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    } else {
      if (questionType === "objektif") {
        formatInstructions = `
PENGATURAN KUANTITI SOALAN (AMARAN SANGAT MUTLAK):
- JUMLAH KESELURUHAN SOALAN: TEPAT ${count} SOALAN.
- JUMLAH SOALAN BERANAK: TEPAT ${beranak} SOALAN.
- JUMLAH SOALAN BIASA: TEPAT ${biasaCount} SOALAN.

ARAHAN KETAT OBJEKTIF BIASA:
- Pelbagaikan kata soal dengan tatabahasa yang betul (Mengapakah, Bagaimanakah, Sejauh manakah, Apakah langkah-langkah wajar, Apakah).
- SETIAP PILIHAN JAWAPAN (A, B, C, D) MESTILAH FAKTA SPESIFIK YANG BERBEZA DARI TEKS DOKUMEN.
- CONTOH:
1. Bagaimanakah dasar pendidikan dapat menyatupadukan rakyat?

\tA. Melalui penggunaan bahasa kebangsaan
\tB. Dengan menghapuskan sekolah vernakular
\tC. Memperkenalkan subjek antarabangsa
\tD. Meningkatkan yuran pengajian
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

ARAHAN KETAT OBJEKTIF BERANAK:
- Setiap soalan beranak MESTI dimulakan dengan 1 AYAT PENYATA LENGKAP di sebelah nombor soalan.
- CONTOH:
2. Penglibatan masyarakat dalam aktiviti kemasyarakatan merupakan tunjang perpaduan negara.

\tMerujuk kepada penyata di atas, apakah langkah-langkah wajar yang perlu diambil oleh pihak kerajaan?

\ti. Kurikulum yang inklusif
\tii. Pengajaran bahasa ibunda
\tiii. Pendidikan moral
\tiv. Aktiviti sukan

\tA. i dan ii
\tB. ii dan iii
\tC. i, ii dan iii
\tD. Semua di atas
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      } else if (questionType === "true_false") {
        formatInstructions = `Format Benar / Salah (${count} soalan). CONTOH WAJIB:
1. Aspirasi negara bangsa adalah penting.
\t[BENAR] [SALAH]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `Format Esei (${count} soalan). CONTOH WAJIB:
1. Pendidikan memainkan peranan signifikan. Sistem ini memupuk nilai kebersamaan.

\ta. Bincangkan peranan pendidikan dalam memupuk patriotisme. (${(sectionData?.marks || 10) / count / 2} Markah)
\tb. Huraikan langkah proaktif oleh pihak sekolah. (${(sectionData?.marks || 10) / count / 2} Markah)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    }

    let systemPrompt = "";
    if (isArabic) {
      systemPrompt = `أنت خبير في إعداد الامتحانات الجامعية (UiTM) لمادة ${courseCode} - ${courseName}.
شرط اللغة الصارم: يجب عليك إنشاء جميع الأسئلة والنصوص والخيارات والفقرات بنسبة 100% باللغة العربية. يُمنع منعاً باتاً استخدام اللغة الماليزية (Bahasa Melayu) أو الإنجليزية.

قاعدة الربط بالنص المرفق (STRICT CONTEXT GROUNDING):
1. يجب عليك إنشاء الأسئلة بناءً على النص المرفق أدناه فقط بنسبة 100%.
2. إذا كان النص المرفق عبارة عن إيصال شراء أو فاتورة أو وثيقة قصيرة، قم بإنشاء الأسئلة بناءً على تفاصيل هذا الإيصال فقط (مثل اسم المحل، قائمة المشتريات، الأسعار، التاريخ، والمبلغ الإجمالي).
3. يُمنع منعاً باتاً اختراع أو إدخال أي مواضيع عامة خارج نطاق النص المرفق.

قم بإنشاء ${count} أسئلة بالضبط (بدون نموذج الإجابة).
${formatInstructions}

قواعد مطلقة:
1. وسم JSU ([C3] [${coStr}] [${loStr}] [${domainStr}]) يجب وضعه في السطر الأخير لكل سؤال ويكون محاذى بـ Tab (\\t). استبدل C3 بـ: ${bloomStr}.
2. استخدم Tab (\\t) واحد لمحاذاة الخيارات A, B, C, D والأسئلة الفرعية.
3. يُمنع استخدام النجوم (* أو **).
4. يُمنع كتابة عناوين الأقسام مثل 'Part A:' أو 'Bahagian A:'.

سياق الملاحظات:
${finalContext}`;
    } else if (isEnglish) {
      systemPrompt = `You are a University Examination Question Setter (UiTM) for ${courseCode} - ${courseName}.
CRITICAL LANGUAGE MANDATE: You MUST generate ALL questions, statements, options, and text 100% ENTIRELY IN ENGLISH. DO NOT USE BAHASA MELAYU.

STRICT CONTEXT GROUNDING RULE:
1. You MUST generate questions 100% EXCLUSIVELY and STRICTLY based on the facts present in the COURSE NOTES / CONTEXT provided below.
2. If the context provided is a purchase receipt, invoice, or short document, generate questions STRICTLY about the specific details inside that receipt/document (e.g., store/premis name, purchased items, prices, date, receipt number, total payment).
3. DO NOT hallucinate, extrapolate, or introduce outside general knowledge facts or general academic topics not present in the provided context!

GENERATE EXACTLY ${count} QUESTIONS ONLY (NO ANSWER SCHEME/SOLUTIONS).
${formatInstructions}

ABSOLUTE RULES:
1. JSU TAG ([C3] [${coStr}] [${loStr}] [${domainStr}]) MUST be placed at the very bottom line of every question and MUST be indented with 1 tab (\\t). Replace C3 with: ${bloomStr}.
2. Use 1 Tab (\\t) to align answer choices and sub-questions vertically.
3. DO NOT use bullet points (* or **).
4. DO NOT write section headers like 'SECTION A:'.

COURSE NOTES CONTEXT:
${finalContext}`;
    } else {
      systemPrompt = `Anda adalah Pakar Penggubal Soalan Peperiksaan Universiti (UiTM) bagi ${courseCode} - ${courseName} dalam ${language}.

ARAHAN PENGIKATAN DOKUMEN / NOTA (STRICT CONTEXT GROUNDING MUTLAK):
1. Anda WAJIB menggubal soalan 100% BERDASARKAN DAN BERSUMBERKAN TEKS NOTA KURSUS di bawah SAHAJA.
2. Sekiranya Nota Kursus / dokumen yang disuapkan di bawah adalah resit belian, invois, atau dokumen ringkas, ANDA DIWAJIBKAN MEMBINA SOALAN TEPAT MENGENAI BUTIRAN DOKUMEN TERSEBUT SAHAJA (contoh: nama premis/kedai, senarai item/barangan, harga, tarikh, nombor resit, jumlah keseluruhan).
3. DILARANG SAMA SEKALI mereka-reka, berhalusinasi, atau membawa masuk fakta/topik am di luar kandungan dokumen yang disuapkan!

JANA TEPAT ${count} SOALAN SAHAJA (TANPA SKEMA/JAWAPAN).
${formatInstructions}

PERATURAN MUTLAK:
1. TAG JSU ([C3] [${coStr}] [${loStr}] [${domainStr}]) WAJIB ada di baris akhir setiap soalan dan WAJIB di-tab (\\t). Ganti C3 dengan: ${bloomStr}.
2. Gunakan 1 Tab (\\t) untuk selaraskan pilihan jawapan dan pecahan soalan.
3. DILARANG menggunakan tanda bintik (* atau **).
4. DILARANG meletakkan sebarang tajuk bahagian.

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

    // TAPIS TEKS MENGIKUT BAHASA PENGANTAR YANG DIPILIH
    const finalCleanData = cleanAndTransformQuestions(rawOutput, language);

    return NextResponse.json({ success: true, data: finalCleanData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ralat API OpenAI." }, { status: 500 });
  }
}