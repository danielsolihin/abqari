import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import PDFParser from "pdf2json";
import { pipeline } from "@xenova/transformers";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================================
// ENVIRONMENT & SUPABASE SETUP
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// ============================================================
// SINGLETON FOR LOCAL TRANSFORMERS MODEL (768 DIMENSIONS)
// ============================================================
class PipelineSingleton {
  static task = "feature-extraction" as const;
  static model = "Xenova/bge-base-en-v1.5"; // Tepat 768 dimensi
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
// CHUNK TEXT
// ============================================================
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  const cleanedText = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleanedText) return [];

  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < cleanedText.length; i += step) {
    const chunk = cleanedText.slice(i, i + chunkSize).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

// ============================================================
// EXTRACT PDF TEXT (PDF2JSON)
// ============================================================
async function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData?.parserError || "Gagal mengekstrak teks PDF."));
    });

    pdfParser.on("pdfParser_dataReady", () => {
      let rawText = pdfParser.getRawTextContent();
      try {
        rawText = decodeURIComponent(rawText);
      } catch {
        // Kekalkan teks asal jika tiada pengekodan URI
      }
      resolve(rawText ? rawText.replace(/\u0000/g, "").trim() : "");
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ============================================================
// POST (FUNGSI UTAMA API)
// ============================================================
export async function POST(req: NextRequest) {
  let createdDocumentId: string | null = null;

  try {
    const formData = await req.formData();
    const fileValue = formData.get("file");
    const subjectCodeValue = formData.get("subject_id") ?? formData.get("subjectId");

    if (!(fileValue instanceof File)) return NextResponse.json({ error: "Fail PDF diperlukan." }, { status: 400 });
    const file = fileValue;

    const subjectCode = typeof subjectCodeValue === "string" ? subjectCodeValue.trim() : "";
    if (!subjectCode) return NextResponse.json({ error: "Kod subjek diperlukan." }, { status: 400 });

    const fileName = file.name?.trim();
    if (!fileName) return NextResponse.json({ error: "Nama fail tidak sah." }, { status: 400 });

    // 1. CARI SUBJEK BERDASARKAN KOD KURSUS
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id")
      .ilike("course_code", `%${subjectCode}%`)
      .maybeSingle();

    if (subjectError) throw new Error("Gagal mencari subjek: " + subjectError.message);
    if (!subject) return NextResponse.json({ error: `Kod subjek "${subjectCode}" tidak ditemui.` }, { status: 404 });

    const subjectId = subject.id;

    // 2. SEMAK DOKUMEN DUPLIKAT
    const { data: existingDocument, error: duplicateError } = await supabase
      .from("documents")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("file_name", fileName)
      .maybeSingle();

    if (duplicateError) throw new Error("Gagal menyemak dokumen sedia ada: " + duplicateError.message);
    if (existingDocument) return NextResponse.json({ error: `Fail "${fileName}" telah wujud untuk subjek ini.` }, { status: 409 });

    // 3. EKSTRAK TEKS PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rawText = await extractPdfText(buffer);

    if (!rawText) return NextResponse.json({ error: "Teks tidak dapat diekstrak. PDF mungkin berformat gambar." }, { status: 400 });

    // 4. POTONG TEKS KEPADA BONGKAH (CHUNKS)
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return NextResponse.json({ error: "Tiada kandungan teks untuk diproses." }, { status: 400 });

    // 5. CIPTA REKOD DOKUMEN UTAMA
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({ subject_id: subjectId, file_name: fileName, file_url: fileName })
      .select("id")
      .single();

    if (documentError || !document) throw new Error("Gagal menyimpan dokumen: " + (documentError?.message || "Tiada ID."));
    createdDocumentId = document.id;

    // 6. HASILKAN EMBEDDING SECARA TEMPATAN & SIMPAN CHUNKS
    const chunkRows = [];
    for (const chunk of chunks) {
      const embedding = await getLocalEmbedding(chunk);
      chunkRows.push({ document_id: createdDocumentId, content: chunk, embedding });
    }

    const { error: chunksError } = await supabase.from("document_chunks").insert(chunkRows);
    if (chunksError) throw new Error("Gagal menyimpan chunks: " + chunksError.message);

    return NextResponse.json({
      success: true,
      message: `Sistem RAG Berjaya (Local AI): Fail "${fileName}" diekstrak kepada ${chunkRows.length} bongkah memori.`,
    }, { status: 200 });

  } catch (error: any) {
    if (createdDocumentId) {
      try {
        await supabase.from("document_chunks").delete().eq("document_id", createdDocumentId);
        await supabase.from("documents").delete().eq("id", createdDocumentId);
      } catch (e) {
        console.error("Cleanup Error", e);
      }
    }
    return NextResponse.json({ error: error.message || "Ralat Pelayan" }, { status: 500 });
  }
}