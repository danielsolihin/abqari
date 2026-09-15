import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const dbClient = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey
);

async function getAuthenticatedUser(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
}

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