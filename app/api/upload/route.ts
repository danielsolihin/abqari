import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ============================================================
 * KONFIGURASI
 * ============================================================
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'documents';

/**
 * Gemini embedding dimension.
 *
 * Pastikan column:
 * document_chunks.embedding
 *
 * menggunakan:
 * vector(768)
 */
const EMBEDDING_DIMENSIONS = 768;

/**
 * Saiz chunk teks.
 *
 * gemini-embedding-001 mempunyai had input
 * sekitar 2,048 token.
 *
 * 800 aksara biasanya jauh lebih selamat.
 */
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;


/**
 * ============================================================
 * SEMAK ENVIRONMENT VARIABLES
 * ============================================================
 */

if (!SUPABASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL tidak ditetapkan.'
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY tidak ditetapkan.'
  );
}

if (!GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY tidak ditetapkan.'
  );
}


/**
 * ============================================================
 * SUPABASE SERVER CLIENT
 * ============================================================
 */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);


/**
 * ============================================================
 * GEMINI CLIENT
 * ============================================================
 */

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});


/**
 * ============================================================
 * FUNGSI CHUNK TEXT
 * ============================================================
 */

function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  chunkOverlap = CHUNK_OVERLAP
): string[] {

  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) {
    return [];
  }

  const chunks: string[] = [];

  let start = 0;

  while (start < cleanedText.length) {

    const end = Math.min(
      start + chunkSize,
      cleanedText.length
    );

    const chunk = cleanedText
      .slice(start, end)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleanedText.length) {
      break;
    }

    start += chunkSize - chunkOverlap;
  }

  return chunks;
}


/**
 * ============================================================
 * NAMA FAIL SELAMAT
 * ============================================================
 */

function sanitizeFileName(fileName: string): string {

  return fileName
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}


/**
 * ============================================================
 * GENERATE UNIQUE STORAGE PATH
 * ============================================================
 */

function createStoragePath(
  subjectId: string,
  fileName: string
): string {

  const safeName = sanitizeFileName(fileName);

  const timestamp = Date.now();

  const random =
    Math.random()
      .toString(36)
      .substring(2, 10);

  return `${subjectId}/${timestamp}-${random}-${safeName}`;
}


/**
 * ============================================================
 * GEMINI EMBEDDING
 * ============================================================
 */

