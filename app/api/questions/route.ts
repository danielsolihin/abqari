import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Inisialisasi Supabase (Menggunakan SERVICE_ROLE_KEY untuk BYPASS segala sekatan RLS)
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. GET: AMBIL SENARAI SOALAN (Boleh filter ikut subject_id)
// ==========================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subject_id');

    let query = supabase
      .from('questions')
      .select(`
        *,
        subjects (name, course_code)
      `) // Kita 'join' dengan table subjects untuk dapatkan nama & kod kursus
      .order('created_at', { ascending: false });

    // Jika dipanggil dengan ?subject_id=xxx, kita filter
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Ralat GET Questions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 2. POST: TAMBAH SOALAN BAHARU
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Semak jika data asas wujud
    if (!body.subject_id || !body.question_text) {
      return NextResponse.json({ success: false, error: 'ID Subjek dan Teks Soalan adalah wajib.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('questions')
      .insert([{
        subject_id: body.subject_id,
        question_text: body.question_text,
        answer_scheme: body.answer_scheme || '',
        marks: body.marks || 10,
        bloom_level: body.bloom_level || '',
        co_code: body.co_code || '',
        lo_code: body.lo_code || '',
        difficulty: body.difficulty || 'Sederhana'
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Soalan berjaya ditambah ke Bank Soalan.', data: data[0] });
  } catch (error: any) {
    console.error('Ralat POST Questions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 3. DELETE: PADAM SOALAN
// ==========================================
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Soalan diperlukan untuk dipadam.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Soalan berjaya dipadamkan.' });
  } catch (error: any) {
    console.error('Ralat DELETE Questions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}