import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Ambil senarai subjek (GET)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. Tambah subjek baharu (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, courseCode, co, lo } = body;

    const { data, error } = await supabase
      .from('subjects')
      .insert([
        {
          name,
          course_code: courseCode || 'TIADA',
          co: co || [],
          lo: lo || [],
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. Kemas kini subjek (PUT)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, courseCode, co, lo } = body;

    const { data, error } = await supabase
      .from('subjects')
      .update({
        name,
        course_code: courseCode || 'TIADA',
        co: co || [],
        lo: lo || [],
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 4. Padam subjek (DELETE)
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}