import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ success: false, error: 'Tiada token akses' }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    
    if (authErr || !user) return NextResponse.json({ success: false, error: 'Pengguna tidak sah' }, { status: 401 });

    const body = await req.json();
    const cost = body.cost || 1; // Kos bergantung kepada jenis enjin

    const meta = user.user_metadata || {};
    const isAdmin = meta.role === 'admin' || meta.is_unlimited === true || ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'].includes(user.email || '');

    // Jika Superadmin, tiada tolakan kredit dilakukan
    if (isAdmin) {
      return NextResponse.json({ success: true, message: 'Akses Tanpa Had' });
    }

    // Ambil tarikh zon waktu Malaysia hari ini
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); 
    let currentUsage = meta.daily_usage || 0;
    let lastDate = meta.last_generation_date || '';

    // RESET HARIAN: Jika tarikh terakhir jana BUKAN hari ini, reset penggunaan ke 0
    if (lastDate !== today) {
      currentUsage = 0;
      lastDate = today;
    }

    // TETAPAN KREDIT AUTOMATIK: Lalai (Default) sentiasa 5 untuk pensyarah
    const dailyLimit = meta.daily_limit !== undefined ? meta.daily_limit : 5; 
    const bonusCredit = meta.bonus_credit || 0;
    
    const totalAvailable = dailyLimit + bonusCredit - currentUsage;

    if (totalAvailable < cost) {
      return NextResponse.json({ success: false, error: 'Baki kredit harian tidak mencukupi.' }, { status: 400 });
    }

    // Tolak Kredit (Tambahkan jumlah penggunaan)
    currentUsage += cost;

    // Simpan rekod penggunaan terkini dan tarikh ke dalam pangkalan data
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { 
        ...meta,
        daily_usage: currentUsage,
        last_generation_date: lastDate,
        daily_limit: dailyLimit 
      }
    });

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, remaining: dailyLimit + bonusCredit - currentUsage });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}