async function generateEmbedding(
  text: string
): Promise<number[]> {

  const response = await ai.models.embedContent({

    model: 'gemini-embedding-001',

    contents: text,

    config: {
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },

  });

  const embedding =
    response.embeddings?.[0]?.values;

  if (
    !embedding ||
    !Array.isArray(embedding)
  ) {
    throw new Error(
      'Gemini tidak menghasilkan embedding.'
    );
  }

  if (
    embedding.length !==
    EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Dimensi embedding tidak betul. ` +
      `Dijangka ${EMBEDDING_DIMENSIONS}, ` +
      `tetapi menerima ${embedding.length}.`
    );
  }

  return embedding;
}


/**
 * ============================================================
 * POST /api/upload
 * ============================================================
 */

export async function POST(
  req: NextRequest
) {

  let documentId: string | null = null;
  let storagePath: string | null = null;

  try {

    console.log(
      '[UPLOAD] Mula proses upload PDF'
    );


    /**
     * --------------------------------------------------------
     * 1. TERIMA FORM DATA
     * --------------------------------------------------------
     */

    const formData =
      await req.formData();

    const file =
      formData.get('file');

    const subjectId =
      formData.get('subjectId');


    /**
     * --------------------------------------------------------
     * 2. SEMAK FILE
     * --------------------------------------------------------
     */

    if (!(file instanceof File)) {

      return NextResponse.json(
        {
          success: false,
          error:
            'Fail PDF diperlukan.',
        },
        {
          status: 400,
        }
      );
    }


    /**
     * --------------------------------------------------------
     * 3. SEMAK SUBJECT ID
     * --------------------------------------------------------
     */

    if (
      typeof subjectId !== 'string' ||
      !subjectId.trim()
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            'ID Subjek diperlukan.',
        },
        {
          status: 400,
        }
      );
    }


    const cleanSubjectId =
      subjectId.trim();


    /**
     * --------------------------------------------------------
     * 4. SEMAK PDF
     * --------------------------------------------------------
     */

    const fileName =
      file.name || 'document.pdf';

    const lowerFileName =
      fileName.toLowerCase();

    if (
      !lowerFileName.endsWith('.pdf')
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            'Hanya fail PDF dibenarkan.',
        },
        {
          status: 400,
        }
      );
    }


    /**
     * Saiz fail maksimum.
     *
     * Boleh ubah jika perlu.
     *
     * 20 MB = 20 * 1024 * 1024
     */

    const MAX_FILE_SIZE =
      20 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {

      return NextResponse.json(
        {
          success: false,
          error:
            'Saiz PDF terlalu besar. ' +
            'Maksimum 20 MB.',
        },
        {
          status: 400,
        }
      );
    }


    if (file.size === 0) {

      return NextResponse.json(
        {
          success: false,
          error:
            'Fail PDF kosong.',
        },
        {
          status: 400,
        }
      );
    }


    console.log(
      `[UPLOAD] Fail: ${fileName}`
    );

    console.log(
      `[UPLOAD] Saiz: ${file.size} bytes`
    );

    console.log(
      `[UPLOAD] Subject: ${cleanSubjectId}`
    );


    /**
     * --------------------------------------------------------
     * 5. SEMAK DUPLICATE
     * --------------------------------------------------------
     */

    const {
      data: existingDoc,
      error: duplicateError,
    } = await supabase

      .from('documents')

      .select('id, file_name')

      .eq(
        'subject_id',
        cleanSubjectId
      )

      .eq(
        'file_name',
        fileName
      )

      .maybeSingle();


    if (duplicateError) {

      throw new Error(
        'Ralat menyemak dokumen pendua: ' +
        duplicateError.message
      );
    }


    if (existingDoc) {

      return NextResponse.json(
        {
          success: false,
          error:
            `Fail "${fileName}" telah wujud ` +
            `untuk subjek ini. ` +
            `Sila padam fail lama terlebih dahulu.`,
        },
        {
          status: 409,
        }
      );
    }


    /**
     * --------------------------------------------------------
     * 6. BACA PDF KE BUFFER
     * --------------------------------------------------------
     */

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);


    /**
     * Semak PDF signature.
     *
     * PDF biasanya bermula dengan:
     *
     * %PDF-
     */

    const pdfHeader =
      buffer
        .subarray(0, 5)
        .toString('ascii');

    if (pdfHeader !== '%PDF-') {

      return NextResponse.json(
        {
          success: false,
          error:
            'Fail tersebut bukan PDF yang sah.',
        },
        {
          status: 400,
        }
      );
    }


    /**
     * --------------------------------------------------------
     * 7. EXTRACT TEXT DENGAN PDF-PARSE V2
     * --------------------------------------------------------
     */

    console.log(
      '[PDF] Mula membaca kandungan PDF...'
    );

    const parser =
      new PDFParse({
        data: buffer,
      });

    let extractedText = '';

    try {

      const result =
        await parser.getText();

      extractedText =
        result.text || '';

    } finally {

      await parser.destroy();

    }


    /**
     * --------------------------------------------------------
     * 8. SEMAK TEXT
     * --------------------------------------------------------
     */

    extractedText =
      extractedText.trim();


    if (!extractedText) {

      return NextResponse.json(
        {
          success: false,
          error:
            'Teks PDF kosong. ' +
            'PDF ini mungkin merupakan ' +
            'dokumen scan/gambar tanpa text layer. ' +
            'Sila gunakan OCR terlebih dahulu.',
        },
        {
          status: 400,
        }
      );
    }


    console.log(
      `[PDF] Text berjaya diekstrak: ` +
      `${extractedText.length} aksara`
    );


    /**
     * --------------------------------------------------------
     * 9. UPLOAD PDF SEBENAR KE SUPABASE STORAGE
     * --------------------------------------------------------
     */

    storagePath =
      createStoragePath(
        cleanSubjectId,
        fileName
      );


    console.log(
      `[STORAGE] Upload: ${storagePath}`
    );


    const {
      error: storageError,
    } = await supabase

      .storage

      .from(STORAGE_BUCKET)

      .upload(
        storagePath,
        buffer,
        {
          contentType:
            'application/pdf',

          cacheControl:
            '3600',

          upsert:
            false,
        }
      );


    if (storageError) {

      throw new Error(
        'Gagal upload PDF ke Supabase Storage: ' +
        storageError.message
      );
    }


    /**
     * --------------------------------------------------------
     * 10. SIMPAN DOKUMEN
     * --------------------------------------------------------
     */

    console.log(
      '[DATABASE] Menyimpan document...'
    );


    const {
      data: docData,
      error: docError,
    } = await supabase

      .from('documents')

      .insert([
        {
          subject_id:
            cleanSubjectId,

          file_url:
            storagePath,

          file_name:
            fileName,
        },
      ])

      .select('id')
      .single();


    if (docError) {

      throw new Error(
        'Gagal menyimpan dokumen ke database: ' +
        docError.message
      );
    }


    if (!docData?.id) {

      throw new Error(
        'ID dokumen tidak diterima selepas insert.'
      );
    }


    documentId =
      docData.id;


    console.log(
      `[DATABASE] Document ID: ${documentId}`
    );


    /**
     * --------------------------------------------------------
     * 11. PECAHKAN TEXT
     * --------------------------------------------------------
     */

    const chunks =
      chunkText(
        extractedText
      );


    if (chunks.length === 0) {

      throw new Error(
        'Tiada kandungan teks untuk diproses.'
      );
    }


    console.log(
      `[CHUNK] Jumlah chunk: ${chunks.length}`
    );


    /**
     * --------------------------------------------------------
     * 12. GENERATE EMBEDDING + SIMPAN CHUNKS
     * --------------------------------------------------------
     */

    for (
      let i = 0;
      i < chunks.length;
      i++
    ) {

      const chunk =
        chunks[i];


      console.log(
        `[EMBEDDING] `
        + `Memproses chunk `
        + `${i + 1}/${chunks.length}`
      );


      /**
       * Generate embedding
       */

      const embedding =
        await generateEmbedding(
          chunk
        );


      /**
       * Simpan chunk
       */

      const {
        error: chunkError,
      } = await supabase

        .from('document_chunks')

        .insert([
          {
            document_id:
              documentId,

            content:
              chunk,

            embedding:
              embedding,
          },
        ]);


      if (chunkError) {

        throw new Error(
          `Gagal menyimpan chunk ` +
          `${i + 1}/${chunks.length}: ` +
          `${chunkError.message}`
        );
      }
    }


    /**
     * --------------------------------------------------------
     * 13. BERJAYA
     * --------------------------------------------------------
     */

    console.log(
      '[UPLOAD] PDF berjaya diproses sepenuhnya.'
    );


    return NextResponse.json(
      {
        success: true,

        message:
          'Fail PDF berjaya dimuat naik, ' +
          'dibaca dan diproses.',

        documentId:
          documentId,

        fileName:
          fileName,

        chunks:
          chunks.length,

        storagePath:
          storagePath,
      },
      {
        status: 200,
      }
    );


  } catch (error: unknown) {


    /**
     * --------------------------------------------------------
     * ERROR HANDLING
     * --------------------------------------------------------
     */

    console.error(
      '[UPLOAD ERROR]',
      error
    );


    /**
     * Dapatkan mesej error yang selamat
     */

    let errorMessage =
      'Ralat pelayan semasa memproses PDF.';


    if (error instanceof Error) {

      errorMessage =
        error.message;
    }


    /**
     * --------------------------------------------------------
     * CLEANUP DATABASE
     * --------------------------------------------------------
     *
     * Jika document sudah dimasukkan tetapi
     * proses embedding gagal, padam document
     * supaya tidak tinggal record separuh siap.
     */

    if (documentId) {

      console.log(
        `[CLEANUP] Padam document ${documentId}`
      );


      const {
        error: deleteChunkError,
      } = await supabase

        .from('document_chunks')

        .delete()

        .eq(
          'document_id',
          documentId
        );


      if (deleteChunkError) {

        console.error(
          '[CLEANUP] Gagal padam chunks:',
          deleteChunkError
        );
      }


      const {
        error: deleteDocError,
      } = await supabase

        .from('documents')

        .delete()

        .eq(
          'id',
          documentId
        );


      if (deleteDocError) {

        console.error(
          '[CLEANUP] Gagal padam document:',
          deleteDocError
        );
      }
    }


    /**
     * --------------------------------------------------------
     * CLEANUP STORAGE
     * --------------------------------------------------------
     */

    if (storagePath) {

      const {
        error: removeStorageError,
      } = await supabase

        .storage

        .from(STORAGE_BUCKET)

        .remove([
          storagePath,
        ]);


      if (removeStorageError) {

        console.error(
          '[CLEANUP] Gagal padam fail Storage:',
          removeStorageError
        );
      }
    }


    /**
     * --------------------------------------------------------
     * RETURN ERROR
     * --------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: false,

        error:
          errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}