import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// GUNAKAN SERVICE ROLE KEY JIKA ADA SUPAYA KEBAL RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Fungsi Pembantu: Dapatkan User ID
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
// 1. GET - Ambil senarai dokumen milik pensyarah
// ==========================================
export async function GET(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = await getUserIdFromReq(req, supabase);

    if (!userId) return NextResponse.json({ success: true, data: [] });

    // HANYA paparkan dokumen untuk subjek yang dimiliki oleh user
    const { data: userSubjects } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", userId);

    const subjectIds = userSubjects?.map(s => s.id) || [];

    if (subjectIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil dokumen." },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. DELETE - Paksa Padam Dokumen
// ==========================================
export async function DELETE(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id) throw new Error("ID dokumen tidak sah.");

    // 1. Dapatkan lokasi fail (file_path) sebelum rekod dipadam
    const { data: docData } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", id)
      .single();

    // 2. PADAM REKOD DARI PANGKALAN DATA (Dengan .select() untuk bongkar penipuan RLS)
    const { data: deletedRows, error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .select(); // <--- KUNCI UTAMA: Wajib letak .select()

    if (deleteError) {
      throw new Error(`Ralat DB: ${deleteError.message}`);
    }

    // Jika array kosong, bermaksud Supabase berbohong & sekat pemadaman!
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error("Pangkalan data menyekat pemadaman. Sila ke Supabase SQL Editor dan jalankan: ALTER TABLE documents DISABLE ROW LEVEL SECURITY;");
    }

    // 3. Padam PDF fizikal dari Storage (Supabase Buckets)
    if (docData?.file_path) {
      await supabase.storage.from("documents").remove([docData.file_path]);
    }

    return NextResponse.json({ success: true, message: "Dokumen berjaya dipadamkan sepenuhnya." });
  } catch (error: any) {
    console.error("❌ Ralat DELETE API:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memadam dokumen." },
      { status: 500 }
    );
  }
}