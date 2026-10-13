'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function KonfigurasiProfilPage() {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // STATE BORANG
  const [institutionType, setInstitutionType] = useState('uitm');
  const [institutionName, setInstitutionName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('Sila log masuk terlebih dahulu.');
        router.push('/login');
        return;
      }
      
      setUserId(session.user.id);

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setInstitutionType(data.institution_type || 'uitm');
        setInstitutionName(data.institution_name || '');
        setLogoUrl(data.logo_url || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    try {
      let finalLogoUrl = logoUrl;

      // 1. Muat naik logo jika terdapat fail baharu
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo_${userId}_${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('institution_logos')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          alert(`Ralat Muat Naik Logo: ${uploadError.message || 'HTTP 400'}`);
          setIsSaving(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('institution_logos')
          .getPublicUrl(filePath);

        finalLogoUrl = publicUrlData.publicUrl;
      }

      // 2. Simpan profil ke pangkalan data
      const { error: dbError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          institution_type: institutionType,
          institution_name: institutionType === 'uitm' ? 'UNIVERSITI TEKNOLOGI MARA' : institutionName,
          logo_url: institutionType === 'uitm' ? '' : finalLogoUrl,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        alert(`Ralat Simpan Profil: ${dbError.message}`);
        setIsSaving(false);
        return;
      }
      
      alert('✅ Konfigurasi profil berjaya disimpan!');
      
      // Kembali ke Papan Pemuka Utama
      router.push('/');
      
    } catch (error: any) {
      alert(`Ralat Tidak Dijangka: ${error.message}`);
      setIsSaving(false);
    } 
  };

  if (isLoading) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Memuatkan konfigurasi...</div>;

  const styles = {
    page: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif' },
    header: { backgroundColor: '#3b0764', padding: '22px 40px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    card: { backgroundColor: 'white', padding: '35px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '750px', margin: '40px auto' },
    label: { display: 'block', fontSize: '0.88rem', fontWeight: 'bold', color: '#334155', marginBottom: '8px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', backgroundColor: '#f8fafc', marginBottom: '22px', fontFamily: 'inherit', boxSizing: 'border-box' as const }
  };

  return (
    <div style={styles.page}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, color: '#fde047', fontSize: '1.75rem', fontWeight: '900' }}>ABQARI <span style={{ color: 'white', fontWeight: '300' }}>| Konfigurasi</span></h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#cbd5e1' }}>Tetapan Templat & Identiti Institusi</p>
        </div>
        <Link href="/admin" style={{ color: 'white', textDecoration: 'none', backgroundColor: 'rgba(255,255,255,0.12)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
          ← Kembali ke Papan Pemuka
        </Link>
      </div>

      <div style={styles.card}>
        <h2 style={{ color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '14px', marginBottom: '24px', fontSize: '1.25rem', fontWeight: '800' }}>
          Tetapan Muka Depan Kertas Soalan
        </h2>
        
        <form onSubmit={handleSave}>
          
          <label style={styles.label}>Pilih Identiti Institusi Anda:</label>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
            <label style={{ flex: 1, padding: '14px', border: `2px solid ${institutionType === 'uitm' ? '#be185d' : '#cbd5e1'}`, borderRadius: '8px', backgroundColor: institutionType === 'uitm' ? '#fdf2f8' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="radio" name="inst_type" value="uitm" checked={institutionType === 'uitm'} onChange={() => setInstitutionType('uitm')} style={{ transform: 'scale(1.2)' }} />
              <span style={{ fontWeight: 'bold', color: institutionType === 'uitm' ? '#9d174d' : '#475569', fontSize: '0.92rem' }}>Universiti Teknologi MARA (UiTM)</span>
            </label>

            <label style={{ flex: 1, padding: '14px', border: `2px solid ${institutionType === 'lain' ? '#3b82f6' : '#cbd5e1'}`, borderRadius: '8px', backgroundColor: institutionType === 'lain' ? '#eff6ff' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="radio" name="inst_type" value="lain" checked={institutionType === 'lain'} onChange={() => setInstitutionType('lain')} style={{ transform: 'scale(1.2)' }} />
              <span style={{ fontWeight: 'bold', color: institutionType === 'lain' ? '#1e40af' : '#475569', fontSize: '0.92rem' }}>Institusi Lain (Kustom)</span>
            </label>
          </div>

          {institutionType === 'uitm' ? (
            <div style={{ backgroundColor: '#f8fafc', padding: '22px', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.92rem', lineHeight: '1.5' }}>
                🎉 Anda menggunakan templat rasmi lalai UiTM. Tiada konfigurasi tambahan diperlukan. Sistem akan menjana Kertas Soalan dan Skema mengikut format standard rasmi UiTM.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ backgroundColor: '#eff6ff', padding: '14px 16px', borderRadius: '8px', marginBottom: '22px', borderLeft: '4px solid #3b82f6' }}>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.88rem', lineHeight: '1.5' }}>
                  Tetapan nama dan logo di bawah akan digunakan untuk menjana Muka Depan Kertas Soalan <strong>(Universal Template)</strong> bagi institusi anda.
                </p>
              </div>

              <label style={styles.label}>Nama Institusi (Akan dipapar pada Muka Depan)</label>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="Cth: POLITEKNIK KUCHING" 
                value={institutionName} 
                onChange={(e) => setInstitutionName(e.target.value.toUpperCase())}
                required={institutionType === 'lain'}
              />

              <label style={styles.label}>Logo Institusi (Format Gambar: PNG/JPG)</label>
              {logoUrl && !logoFile && (
                <div style={{ marginBottom: '14px' }}>
                  <img src={logoUrl} alt="Logo Institusi" style={{ maxHeight: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '8px', backgroundColor: 'white' }} />
                </div>
              )}
              <input 
                type="file" 
                accept="image/png, image/jpeg" 
                onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)} 
                style={{ ...styles.input, padding: '8px' }} 
                required={institutionType === 'lain' && !logoUrl}
              />
            </div>
          )}

          <div style={{ borderTop: '2px solid #f1f5f9', marginTop: '10px', paddingTop: '20px', textAlign: 'right' }}>
            <button 
              type="submit" 
              disabled={isSaving}
              style={{ backgroundColor: '#be185d', color: 'white', padding: '13px 32px', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(190, 24, 93, 0.3)' }}
            >
              {isSaving ? '⏳ Menyimpan Rekod...' : '💾 Simpan Konfigurasi'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}