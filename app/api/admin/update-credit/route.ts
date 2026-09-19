import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, dailyLimit, bonusCredit, isUnlimited } = body;

    if (!userId) throw new Error('ID Pengguna diperlukan.');

    // Mesti guna Service Role Key untuk update metadata pengguna lain
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Update metadata kredit di Supabase
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        daily_limit: dailyLimit,
        bonus_credit: bonusCredit,
        is_unlimited: isUnlimited
      }
    });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Tetapan kredit berjaya disimpan.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}