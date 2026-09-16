import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// KUNCI UTAMA: Mematikan cache Next.js supaya senarai sentiasa segar (live)
export const dynamic = 'force-dynamic'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pangkalan Data Client
const dbClient = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey
);

// 1. Ambil senarai subjek (GET) - BEBAS AKSES KESELAMATAN SEMENTARA WAKTU
export async function GET(req: Request) {
  try {
    const { data, error } = await dbClient
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
    const { name, courseCode, co, lo, userId } = body;

    const { data, error } = await dbClient
      .from('subjects')
      .insert([
        {
          name,
          course_code: courseCode || 'TIADA',
          co: co || [],
          lo: lo || [],
          user_id: userId || 'public-user', // ID Sementara jika tiada log masuk
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

    const { data, error } = await dbClient
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

    const { error } = await dbClient.from('subjects').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}