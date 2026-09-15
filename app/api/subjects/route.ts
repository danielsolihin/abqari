import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
// export const dynamic = 'force-static'; // DITUKAR: Memastikan penyesuaian dengan output: 'export'

// Inisialisasi sambungan ke Supabase menggunakan Environment Variables (.env)
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. GET: AMBIL SENARAI SEMUA SUBJEK
// ==========================================
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Ralat GET Subjects:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 2. POST: DAFTAR SUBJEK BAHARU
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, courseCode, co, lo } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Nama kursus diperlukan.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('subjects')
      .insert([
        { 
          name: name, 
          course_code: courseCode || 'TIADA', 
          co: co || [], 
          lo: lo || [] 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Ralat POST Subject:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 3. PUT: KEMAS KINI MAKLUMAT SUBJEK (EDIT)
// ==========================================
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, courseCode, co, lo } = body;

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'ID dan Nama kursus diperlukan.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('subjects')
      .update({ 
        name: name, 
        course_code: courseCode || 'TIADA', 
        co: co || [], 
        lo: lo || [] 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Ralat PUT Subject:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 4. DELETE: PADAM SUBJEK
// ==========================================
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID kursus diperlukan.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Subjek berjaya dipadamkan.' });
  } catch (error: any) {
    console.error('Ralat DELETE Subject:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}