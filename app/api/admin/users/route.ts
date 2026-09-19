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

export async function GET() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) throw error;

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name || 'Tiada Nama',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Tiada Nama',
      role: user.user_metadata?.role || 'pensyarah',
      faculty: user.user_metadata?.faculty || '-',
      phone: user.user_metadata?.phone_number || '-',
      is_approved: user.user_metadata?.is_approved || false,
      status: user.user_metadata?.status || 'pending',
      created_at: user.created_at,
      
      // KUNCI PENYELESAIAN KREDIT ADA DI SINI 👇
      daily_limit: user.user_metadata?.daily_limit ?? 15,
      bonus_credit: user.user_metadata?.bonus_credit ?? 0,
      is_unlimited: user.user_metadata?.is_unlimited ?? false
    }));

    formattedUsers.sort((a, b) => (a.status === 'pending' ? -1 : 1));

    return NextResponse.json({ success: true, data: formattedUsers, users: formattedUsers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, role, faculty } = body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        full_name: name,
        role: role,
        faculty: faculty,
        is_approved: true,
        status: 'approved'
      }
    });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data.user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action } = body;

    if (!userId) throw new Error('ID Pengguna diperlukan.');

    if (action === 'approve') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { is_approved: true, status: 'approved' }
      });
      if (error) throw error;
    } 
    else if (action === 'reject') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: 'Status dikemas kini.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}