'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Semak log masuk Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      // 2. Simpan Cookie keselamatan
      document.cookie = "abqari_session=true; path=/; max-age=86400; SameSite=Lax";

      // 3. Muat semula halaman secara terus ke Papan Pemuka
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Ralat Log Masuk:', error);
      if (error.message?.includes('Invalid login credentials')) {
        setErrorMsg('E-mel atau kata laluan tidak tepat. Sila cuba lagi.');
      } else {
        setErrorMsg(error.message || 'Berlaku ralat semasa log masuk.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      backgroundColor: '#f8fafc'
    }}>
      
      {/* PANEL KIRI: Penjenamaan (Branding) ABQARI */}
      <div style={{ 
        flex: 1, 
        background: 'linear-gradient(135deg, #3b0764, #4a154b)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '500px', margin: '0 auto' }}>
          
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Logo_UiTM_%28Universiti_Teknologi_MARA%29.svg/1024px-Logo_UiTM_%28Universiti_Teknologi_MARA%29.svg.png" 
            alt="Logo UiTM" 
            style={{ 
              width: '180px', 
              marginBottom: '25px', 
              filter: 'brightness(0) invert(1)',
              opacity: 0.95
            }} 
          />

          <div>
            <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.2)', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>
              UITM SHAH ALAM
            </div>
          </div>
          
          <h1 style={{ fontSize: '4.5rem', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-2px', color: '#fde047', textShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            ABQARI
          </h1>
          <p style={{ fontSize: '1.2rem', fontWeight: '600', letterSpacing: '2px', margin: '0 0 30px 0', opacity: 0.9 }}>
            ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR
          </p>
          <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '40px' }}>
            Sistem pintar penggubalan kertas peperiksaan rasmi UiTM berteraskan kecerdasan buatan (AI) termaju.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              🔒
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Akses Terkawal</div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Eksklusif untuk Pensyarah Berdaftar</div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL KANAN: Borang Log Masuk */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>Log Masuk</h2>
            <p style={{ color: '#64748b', margin: 0 }}>Sila masukkan kelayakan portal anda.</p>
          </div>

          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
            
            {errorMsg && (
              <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '12px 15px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid #fecaca', fontWeight: '600' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  E-mel Staf (UiTM)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>✉️</span>
                  <input 
                    type="email" 
                    placeholder="contoh@uitm.edu.my" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>Kata Laluan</label>
                  <a href="#" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>Lupa laluan?</a>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔑</span>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '10px', border: 'none', 
                  backgroundColor: isLoading ? '#94a3b8' : '#3b0764', 
                  color: 'white', fontSize: '1rem', fontWeight: '800', cursor: isLoading ? 'not-allowed' : 'pointer', 
                  transition: 'all 0.3s',
                  boxShadow: isLoading ? 'none' : '0 10px 15px -3px rgba(59, 7, 100, 0.3)'
                }}
              >
                {isLoading ? 'Mengesahkan...' : 'Log Masuk ke Papan Pemuka'}
              </button>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.8rem', color: '#64748b' }}>
            &copy; 2026 Hak Cipta Terpelihara. ACIS Universiti Teknologi MARA.<br/>
            Sistem ABQARI Versi 1.0 (Prototaip)
          </div>

        </div>
      </div>

    </div>
  );
}