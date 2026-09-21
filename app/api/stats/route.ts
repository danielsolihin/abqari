import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    // WAJIB GUNA SERVICE ROLE KEY UNTUK TEMBUS RLS SUPABASE
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      return NextResponse.json({ success: false, error: 'Kunci Service Role tiada.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tarik semua pengguna dari sistem teras Auth Supabase
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;

    const totalUsers = users.length;
    
    // Kira pengguna yang belum diluluskan (pending) berdasarkan profil/metadata
    // PENYELESAIAN TYPESCRIPT: Letak (u: any) di sini
    const pendingUsers = users.filter((u: any) => {
      const meta = u.user_metadata || {};
      return meta.status === 'pending' || meta.is_approved === false || (!meta.is_approved && meta.status !== 'approved');
    }).length;

    return NextResponse.json({ success: true, totalUsers, pendingUsers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}