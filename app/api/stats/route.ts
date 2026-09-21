import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      return NextResponse.json({ success: false, error: 'Kunci Service Role tiada.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Kira jumlah keseluruhan pengguna dari Auth
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) throw authErr;
    const totalUsers = users.length;

    // 2. Semak status terkini secara TEPAT dari jadual 'profiles'
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, status, is_approved');
    
    let pendingUsers = 0;

    if (!profErr && profiles && profiles.length > 0) {
      // PENAPISAN PALING KETAT: Hanya kira jika status ditulis TEPAT sebagai 'pending'.
      // Kita abaikan is_approved === false kerana ia mungkin tersangkut pada akaun lama.
      pendingUsers = profiles.filter((p: any) => p.status === 'pending').length;
    } else {
      // Fallback untuk metadata Auth
      pendingUsers = users.filter((u: any) => {
        const meta = u.user_metadata || {};
        return meta.status === 'pending'; // Hanya baca perkataan 'pending'
      }).length;
    }

    return NextResponse.json({ success: true, totalUsers, pendingUsers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}