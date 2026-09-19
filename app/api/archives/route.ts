import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
// DITAMBAH: Untuk menyokong output static export

// Inisialisasi Supabase
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. GET: AMBIL SENARAI ARKIB SOALAN
// ==========================================
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      // Susun mengikut tarikh terkini di atas
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Ralat GET Archives:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 2. DELETE: PADAM ARKIB SOALAN
// ==========================================
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Arkib diperlukan.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('archives')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Arkib berjaya dipadamkan.' });
  } catch (error: any) {
    console.error('Ralat DELETE Archive:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
// ==========================================
// 3. POST: SIMPAN ARKIB BAHARU (AUTO-SIMPAN)
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // API ini menggunakan SERVICE_ROLE_KEY, jadi ia akan sentiasa berjaya menyimpan data
    const { error } = await supabase.from('archives').insert([body]);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Berjaya disimpan ke Arkib.' });
  } catch (error: any) {
    console.error('Ralat POST Archive:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}