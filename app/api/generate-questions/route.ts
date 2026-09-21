import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  let processedText = text.replace(/\\t/g, "\t");
  processedText = processedText.replace(/\bDiskusikan\b/gi, "Bincangkan");

  const langLower = (language || "").toLowerCase();
  const isArabic = langLower.includes("arab") || langLower.includes("arabic");
  const isEnglish = langLower.includes("english") || langLower.includes("inggeris");

  let lines = processedText.split("\n");
  let isNested = false;

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

    const activeSec = Array.isArray(sectionData) ? sectionData[0] : (sectionData || (Array.isArray(sections) ? sections[0] : sections) || body);
    const rawType = String(activeSec?.type || activeSec?.format || activeSec?.questionType || body?.type || body?.format || "objektif").toLowerCase();

    let questionType = sectionData?.type || activeSec?.type || "objektif";
    if (rawType.includes("objektif") || rawType.includes("mcq") || rawType.includes("pilihan") || rawType.includes("objective") || rawType.includes("a, b, c, d")) {
      questionType = "objektif";
    } else if (rawType.includes("true") || rawType.includes("benar") || rawType.includes("salah") || rawType.includes("false")) {
      questionType = "true_false";
    }

    const bloomStr = Object.entries(sectionData?.bloom || activeSec?.bloom || {}).filter(([_, count]) => Number(count) > 0).map(([lvl]) => `${lvl}`).join(", ") || "C1";
    
    const parseNum = (val: any) => { const n = Number(val); return isNaN(n) ? 0 : n; };
    const count = parseNum(sectionData?.count) || parseNum(activeSec?.count) || parseNum(body?.count) || 5;
    const beranak = parseNum(sectionData?.beranakCount) || parseNum(activeSec?.beranakCount) || parseNum(activeSec?.beranak) || parseNum(body?.beranakCount) || parseNum(body?.beranak) || 0;
    const biasaCount = Math.max(0, count - beranak);
    
    const domainStr = domain.length > 0 ? domain[0] : "P3";
    const coStr = co.length > 0 ? co[0] : "CO1";
    const loStr = lo.length > 0 ? lo[0] : "LO1";

    let formatInstructions = "";

    if (isArabic) {
      if (questionType === "objektif") {
        let beranakRuleNoteAr = "";
        if (beranak > 0 && biasaCount === 0) {
          beranakRuleNoteAr = `\nتنبيه هام جداً: جميع الأسئلة الـ ${count} (من السؤال 1 إلى ${count}) يجب أن تكون أسئلة مركبة (تتضمن الترقيم الروماني i, ii, iii, iv). لا تقم بإنشاء أي سؤال عادي!`;
        } else if (beranak > 0) {
          beranakRuleNoteAr = `\nتنبيه هام جداً لترتيب الأسئلة (يجب الالتزام به حرفياً):
- الأسئلة المرقمة من 1 إلى ${biasaCount}: يجب أن تكون أسئلة عادية فقط.
- الأسئلة المرقمة من ${biasaCount + 1} إلى ${count}: يجب أن تكون أسئلة مركبة (يجب أن تتضمن i, ii, iii, iv).`;
        }

        formatInstructions = `
متطلبات العدد الصارمة:
- إجمالي الأسئلة: ${count} أسئلة بالضبط (مرقمة من 1 إلى ${count}).
${beranakRuleNoteAr}

تعليمات الأسئلة العادية:
- استخدم أدوات استفهام متنوعة. يجب أن يكون كل خيار حقيقة مختلفة.
- قاعدة المحاذاة: يجب وضع Tab (\\t) واحد مباشرة بعد رقم السؤال، و Tab (\\t) واحد قبل جميع الخيارات لمحاذاتها تماماً.
مثال:
1.\tكيف يُعرّف أصول الفقه في التشريع الإسلامي؟

\tA. أدلة الفقه الإجمالية
\tB. الأحكام الشرعية الفرعية
\tC. القواعد الفقهية الكلية
\tD. التواريخ التاريخية
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

تعليمات الأسئلة المركبة:
- يجب أن يبدأ كل سؤال ببيان، يليه سؤال فرعي، ثم 4 عناصر رومانية (i, ii, iii, iv).
- قاعدة المحاذاة: جميع الأسطر بعد رقم السؤال يجب أن تبدأ بـ Tab (\\t) واحد للمحاذاة العمودية الدقيقة.
مثال:
2.\tيُعتبر الإجماع المصدر الثالث من مصادر التشريع الإسلامي.

\tبناءً على النص، ما هي شروط الإجماع؟

\ti. اتفاق المجتهدين
\tii. الاعتماد على مستند
\tiii. صدوره من السلطة
\tiv. بعد وفاة النبي

\tA. i و ii
\tB. ii و iii
\tC. i و ii و iv
\tD. جميع ما ذكر
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      } else if (questionType === "true_false") {
        formatInstructions = `صيغة صح أم خطأ (${count} أسئلة). مثال:
1.\tيُعتبر القياس من الأدلة المتفق عليها عند جميع العلماء.

\t[صواب] [خطأ]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `صيغة الأسئلة المقالية (${count} أسئلة). مثال:
1.\tتلعب أصول الفقه دوراً محورياً في ضبط عملية الاجتهاد واستنباط الأحكام الشرعية.

\ta. ناقش أهمية القواعد الأصولية في فهم النصوص الشرعية. (${(sectionData?.marks || 10) / count / 2} درجات)
\tb. بين كيف يتم التعامل مع التعارض الظاهري بين الأدلة. (${(sectionData?.marks || 10) / count / 2} درجات)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    } else if (isEnglish) {
      if (questionType === "objektif") {
        let beranakRuleNoteEng = "";
        if (beranak > 0 && biasaCount === 0) {
          beranakRuleNoteEng = `\nCRITICAL ORDER WARNING: ALL ${count} questions (From Question 1 to ${count}) MUST be BRANCHED questions (with roman numerals i, ii, iii, iv). DO NOT generate any regular questions!`;
        } else if (beranak > 0) {
          beranakRuleNoteEng = `\nCRITICAL ORDER WARNING (YOU MUST STRICTLY FOLLOW THIS SEQUENCE):
- Question numbers 1 to ${biasaCount}: MUST be REGULAR objective questions.
- Question numbers ${biasaCount + 1} to ${count}: MUST be BRANCHED objective questions (with i, ii, iii, iv).`;
        }

        formatInstructions = `
STRICT QUANTITY REQUIREMENT:
- TOTAL QUESTIONS: EXACTLY ${count} QUESTIONS (numbered 1 to ${count}).
${beranakRuleNoteEng}

REGULAR OBJECTIVE INSTRUCTIONS:
- Use diverse academic question starters. Each option MUST be a distinct statement.
- ALIGNMENT RULE: You MUST place exactly 1 Tab (\\t) immediately after the question number, and 1 Tab (\\t) before all options.
EXAMPLE:
1.\tHow is the fundamental definition expressed?

\tA. As the limit of the rate
\tB. As the maximum value
\tC. As the definite integral
\tD. As the static slope
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

BRANCHED OBJECTIVE INSTRUCTIONS:
- Must start with 1 context statement, 1 follow-up question, 4 roman items (i, ii, iii, iv) and 4 options.
- ALIGNMENT RULE: ALL lines after the question number MUST start with exactly 1 Tab (\\t) for vertical alignment.
EXAMPLE:
2.\tThe function f(x) = x^2 represents a parabola.

\tBased on the statement above, which properties hold true?

\ti. The value equals 6
\tii. The rate of change is positive
\tiii. The function is strictly increasing
\tiv. The derivative is undefined

\tA. i and ii
\tB. ii and iii
\tC. i, ii, and iii
\tD. All of the above
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      } else if (questionType === "true_false") {
        formatInstructions = `Format True / False (${count} questions). EXAMPLE:
1.\tThe derivative of a constant function is always zero.

\t[TRUE] [FALSE]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `Format Essay (${count} questions). EXAMPLE:
1.\tIntegration serves as a foundational concept.

\ta. Explain the process of evaluating a definite integral. (${(sectionData?.marks || 10) / count / 2} Marks)
\tb. Derive the rate of change for the differential equation. (${(sectionData?.marks || 10) / count / 2} Marks)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    } else {
      if (questionType === "objektif") {
        let beranakRuleNote = "";
        if (beranak > 0 && biasaCount === 0) {
          beranakRuleNote = `\nAMARAN KETAT SUSUNAN: KESEMUA ${count} soalan (Dari Soalan 1 hingga ${count}) MESTILAH SOALAN BERANAK (beritem roman i, ii, iii, iv). JANGAN jana soalan biasa!`;
        } else if (beranak > 0) {
          beranakRuleNote = `\nAMARAN KETAT SUSUNAN SOALAN (ANDA WAJIB PATUH URUTAN INI):
- Soalan nombor 1 hingga ${biasaCount}: MESTILAH SOALAN BIASA SAHAJA (Tiada roman).
- Soalan nombor ${biasaCount + 1} hingga ${count}: MESTILAH SOALAN BERANAK (Wajib ada i, ii, iii, iv).`;
        }

        formatInstructions = `
PENGATURAN KUANTITI SOALAN (AMARAN SANGAT MUTLAK):
- JUMLAH KESELURUHAN SOALAN: TEPAT ${count} SOALAN (bernombor 1 hingga ${count}).
${beranakRuleNote}

ARAHAN SOALAN BIASA:
- Pelbagaikan kata soal. Setiap pilihan jawapan WAJIB fakta yang berbeza.
- ATURAN KEDUDUKAN SELARI: Anda WAJIB meletakkan 1 Tab (\\t) TEPAT selepas nombor soalan, dan 1 Tab (\\t) sebelum kesemua pilihan jawapan.
CONTOH:
1.\tBagaimanakah dasar pendidikan dapat menyatupadukan rakyat?

\tA. Melalui penggunaan bahasa kebangsaan
\tB. Dengan menghapuskan sekolah vernakular
\tC. Memperkenalkan subjek antarabangsa
\tD. Meningkatkan yuran pengajian
\t[C3] [${coStr}] [${loStr}] [${domainStr}]

ARAHAN SOALAN BERANAK:
- Mesti ada 1 ayat penyata awalan, diikuti 1 soalan susulan, 4 item roman (i, ii, iii, iv), dan 4 pilihan A, B, C, D.
- ATURAN KEDUDUKAN SELARI: KESEMUA baris di bawah penomboran WAJIB dimulakan dengan 1 Tab (\\t) untuk memastikan jajaran menegak yang lurus.
CONTOH:
2.\tPenglibatan masyarakat penting dalam pembangunan.

\tBerdasarkan pernyataan di atas, apakah langkah yang wajar?

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
1.\tAspirasi negara bangsa adalah penting.

\t[BENAR] [SALAH]
\t[C1] [${coStr}] [${loStr}] [${domainStr}]`;
      } else {
        formatInstructions = `Format Esei (${count} soalan). CONTOH WAJIB:
1.\tPendidikan memainkan peranan signifikan. Sistem ini memupuk nilai kebersamaan.

\ta. Bincangkan peranan pendidikan dalam memupuk patriotisme. (${(sectionData?.marks || 10) / count / 2} Markah)
\tb. Huraikan langkah proaktif oleh pihak sekolah. (${(sectionData?.marks || 10) / count / 2} Markah)
\t[C4] [${coStr}] [${loStr}] [${domainStr}]`;
      }
    }

    let systemPrompt = "";
    if (isArabic) {
      systemPrompt = `أنت خبير في إعداد الامتحانات الجامعية (UiTM) لمادة ${courseCode} - ${courseName}.
شرط اللغة الصارم: يجب عليك إنشاء جميع الأسئلة والنصوص والخيارات والفقرات بنسبة 100% باللغة العربية.

قاعدة الربط بالنص المرفق (STRICT CONTEXT GROUNDING):
1. يجب عليك إنشاء الأسئلة بناءً على النص المرفق أدناه فقط بنسبة 100%.
2. يُمنع منعاً باتاً اختراع أو إدخال أي مواضيع عامة خارج نطاق النص المرفق.

قم بإنشاء ${count} أسئلة بالضبط (بدون نموذج الإجابة).
${formatInstructions}

قواعد مطلقة:
1. وسم JSU ([C3] [${coStr}] [${loStr}] [${domainStr}]) يجب وضعه في السطر الأخير لكل سؤال ويكون محاذى بـ Tab (\\t). استبدل C3 بـ: ${bloomStr}.
2. يُمنع استخدام النجوم (* أو **).
3. يُمنع كتابة عناوين الأقسام.

سياق الملاحظات:
${finalContext}`;
    } else if (isEnglish) {
      systemPrompt = `You are a University Examination Question Setter (UiTM) for ${courseCode} - ${courseName}.
CRITICAL LANGUAGE MANDATE: You MUST generate ALL questions, statements, options, and text 100% ENTIRELY IN ENGLISH.

STRICT CONTEXT GROUNDING RULE:
1. You MUST generate questions 100% EXCLUSIVELY and STRICTLY based on the facts present in the COURSE NOTES / CONTEXT provided below.
2. DO NOT hallucinate or introduce outside general knowledge facts!

GENERATE EXACTLY ${count} QUESTIONS ONLY (NO ANSWER SCHEME/SOLUTIONS).
${formatInstructions}

ABSOLUTE RULES:
1. JSU TAG ([C3] [${coStr}] [${loStr}] [${domainStr}]) MUST be placed at the very bottom line of every question and MUST be indented with 1 tab (\\t). Replace C3 with: ${bloomStr}.
2. DO NOT use bullet points (* or **).
3. DO NOT write section headers.

COURSE NOTES CONTEXT:
${finalContext}`;
    } else {
      systemPrompt = `Anda adalah Pakar Penggubal Soalan Peperiksaan Universiti (UiTM) bagi ${courseCode} - ${courseName} dalam ${language}.

ARAHAN PENGIKATAN DOKUMEN / NOTA (STRICT CONTEXT GROUNDING MUTLAK):
1. Anda WAJIB menggubal soalan 100% BERDASARKAN DAN BERSUMBERKAN TEKS NOTA KURSUS di bawah SAHAJA.
2. DILARANG SAMA SEKALI mereka-reka atau membawa masuk fakta am di luar kandungan dokumen!

JANA TEPAT ${count} SOALAN SAHAJA (TANPA SKEMA/JAWAPAN).
${formatInstructions}

PERATURAN MUTLAK:
1. TAG JSU ([C3] [${coStr}] [${loStr}] [${domainStr}]) WAJIB ada di baris akhir setiap soalan dan WAJIB di-tab (\\t). Ganti C3 dengan: ${bloomStr}.
2. DILARANG menggunakan tanda bintik (* atau **).
3. DILARANG meletakkan sebarang tajuk bahagian.

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

    const finalCleanData = cleanAndTransformQuestions(rawOutput, language);

    return NextResponse.json({ success: true, data: finalCleanData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ralat API OpenAI." }, { status: 500 });
  }
}