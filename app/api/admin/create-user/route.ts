import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, faculty } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Emel dan kata laluan diperlukan.' }, { status: 400 });
    }

    // Cipta pengguna & sahkan emel automatik (email_confirm: true)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        name,
        faculty,
        role: role || 'pensyarah',
      },
    });

    if (createError) throw createError;

    return NextResponse.json({ success: true, user: userData.user });
  } catch (error: any) {
    console.error('Ralat pendaftaran admin:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mencipta pengguna.' },
      { status: 500 }
    );
  }
}