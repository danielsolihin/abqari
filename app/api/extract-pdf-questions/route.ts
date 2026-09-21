import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractText, getDocumentProxy } from 'unpdf';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fungsi Pemformatan Automatik untuk Memasukkan Jarak Perenggan (<1 tab jarak>)
function autoFormatQuestions(text: string): string {
  if (!text) return '';
  let formatted = text;

  // 1. Jarak sebelum ayat arahan "Berdasarkan..."
  formatted = formatted.replace(/\s+(Berdasarkan\s+pernyataan\s+di\s+atas[^\n]*\?)/gi, '\n\n$1');

  // 2. Jarak sebelum penyataan pertama (i. atau i))
  formatted = formatted.replace(/\s+(i[\.\)]\s+)/gi, '\n\n$1');
  // Penyataan seterusnya (ii, iii, iv, v) di baris baharu
  formatted = formatted.replace(/\s+((?:ii|iii|iv|v|vi)[\.\)])\s+/gi, '\n$1');

  // 3. Jarak sebelum pilihan jawapan pertama (A. atau A))
  formatted = formatted.replace(/\s+(A[\.\)]\s+)/gi, '\n\n$1');
  // Pilihan jawapan seterusnya (B, C, D) di baris baharu
  formatted = formatted.replace(/\s+([B-D][\.\)]\s+)/gi, '\n$1');

  // 4. Jarak sebelum sub-soalan esei (a, b, c)
  formatted = formatted.replace(/\s+([a-eA-E][\.\)])\s+/g, '\n\n$1');

  return formatted.trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subject_id = formData.get('subject_id') as string;

    if (!file || !subject_id) {
      return NextResponse.json({ success: false, error: 'Fail PDF atau ID Subjek tidak ditemui.' }, { status: 400 });
    }

    let pdfText = '';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfProxy = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const extracted = await extractText(pdfProxy, { mergePages: true });
      
      pdfText = Array.isArray(extracted.text) ? extracted.text.join('\n') : (extracted.text || '');
    } catch (err: any) {
      console.error('Ralat pembacaan unpdf:', err);
      return NextResponse.json({ 
        success: false, 
        error: `Gagal memproses fail PDF: ${err.message || 'Format tidak disokong'}` 
      }, { status: 400 });
    }

    const cleanedText = pdfText.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();

    if (!cleanedText || cleanedText.length < 5) {
      return NextResponse.json({ 
        success: false, 
        error: 'Dokumen ini tidak mengandungi teks yang boleh dibaca.' 
      }, { status: 400 });
    }

    // Prompt OpenAI
    const systemPrompt = `Anda adalah pakar penggubal soalan peperiksaan. Tugas anda adalah mengekstrak SEMUA soalan daripada teks dengan tepat.

Format JSON SAHAJA:
{
  "questions": [
    {
      "question_type": "objektif" atau "esei",
      "question_text": "Teks soalan penuh berserta penyataan i, ii, iii jika ada. Pisahkan perenggan soalan, penyataan, dan soalan utama dengan dua selang baris (\\n\\n).",
      "options": ["A. Pilihan 1", "B. Pilihan 2", "C. Pilihan 3", "D. Pilihan 4"],
      "marks": 1,
      "bloom_level": "C1",
      "difficulty": "Mudah",
      "answer_scheme": "Skema jawapan jika ada"
    }
  ]
}

Syarat:
1. Kekalkan penyataan i, ii, iii, iv di dalam 'question_text'.
2. Masukkan pilihan A, B, C, D ke dalam array 'options'.
3. Gunakan \\n\\n antara perenggan pernyataan, arahan soalan, dan penyataan.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanedText }
      ],
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0].message.content || '{}';
    const parsedData = JSON.parse(responseContent);
    const extractedQuestions = parsedData.questions || [];

    if (extractedQuestions.length === 0) {
      return NextResponse.json({ success: false, error: 'AI tidak menemui soalan.' }, { status: 400 });
    }

    const insertData = extractedQuestions.map((q: any) => {
      let mainText = q.question_text || '';

      // Terapkan jarak perenggan (<1 tab jarak>)
      mainText = autoFormatQuestions(mainText);

      // Tambah pilihan A, B, C, D di bawah dengan jarak perenggan
      if (q.question_type === 'objektif' && Array.isArray(q.options) && q.options.length > 0) {
        mainText += '\n\n' + q.options.join('\n');
      }

      return {
        subject_id: subject_id,
        question_text: mainText,
        answer_scheme: q.answer_scheme || '',
        marks: q.marks || (q.question_type === 'objektif' ? 1 : 5),
        bloom_level: q.bloom_level || 'C1',
        difficulty: q.difficulty || 'Mudah',
        co_code: 'CO1',
        lo_code: 'LO1',
      };
    });

    const { error: insertError } = await supabase.from('questions').insert(insertData);

    if (insertError) {
      throw new Error(`Ralat pangkalan data: ${insertError.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      extracted_count: extractedQuestions.length 
    });

  } catch (error: any) {
    console.error('Ralat API Ekstraksi PDF:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Gagal memproses fail PDF.' 
    }, { status: 500 });
  }
}