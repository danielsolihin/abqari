import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// WAJIB GUNA SERVICE ROLE KEY UNTUK FUNGSI ADMIN AUTH (Bypass RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

// Cipta client dengan hak admin penuh
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// GET: Ambil senarai semua pengguna berdaftar dalam sistem
export async function GET() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;

    // Susun data supaya cantik untuk dibaca oleh Jadual Frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name || 'Tiada Nama',
      role: user.user_metadata?.role || 'pensyarah',
      faculty: user.user_metadata?.faculty || 'Fakulti Pengajian'
    }));

    return NextResponse.json({ success: true, data: formattedUsers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Cipta pengguna baharu oleh Admin
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, role, faculty } = body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // MAGIK: Auto-sahkan e-mel, pengguna boleh terus log masuk!
      user_metadata: {
        name: name,
        full_name: name,
        role: role,
        faculty: faculty
      }
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data.user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE: Padam pengguna
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) throw new Error('ID Pengguna diperlukan.');

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Pengguna berjaya dipadam' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}