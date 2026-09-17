import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

// Fungsi PINTAR: Dapatkan User ID dari Token Header secara automatik
async function getUserIdFromReq(req: Request, supabase: any) {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id || null;
  }
  return null;
}

// ==========================================
// 1. GET - AMBIL SENARAI SUBJEK PENSYARAH
// ==========================================
export async function GET(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = await getUserIdFromReq(req, supabase);

    // KUNCI KESELAMATAN: Jika tiada maklumat user, pulangkan array kosong
    if (!userId) {
      return NextResponse.json({ success: true, data: [] });
    }

    // TAPISAN BERLAKU DI SINI: Hanya subjek kepunyaan 'userId' akan dipanggil
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error("❌ Ralat GET Subjects:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil senarai subjek." },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. POST - DAFTAR SUBJEK BAHARU
// ==========================================
export async function POST(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authUserId = await getUserIdFromReq(req, supabase);

    const body = await req.json().catch(() => ({}));
    const { name, course_code, co, lo, user_id: bodyUserId } = body;

    let finalUserId = authUserId;
    if (!finalUserId && bodyUserId && isValidUUID(bodyUserId)) {
      finalUserId = bodyUserId;
    }

    const payload: any = {
      name: name || "Subjek Baharu",
      course_code: course_code || "KOD123",
      co: Array.isArray(co) ? co : [],
      lo: Array.isArray(lo) ? lo : [],
      user_id: finalUserId,
    };

    const { data, error } = await supabase.from("subjects").insert([payload]).select();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      message: "Subjek berjaya didaftarkan!",
      data: data?.[0] || payload,
    });
  } catch (error: any) {
    console.error("❌ Ralat POST Subjects:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mendaftar subjek." },
      { status: 500 }
    );
  }
}

// ==========================================
// 3. PUT - KEMAS KINI MAKLUMAT SUBJEK
// ==========================================
export async function PUT(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authUserId = await getUserIdFromReq(req, supabase);

    const body = await req.json().catch(() => ({}));
    const { id, name, courseCode, co, lo } = body;

    if (!id) throw new Error("ID subjek diperlukan.");

    const payload = {
      name,
      course_code: courseCode,
      co: Array.isArray(co) ? co : [],
      lo: Array.isArray(lo) ? lo : [],
    };

    // KUNCI KESELAMATAN: Pastikan hanya boleh edit subjek milik sendiri
    let query = supabase.from("subjects").update(payload).eq("id", id);
    if (authUserId) query = query.eq("user_id", authUserId);

    const { data, error } = await query.select();
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data?.[0] || payload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// 4. DELETE - PADAM SUBJEK
// ==========================================
export async function DELETE(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authUserId = await getUserIdFromReq(req, supabase);

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id) throw new Error("ID subjek diperlukan.");

    // KUNCI KESELAMATAN: Pastikan hanya boleh padam subjek milik sendiri
    let query = supabase.from("subjects").delete().eq("id", id);
    if (authUserId) query = query.eq("user_id", authUserId);

    const { error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: "Berjaya dipadam." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}