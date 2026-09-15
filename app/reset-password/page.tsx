'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      return alert('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
    }

    if (password !== confirmPassword) {
      return alert('Kata laluan dan Pengesahan Kata Laluan tidak sepadan.');
    }

    setLoading(true);
    setMessage(null);

    try {
      // Kemas kini kata laluan pengguna dalam sesi aktif dari pautan emel
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Alhamdulillah! Kata laluan anda berjaya dikemas kini. Anda akan dialihkan ke halaman log masuk...',
      });

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Gagal mengemas kini kata laluan. Pastikan pautan emel belum luput.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', maxWidth: '450px', width: '100%' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#3b0764', fontSize: '2rem', fontWeight: '900', margin: '0 0 8px 0' }}>ABQARI</h1>
          <h2 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Kata Laluan Baharu</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>Sila cipta kata laluan baharu untuk akaun anda.</p>
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdatePassword}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Kata Laluan Baharu</label>
            <input
              type="password"
              placeholder="Sekurang-kurangnya 6 aksara"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Pengesahan Kata Laluan Baharu</label>
            <input
              type="password"
              placeholder="Ulang kata laluan baharu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#94a3b8' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.2)' }}
          >
            {loading ? '⏳ Mengemas Kini...' : '💾 Simpan Kata Laluan Baharu'}
          </button>
        </form>

      </div>
    </div>
  );
}