import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Ambil senarai semua dokumen
export async function GET() {
  try {
    // Ambil data dari jadual 'documents' (Susun dari yang terbaru)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Padam dokumen beserta vektornya (chunks)
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID dokumen diperlukan.' }, { status: 400 });
    }

    // 1. Padam chunks/vektor di jadual 'document_chunks' terlebih dahulu 
    // (Penting: untuk mengelakkan ralat Foreign Key)
    const { error: chunkError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', id);

    if (chunkError) throw new Error(`Gagal memadam vektor: ${chunkError.message}`);

    // 2. Padam rekod utama di jadual 'documents'
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (docError) throw new Error(`Gagal memadam dokumen: ${docError.message}`);

    return NextResponse.json({ success: true, message: 'Dokumen dan vektor berjaya dipadam.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}