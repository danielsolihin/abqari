import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================================
// ENVIRONMENT & SETUP
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// ============================================================
// SINGLETON LOCAL EMBEDDING (100% SAMA DENGAN UPLOAD-RAG)
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
// POST - FUNGSI BERTANYA SOALAN
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, subjectCode } = body;

    if (!question || !subjectCode) {
      return NextResponse.json({ error: "Sila berikan soalan dan kod subjek." }, { status: 400 });
    }

    // 1. Dapatkan ID Subjek dari pangkalan data
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id")
      .ilike("course_code", `%${subjectCode.trim()}%`)
      .maybeSingle();

    if (subjectError || !subject) {
      return NextResponse.json({ error: `Kod subjek "${subjectCode}" tidak ditemui.` }, { status: 404 });
    }

    // 2. Tukar soalan pengguna kepada vektor tempatan (768 Dimensions)
    const queryEmbedding = await getLocalEmbedding(question);

    // 3. Cari 5 bongkah nota paling tepat menggunakan fungsi match_document_chunks
    const { data: chunks, error: matchError } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // Ambang kejituan
      match_count: 5,       // Ambil 5 perenggan paling relevan
      filter_subject_id: subject.id,
    });

    if (matchError) throw new Error("Gagal mencari nota: " + matchError.message);

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ 
        answer: "Maaf, tiada maklumat yang relevan ditemui di dalam nota PDF bagi subjek ini." 
      });
    }

    // 4. Cantumkan perenggan nota menjadi konteks rujukan
    const contextText = chunks.map((c: any) => c.content).join("\n\n---\n\n");

    // 5. Suruh Gemini AI merangka jawapan berpandukan nota PDF sahaja
    const prompt = `Anda adalah Pembantu AI Akademik. 
Jawab soalan berikut secara profesional HANYA berdasarkan KONTEKS NOTA yang diberikan di bawah.
Jika jawapan tiada di dalam konteks nota, jawab dengan jujur: "Maklumat ini tiada dalam nota PDF yang dimuat naik."

KONTEKS NOTA PDF:
${contextText}

SOALAN:
${question}

JAWAPAN (Bahasa Melayu):`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return NextResponse.json({
      success: true,
      answer: response.text,
      sources_matched: chunks.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Ralat Query RAG:", error);
    return NextResponse.json({ error: error.message || "Ralat pelayan semasa mencari jawapan." }, { status: 500 });
  }
}
