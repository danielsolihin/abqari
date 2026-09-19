'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const UITM_FACULTIES = [
  'ACIS - Akademi Pengajian Islam Kontemporari',
  'FPI - Fakulti Pengajian Islam',
  'APB - Akademi Pengajian Bahasa',
  'FSKM - Fakulti Sains Komputer & Matematik',
  'FPP - Fakulti Pengurusan & Perniagaan',
  'FSPPP - Fakulti Sains Pentadbiran & Pengajian Polisi',
  'FPM - Fakulti Pengurusan Maklumat',
  'FKA - Fakulti Kejuruteraan Awam',
  'FKE - Fakulti Kejuruteraan Elektrik',
  'FKM - Fakulti Kejuruteraan Mekanikal',
  'Lain-lain / Jabatan Khusus'
];

export default function RegisterPage() {
  const [regFullName, setRegFullName] = useState('');
  const [regFaculty, setRegFaculty] = useState('');
  const [customFaculty, setCustomFaculty] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setRegisterSuccessMessage(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Kata laluan dan pengesahan kata laluan tidak sepadan.');
      setIsLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Kata laluan hendaklah sekurang-kurangnya 6 aksara.');
      setIsLoading(false);
      return;
    }

    const finalFaculty = regFaculty === 'Lain-lain / Jabatan Khusus' && customFaculty.trim() 
      ? customFaculty.trim() 
      : regFaculty;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            full_name: regFullName,
            name: regFullName,
            faculty: finalFaculty,
            phone_number: regPhone,
            role: 'lecturer',
            is_approved: false, // Perlu diluluskan Admin
            status: 'pending'
          }
        }
      });

      if (error) throw error;

      await supabase.auth.signOut();

      setRegisterSuccessMessage(
        '✅ Pendaftaran anda telah berjaya diterima!\n\nDemi menjaga kerahsiaan soalan peperiksaan, akaun anda perlu disemak dan diluluskan oleh Pentadbir (Admin) ABQARI terlebih dahulu.\n\nSila tunggu makluman rasmi yang akan dihantar melalui Emel atau WhatsApp anda.'
      );

      // Kosongkan form selepas berjaya
      setRegFullName('');
      setRegFaculty('');
      setCustomFaculty('');
      setRegPhone('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');

    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftar akaun. Sila cuba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0',
      width: '100%',
      maxWidth: '600px',
      overflow: 'hidden'
    },
    headerBanner: {
      background: 'linear-gradient(135deg, #3b0764, #4a154b)',
      padding: '30px 25px',
      color: 'white',
      textAlign: 'center' as 'center',
      borderBottom: '4px solid #fde047'
    },
    formBody: {
      padding: '35px 40px'
    },
    inputGroup: {
      marginBottom: '18px'
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: '700',
      color: '#475569',
      marginBottom: '8px'
    },
    input: {
      width: '100%',
      padding: '12px 15px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      fontSize: '0.95rem',
      outlineColor: '#3b0764',
      backgroundColor: '#f8fafc',
      boxSizing: 'border-box' as 'boxSizing'
    },
    select: {
      width: '100%',
      padding: '12px 15px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      fontSize: '0.95rem',
      outlineColor: '#3b0764',
      backgroundColor: '#f8fafc',
      boxSizing: 'border-box' as 'boxSizing',
      cursor: 'pointer'
    },
    submitBtn: {
      width: '100%',
      backgroundColor: '#10b981', // Warna hijau success
      color: '#ffffff',
      padding: '14px',
      borderRadius: '10px',
      fontWeight: '800',
      fontSize: '1rem',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
      transition: 'all 0.2s',
      marginTop: '15px'
    },
    alertError: {
      backgroundColor: '#fef2f2',
      color: '#991b1b',
      padding: '12px 15px',
      borderRadius: '10px',
      borderLeft: '4px solid #ef4444',
      fontSize: '0.85rem',
      lineHeight: '1.5',
      marginBottom: '20px',
      fontWeight: '600'
    },
    alertSuccess: {
      backgroundColor: '#f0fdf4',
      color: '#166534',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid #bbf7d0',
      fontSize: '0.9rem',
      lineHeight: '1.6',
      marginBottom: '20px',
      whiteSpace: 'pre-line' as 'whiteSpace',
      textAlign: 'center' as 'center'
    }
  };

  return (
    <div style={styles.page}>
      
      {/* KOTAK PENDAFTARAN */}
      <div style={styles.card}>
        <div style={styles.headerBanner}>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '900', color: '#fde047', letterSpacing: '-1px' }}>
            ABQARI
          </h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#e2e8f0' }}>
            Pendaftaran Pengguna Baharu
          </p>
        </div>

        <div style={styles.formBody}>
          
          {errorMessage && (
            <div style={styles.alertError}>
              ⚠️ {errorMessage}
            </div>
          )}

          {registerSuccessMessage ? (
            <div>
              <div style={styles.alertSuccess}>
                {registerSuccessMessage}
              </div>
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link href="/login" style={{ color: '#3b0764', fontWeight: '800', textDecoration: 'none', fontSize: '0.95rem' }}>
                  ← Kembali ke Halaman Log Masuk
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Nama Penuh & Gelaran <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Dr. Ahmad / Prof. Siti"
                  style={styles.input}
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Fakulti / Jabatan <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  required
                  style={styles.select}
                  value={regFaculty}
                  onChange={(e) => setRegFaculty(e.target.value)}
                >
                  <option value="" disabled>-- Sila Pilih Fakulti / Jabatan --</option>
                  {UITM_FACULTIES.map((fac) => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              {regFaculty === 'Lain-lain / Jabatan Khusus' && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Nyatakan Nama Fakulti / Jabatan <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jabatan Pengajian Muamalat"
                    style={styles.input}
                    value={customFaculty}
                    onChange={(e) => setCustomFaculty(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>No. WhatsApp <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="0123456789"
                    style={styles.input}
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Emel Rasmi <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="nama@uitm.edu.my"
                    style={styles.input}
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Kata Laluan <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    style={styles.input}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Sahkan Kata Laluan <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    style={styles.input}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? '⏳ Memproses Pendaftaran...' : 'Hantar Permohonan Daftar'}
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link href="/login" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', fontWeight: '600' }}>
                  Sudah mempunyai akaun? <span style={{ color: '#3b0764' }}>Log Masuk</span>
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.8rem', color: '#64748b' }}>
        &copy; {new Date().getFullYear()} Hak Cipta Terpelihara. ACIS Universiti Teknologi MARA.<br/>
        Sistem ABQARI Versi 1.0 (Prototaip)
      </div>

    </div>
  );
}