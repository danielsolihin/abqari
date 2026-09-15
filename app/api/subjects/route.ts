import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pangkalan Data Client
const dbClient = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey
);

// Fungsi pembantu untuk mengesahkan pengguna yang sedang log masuk
async function getAuthenticatedUser(req: Request) {
  try {
    const cookieStore = await cookies();
    const authHeader = req.headers.get('authorization');

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          cookie: cookieStore.toString(),
        },
      },
    });

    const { data: { user } } = await authClient.auth.getUser();
    return user;
  } catch (err) {
    return null;
  }
}

// 1. Ambil senarai subjek (GET)
export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const isAdmin = user.user_metadata?.role === 'admin';

    let query = dbClient
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false });

    // Jika bukan admin, hanya tarik subjek milik user ini sahaja
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

// 2. Tambah subjek baharu (POST)
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, courseCode, co, lo } = body;

    const { data, error } = await dbClient
      .from('subjects')
      .insert([
        {
          name,
          course_code: courseCode || 'TIADA',
          co: co || [],
          lo: lo || [],
          user_id: user.id, // Menyimpan ID pemunya subjek
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
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, courseCode, co, lo } = body;

    const isAdmin = user.user_metadata?.role === 'admin';

    let query = dbClient
      .from('subjects')
      .update({
        name,
        course_code: courseCode || 'TIADA',
        co: co || [],
        lo: lo || [],
      })
      .eq('id', id);

    // Sekat supaya pensyarah tidak boleh kemas kini subjek orang lain
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 4. Padam subjek (DELETE)
export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akses tidak dibenarkan. Sila log masuk.' }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    const isAdmin = user.user_metadata?.role === 'admin';

    let query = dbClient.from('subjects').delete().eq('id', id);

    // Sekat supaya pensyarah tidak boleh padam subjek orang lain
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