'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return alert('Sila masukkan emel anda.');

    setLoading(true);
    setMessage(null);

    try {
      // URL lengkap ke halaman reset-password di domain abqari.my
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password`
        : 'https://www.abqari.my/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Pautan penetapan semula kata laluan telah dihantar ke emel anda. Sila semak peti masuk (inbox) atau folder Spam anda.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Gagal menghantar emel penetapan semula.',
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
          <h2 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Lupa Kata Laluan?</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>Masukkan emel berdaftar anda untuk menerima pautan penetapan semula.</p>
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleResetRequest}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Emel / ID Staf UiTM</label>
            <input
              type="email"
              placeholder="cth: syahiran@uitm.edu.my"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#94a3b8' : '#3b0764', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(59, 7, 100, 0.2)' }}
          >
            {loading ? '⏳ Menghantar Emel...' : '📩 Hantar Pautan Reset'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <Link href="/login" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>
            ← Kembali ke Halaman Log Masuk
          </Link>
        </div>

      </div>
    </div>
  );
}