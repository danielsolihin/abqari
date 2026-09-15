'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Inisialisasi Supabase Client (Guna kunci Public untuk antaramuka Client)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ProfilPage() {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Sila pilih gambar untuk dimuat naik.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      // Jana nama unik untuk mengelakkan fail bertindih
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // 1. Muat naik terus ke bucket 'avatars' di Supabase
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Dapatkan pautan awam (Public URL) gambar tersebut
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: 'Alhamdulillah! Gambar profil berjaya dikemas kini.' });

    } catch (error: any) {
      console.error('Ralat muat naik:', error);
      setMessage({ type: 'error', text: error.message || 'Gagal memuat naik gambar. Pastikan bucket "avatars" wujud & berstatus Public.' });
    } finally {
      setUploading(false);
    }
  };

  // Gaya CSS Inline
  const styles = {
    card: { backgroundColor: 'white', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', maxWidth: '600px', margin: '0 auto', position: 'relative' as 'relative', zIndex: 1, textAlign: 'center' as 'center' },
    label: { display: 'inline-block', padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' },
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' }}>
      
      {/* Latar Belakang Tema ABQARI */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '300px',
        background: 'linear-gradient(135deg, #3b0764, #4a154b)', 
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 0
      }} />

      <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        
        {/* Header Kembali */}
        <div style={{ marginBottom: '40px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#3b0764', backgroundColor: '#fde047', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            ← Kembali ke Papan Pemuka
          </Link>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ffffff', margin: 0 }}>Profil Pengguna</h1>
            <p style={{ color: '#cbd5e1', fontSize: '1.05rem', margin: '10px 0 0 0' }}>Urus maklumat dan gambar profil rasmi anda di sini.</p>
          </div>
        </div>

        {/* Kad Utama Profil */}
        <div style={styles.card}>
          <div style={{ marginBottom: '30px' }}>
            {/* Paparan Gambar Avatar */}
            <div style={{ width: '150px', height: '150px', margin: '0 auto 20px auto', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '4px solid #fde047', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              )}
            </div>

            <h2 style={{ margin: '0 0 5px 0', color: '#0f172a' }}>Prof. Dr. Ahmad Fakhruddin</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Fakulti Pengajian Islam (FPI)</p>
          </div>

          {/* Sistem Muat Naik */}
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>Tukar Gambar Profil Baru</p>
            
            <label style={{ ...styles.label, opacity: uploading ? 0.7 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? 'Memuat naik...' : '📸 Pilih Gambar & Muat Naik'}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleUpload} 
                disabled={uploading} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          {/* Mesej Status */}
          {message && (
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#b91c1c' }}>
              {message.text}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}