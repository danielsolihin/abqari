'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardUtama() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loginTime, setLoginTime] = useState<Date | null>(null);

  // State Profil Pengguna Dinamik
  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
    avatarUrl: string | null;
  }>({
    name: 'Prof. Dr. Ahmad Fakhruddin',
    faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
    avatarUrl: null,
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // State Statistik Dinamik Supabase
  const [stats, setStats] = useState({ subjects: 0, docs: 0, archives: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // 1. KAWALAN KESELAMATAN (AUTH GUARD) & PENGAMBILAN PROFIL
  useEffect(() => {
    const checkAuthAndFetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userCookie = typeof document !== 'undefined' && document.cookie.includes('abqari_session=');
        const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;

        if (!session && !userCookie && !localUser) {
          router.push('/login');
          return;
        }

        let localAvatarUrl: string | null = null;
        if (localUser) {
          try {
            const parsedLocal = JSON.parse(localUser);
            localAvatarUrl = parsedLocal.avatarUrl || null;
          } catch (e) {}
        }

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          setUserProfile({
            name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Prof. Dr. Ahmad Fakhruddin',
            faculty: meta.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
            avatarUrl: meta.avatar_url || localAvatarUrl || null,
          });
        } else if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setUserProfile({
              name: parsed.name || 'Prof. Dr. Ahmad Fakhruddin',
              faculty: parsed.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
              avatarUrl: parsed.avatarUrl || null,
            });
          } catch {
            // Pengendalian sekiranya ralat parsing
          }
        }

        setIsCheckingAuth(false);
      } catch (err) {
        console.error('Ralat mengesahkan sesi pengguna:', err);
        router.push('/login');
      }
    };

    checkAuthAndFetchProfile();
  }, [router]);

  // 2. Pengisian Masa & Jam Sesi Real-Time
  useEffect(() => {
    const now = new Date();
    setLoginTime(now);
    setCurrentTime(now);

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 3. Pengambilan Data Statistik Sebenar dari Supabase
  useEffect(() => {
    const fetchRealStats = async () => {
      try {
        setIsLoadingStats(true);

        const { count: subjectCount } = await supabase
          .from('subjects')
          .select('*', { count: 'exact', head: true });

        const { count: docCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true });

        const { count: archiveCount } = await supabase
          .from('archives')
          .select('*', { count: 'exact', head: true });

        setStats({
          subjects: subjectCount || 0,
          docs: docCount || 0,
          archives: archiveCount || 0,
        });
      } catch (err) {
        console.error('Ralat mengira statistik:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchRealStats();
  }, []);

  // Pengendali Muat Naik Gambar Profil (Diselaraskan dengan Supabase Bucket 'avatars' & Simpanan Tempatan)
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Maksimum saiz gambar profil ialah 2MB.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // 1. Muat naik ke Supabase Storage Bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Ambil Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Kemas kini user metadata di Supabase Auth jika ada sesi
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      // 4. Kemas kini state tempatan & LocalStorage (Penyimpanan Kekal)
      setUserProfile(prev => {
        const updated = { ...prev, avatarUrl: publicUrl };
        if (typeof window !== 'undefined') {
          const existingUser = localStorage.getItem('abqari_user');
          let parsedUser = {};
          try {
            parsedUser = existingUser ? JSON.parse(existingUser) : {};
          } catch (err) {}

          const newUserData = {
            ...parsedUser,
            name: prev.name,
            faculty: prev.faculty,
            avatarUrl: publicUrl
          };
          localStorage.setItem('abqari_user', JSON.stringify(newUserData));
        }
        return updated;
      });

      alert('Alhamdulillah! Gambar profil berjaya dikemas kini.');
    } catch (err: any) {
      console.error('Gagal mengemas kini avatar:', err);
      alert(`Gagal memuat naik gambar profil: ${err.message || 'Ralat muat naik.'}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'AF';
    const cleanName = name.replace(/(Prof\.|Dr\.|Ir\.|Hj\.|Hjh\.|Dato'|Datin)/gi, '').trim();
    const parts = cleanName.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Memuatkan...';
    return date.toLocaleTimeString('en-MY', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    }).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Ralat log keluar:', error);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('abqari_user');
      sessionStorage.removeItem('abqari_user');
    }
    document.cookie = "abqari_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
    router.push('/login');
  };

  if (isCheckingAuth) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#3b0764', 
        color: 'white',
        fontFamily: '"Inter", "Segoe UI", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fde047', fontSize: '2rem', margin: '0 0 10px 0', letterSpacing: '-0.5px' }}>ABQARI</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>Mengesahkan sesi pengguna...</p>
        </div>
      </div>
    );
  }

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '320px',
      background: 'linear-gradient(135deg, #3b0764, #4a154b)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
      zIndex: 0,
      borderBottom: '4px solid #fde047'
    },
    container: { maxWidth: '1200px', margin: '0 auto', padding: '35px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingTop: '5px' },
    
    logoText: { color: '#fde047', fontSize: '2.4rem', fontWeight: '900', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.3)', letterSpacing: '-1px' },
    subLogo: { color: '#e2e8f0', fontSize: '0.7rem', fontWeight: '400', letterSpacing: '0.5px', margin: '4px 0 0 0', maxWidth: '350px', lineHeight: '1.4', opacity: '0.9' },
    
    profileBox: { display: 'flex', alignItems: 'flex-start', gap: '15px', color: 'white', textAlign: 'right' as 'right' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px', marginBottom: '35px' },
    statCard: { backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', padding: '20px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '18px' },
    
    menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '22px', alignItems: 'stretch' },
    card: { height: '100%', backgroundColor: 'white', borderRadius: '14px', padding: '22px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', flexDirection: 'column' as 'column', gap: '12px', transition: 'all 0.3s ease' },
    
    descriptionText: {
      margin: 0,
      color: '#64748b',
      fontSize: '0.85rem',
      lineHeight: '1.5',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'orient' as any,
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  };

  const menuItems = [
    {
      id: 'kursus',
      title: 'Pengurusan Kursus',
      desc: 'Daftar subjek baharu, tetapkan pemetaan CO, LO dan format penilaian rasmi Fakulti.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>,
      link: '/kursus', 
      bgColor: '#eff6ff'
    },
    {
      id: 'sumber',
      title: 'Pusat Sumber (Nota)',
      desc: 'Muat naik dokumen PDF, slaid, atau modul rasmi untuk dijadikan rujukan bacaan AI.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>,
      link: '/sumber',
      bgColor: '#ecfdf5'
    },
    {
      id: 'penjana',
      title: 'Penjana Soalan & JSU',
      desc: 'Jana kertas soalan peperiksaan dan skema jawapan secara automatik menggunakan AI ABQARI.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
      link: '/penjana', 
      bgColor: '#fffbeb'
    },
    {
      id: 'chat',
      title: 'Pembantu AI (RAG)',
      desc: 'Berinteraksi dan bersoal jawab dengan nota PDF anda secara langsung melalui sembang pintar.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M13 8H7"></path><path d="M17 12H7"></path></svg>,
      link: '/chat', 
      bgColor: '#fdf2f8'
    },
    {
      id: 'arkib',
      title: 'Arkib & Laporan',
      desc: 'Semak semula sejarah kertas soalan yang telah dijana, eksport rekod, dan muat turun dokumen.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
      link: '/arkib',
      bgColor: '#f5f3ff'
    },
    {
      id: 'tetapan',
      title: 'Tetapan & Konfigurasi',
      desc: 'Urus profil pensyarah, kemas kini templat MS Word rasmi, dan kawalan tetapan enjin AI.',
      icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
      link: '/admin',
      bgColor: '#fef2f2'
    }
  ];

  return (
    <div style={styles.page}>
      
      {/* LATAR BELAKANG UNGU & CORAK ISLAMIK */}
      <div style={styles.banner} />

      <div style={styles.container}>
        
        {/* HEADER / TOP NAV */}
        <div style={styles.headerBox}>
          <div>
            <h1 style={styles.logoText}>ABQARI</h1>
            <p style={styles.subLogo}>ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR</p>
          </div>
          
          {/* PROFILE & SESSION INFO */}
          <div style={styles.profileBox}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.05rem' }}>{userProfile.name}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>{userProfile.faculty}</p>
              
              <div style={{ 
                backgroundColor: 'rgba(0,0,0,0.25)', 
                padding: '6px 10px', 
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-end',
                gap: '2px',
                minWidth: '200px'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#ffffff', letterSpacing: '0.5px' }}>
                  🕒 <strong style={{ color: '#fde047', fontFamily: 'monospace', fontSize: '1rem' }}>{formatTime(currentTime)}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                  <span style={{ opacity: 0.8 }}>Masa Masuk:</span> <span style={{ fontWeight: '600' }}>{formatTime(loginTime)}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  Sesi Aktif
                </div>
              </div>

              {/* BUTANG LOG KELUAR */}
              <button
                onClick={handleLogout}
                style={{
                  marginTop: '10px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                🚪 Log Keluar
              </button>
            </div>
            
            {/* BULATAN AVATAR PROFIL */}
            <div 
              onClick={() => document.getElementById('avatar-file-input')?.click()}
              style={{ 
                width: '54px', 
                height: '54px', 
                borderRadius: '50%', 
                backgroundColor: '#fde047', 
                color: '#3b0764', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold', 
                fontSize: '1.2rem', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)', 
                border: '2px solid #ffffff',
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative'
              }}
              title="Klik untuk muat naik gambar profil baharu"
            >
              {userProfile.avatarUrl ? (
                <img 
                  src={userProfile.avatarUrl} 
                  alt="Profil" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                getInitials(userProfile.name)
              )}

              {isUploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                  ⏳
                </div>
              )}

              <input 
                id="avatar-file-input"
                type="file" 
                accept="image/*" 
                onChange={handleAvatarUpload}
                style={{ display: 'none' }} 
              />
            </div>

          </div>
        </div>

        {/* SECTION: STATISTIK RINGKAS */}
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fde047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#fde047' }}>
                {isLoadingStats ? '...' : stats.subjects}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Kursus Berdaftar</p>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#67e8f9' }}>
                {isLoadingStats ? '...' : stats.docs}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Dokumen Sumber AI</p>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#86efac' }}>
                {isLoadingStats ? '...' : stats.archives}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Soalan Dijana</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '20px', fontSize: '1.3rem', fontWeight: 'bold' }}>
            Pilih Modul Tindakan
          </h2>
          
          <div style={styles.menuGrid}>
            {menuItems.map((item) => (
              <Link key={item.id} href={item.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                <div 
                  onMouseEnter={() => setHoveredCard(item.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    ...styles.card,
                    transform: hoveredCard === item.id ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: hoveredCard === item.id ? '0 12px 25px -5px rgba(0,0,0,0.08)' : '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ width: '50px', height: '50px', borderRadius: '10px', backgroundColor: item.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>{item.title}</h3>
                    <p style={styles.descriptionText}>{item.desc}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', color: hoveredCard === item.id ? '#3b0764' : '#94a3b8', fontWeight: 'bold', fontSize: '0.85rem', transition: 'color 0.2s' }}>
                    Akses Modul <span style={{ marginLeft: '5px', transform: hoveredCard === item.id ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 0.2s' }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
          <p>© {new Date().getFullYear()} ABQARI. Hak Cipta Terpelihara. Universiti Teknologi MARA (UiTM).</p>
        </div>

      </div>
    </div>
  );
}