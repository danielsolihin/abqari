import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Gunakan Service Role Key jika ada, jika tidak guna Anon Key
const dbClient = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey
);

// Fungsi pembantu untuk mengesahkan pengguna yang sedang log masuk (Cookie / Bearer Token)
async function getAuthenticatedUser(req: Request) {
  try {
    const cookieStore = await cookies();
    const authHeader = req.headers.get('authorization');

    const headers: Record<string, string> = {
      cookie: cookieStore.toString(),
    };

    if (authHeader) {
      headers.authorization = authHeader;
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers },
    });

    const { data: { user } } = await authClient.auth.getUser();
    return user;
  } catch (err) {
    return null;
  }
}

// 1. Ambil senarai dokumen (GET)
export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const isAdmin = user.user_metadata?.role === 'admin';

    let query = dbClient
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    // SEKATAN KESELAMATAN: Jika bukan admin, hanya tarik dokumen milik pensyarah ini sahaja
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. Padam dokumen (DELETE)
export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    const isAdmin = user.user_metadata?.role === 'admin';

    let query = dbClient.from('documents').delete().eq('id', id);

    // SEKATAN KESELAMATAN: Pastikan pensyarah hanya boleh padam fail milik mereka sendiri
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}