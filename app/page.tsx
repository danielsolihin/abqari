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
    role: string;
    lastLogin: string | null;
  }>({
    name: 'Memuatkan...',
    faculty: 'Memuatkan...',
    avatarUrl: null,
    role: 'pensyarah',
    lastLogin: null,
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Modal Tetapan Profil
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFaculty, setEditFaculty] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // State Statistik Dinamik Supabase
  const [stats, setStats] = useState({ subjects: 0, docs: 0, archives: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // 1. KAWALAN KESELAMATAN & PENGAMBILAN PROFIL
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
            name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Pengguna ABQARI',
            faculty: meta.faculty || 'Fakulti Pengajian',
            avatarUrl: meta.avatar_url || localAvatarUrl || null,
            role: meta.role || 'pensyarah',
            lastLogin: session.user.last_sign_in_at || null, // Ambil masa log masuk terakhir dari Supabase
          });
        } else if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setUserProfile({
              name: parsed.name || 'Pengguna ABQARI',
              faculty: parsed.faculty || 'Fakulti Pengajian',
              avatarUrl: parsed.avatarUrl || null,
              role: parsed.role || 'pensyarah',
              lastLogin: null,
            });
          } catch {}
        }
        setIsCheckingAuth(false);
      } catch (err) {
        router.push('/login');
      }
    };
    checkAuthAndFetchProfile();
  }, [router]);

  // 2. Masa & Jam Sesi Real-Time
  useEffect(() => {
    const now = new Date();
    setLoginTime(now);
    setCurrentTime(now);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Statistik
  useEffect(() => {
    const fetchRealStats = async () => {
      try {
        setIsLoadingStats(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        const authHeaders = session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` } 
          : {};

        const [subRes, docRes] = await Promise.all([
          fetch('/api/subjects', { headers: authHeaders }),
          fetch('/api/documents', { headers: authHeaders })
        ]);

        const subJson = subRes.ok ? await subRes.json() : { success: false, data: [] };
        const docJson = docRes.ok ? await docRes.json() : { success: false, data: [] };

        setStats({
          subjects: subJson.success ? subJson.data.length : 0,
          docs: docJson.success ? docJson.data.length : 0,
          archives: 0, 
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    if (!isCheckingAuth) fetchRealStats();
  }, [isCheckingAuth]);

  // Pengendali Muat Naik Gambar Profil
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Maksimum saiz gambar profil ialah 2MB.');

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      setUserProfile(prev => {
        const updated = { ...prev, avatarUrl: publicUrl };
        if (typeof window !== 'undefined') {
          const existingUser = localStorage.getItem('abqari_user');
          try {
            const parsedUser = existingUser ? JSON.parse(existingUser) : {};
            localStorage.setItem('abqari_user', JSON.stringify({ ...parsedUser, avatarUrl: publicUrl }));
          } catch (err) {}
        }
        return updated;
      });
      alert('Gambar profil berjaya dikemas kini.');
    } catch (err: any) {
      alert(`Gagal memuat naik: ${err.message}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const updatePayload: any = {
        data: { name: editName, full_name: editName, faculty: editFaculty }
      };
      
      if (editPassword.trim().length > 0) {
        if (editPassword.length < 6) throw new Error("Kata laluan mesti sekurang-kurangnya 6 aksara.");
        updatePayload.password = editPassword;
      }

      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw error;

      setUserProfile(prev => {
        const updated = { ...prev, name: editName, faculty: editFaculty };
        if (typeof window !== 'undefined') {
          const existingUser = localStorage.getItem('abqari_user');
          try {
            const parsed = existingUser ? JSON.parse(existingUser) : {};
            localStorage.setItem('abqari_user', JSON.stringify({ ...parsed, name: editName, faculty: editFaculty }));
          } catch(err){}
        }
        return updated;
      });

      alert('Alhamdulillah! Maklumat profil / kata laluan berjaya dikemas kini.');
      setShowProfileModal(false);
      setEditPassword('');
    } catch (err: any) {
      alert(`Gagal kemas kini: ${err.message}`);
    } finally {
      setIsUpdatingProfile(false);
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
    if (!date) return '...';
    return date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();
  };

  const formatDateTimeFull = (dateString: string | null) => {
    if (!dateString) return 'Tiada Rekod';
    const date = new Date(dateString);
    return date.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (error) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('abqari_user');
      sessionStorage.removeItem('abqari_user');
    }
    document.cookie = "abqari_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
    router.push('/login');
  };

  const openProfileModal = () => {
    setEditName(userProfile.name);
    setEditFaculty(userProfile.faculty);
    setEditPassword('');
    setShowProfileModal(true);
  };

  if (isCheckingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#3b0764', color: 'white', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fde047', fontSize: '2rem', margin: '0 0 10px 0' }}>ABQARI</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>Mengesahkan sesi pengguna...</p>
        </div>
      </div>
    );
  }

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif', position: 'relative' as 'relative' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '320px',
      background: 'linear-gradient(135deg, #3b0764, #4a154b)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)', zIndex: 0, borderBottom: '4px solid #fde047'
    },
    container: { maxWidth: '1200px', margin: '0 auto', padding: '35px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingTop: '5px' },
    card: { height: '100%', backgroundColor: 'white', borderRadius: '14px', padding: '25px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', flexDirection: 'column' as 'column', gap: '15px', transition: 'all 0.3s ease' },
    input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', boxSizing: 'border-box' as 'border-box' }
  };

  const allMenuItems = [
    { id: 'kursus', title: 'Pengurusan Kursus', desc: 'Daftar subjek baharu, tetapkan pemetaan CO & LO.', icon: '📘', link: '/kursus', bgColor: '#eff6ff' },
    { id: 'sumber', title: 'Pusat Sumber (Nota)', desc: 'Muat naik PDF/Slaid sebagai rujukan bacaan AI.', icon: '📁', link: '/sumber', bgColor: '#ecfdf5' },
    { id: 'penjana', title: 'Penjana Soalan & JSU', desc: 'Jana kertas soalan dan skema jawapan secara automatik.', icon: '⚡', link: '/penjana', bgColor: '#fffbeb' },
    { id: 'chat', title: 'Pembantu AI (RAG)', desc: 'Bersoal jawab dengan nota anda secara langsung.', icon: '💬', link: '/chat', bgColor: '#fdf2f8' },
    { id: 'arkib', title: 'Arkib & Laporan', desc: 'Semak sejarah soalan dan muat turun dokumen.', icon: '🗄️', link: '/arkib', bgColor: '#f5f3ff' },
    { id: 'tetapan', title: 'Tetapan Pentadbir', desc: 'Urus pendaftaran pensyarah & templat rasmi.', icon: '⚙️', link: '/admin', bgColor: '#fef2f2' }
  ];

  const allowedMenuItems = allMenuItems.filter(item => {
    if (userProfile.role !== 'admin') {
      return item.id !== 'arkib' && item.id !== 'tetapan';
    }
    return true; 
  });

  const dynamicGridColumns = allowedMenuItems.length === 4 
    ? 'repeat(auto-fit, minmax(400px, 1fr))' 
    : 'repeat(auto-fit, minmax(280px, 1fr))';

  return (
    <div style={styles.page}>
      <div style={styles.banner} />

      {/* MODAL KEMAS KINI PROFIL */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#0f172a' }}>⚙️ Tetapan Akaun</h2>
            <form onSubmit={handleUpdateProfile}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Nama Penuh / Gelaran</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required style={styles.input} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Jabatan / Fakulti</label>
                <input type="text" value={editFaculty} onChange={e => setEditFaculty(e.target.value)} required style={styles.input} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Kata Laluan Baharu <span style={{fontWeight:'normal', color:'#64748b'}}>(Biarkan kosong jika tidak mahu tukar)</span></label>
                <input type="password" placeholder="••••••••" value={editPassword} onChange={e => setEditPassword(e.target.value)} style={styles.input} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowProfileModal(false)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={isUpdatingProfile} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', backgroundColor: '#3b0764', color: 'white', fontWeight: 'bold', cursor: isUpdatingProfile ? 'not-allowed' : 'pointer' }}>{isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={styles.container}>
        <div style={styles.headerBox}>
          <div>
            <h1 style={{ color: '#fde047', fontSize: '2.4rem', fontWeight: '900', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.3)', letterSpacing: '-1px' }}>ABQARI</h1>
            <p style={{ color: '#e2e8f0', fontSize: '0.7rem', fontWeight: '400', letterSpacing: '0.5px', margin: '4px 0 0 0' }}>ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', color: 'white', textAlign: 'right' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {userProfile.role === 'admin' && <span style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px' }}>ADMIN</span>}
                {userProfile.name}
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>{userProfile.faculty}</p>
              
              {/* KOTAK MAKLUMAT MASA & SESI */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '220px' }}>
                <div style={{ fontSize: '0.9rem', color: '#ffffff', letterSpacing: '0.5px', marginBottom: '2px' }}>
                  🕒 <strong style={{ color: '#fde047', fontFamily: 'monospace', fontSize: '1.05rem' }}>{formatTime(currentTime)}</strong>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>Log Masuk: <span style={{color: '#94a3b8'}}>{formatTime(loginTime)}</span></div>
                <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>Log Terakhir: <span style={{color: '#94a3b8'}}>{formatDateTimeFull(userProfile.lastLogin)}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={openProfileModal} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  ⚙️ Tetapan
                </button>
                <button onClick={handleLogout} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  🚪 Log Keluar
                </button>
              </div>
            </div>
            
            <div onClick={() => document.getElementById('avatar-file-input')?.click()} style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: '#fde047', color: '#3b0764', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '2px solid #ffffff', cursor: 'pointer', overflow: 'hidden', position: 'relative' }} title="Klik untuk muat naik gambar profil">
              {userProfile.avatarUrl ? <img src={userProfile.avatarUrl} alt="Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(userProfile.name)}
              {isUploadingAvatar && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>⏳</div>}
              <input id="avatar-file-input" type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        {/* SECTION: STATISTIK */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px', marginBottom: '35px' }}>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', padding: '20px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#fde047' }}>{isLoadingStats ? '...' : stats.subjects}</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Kursus Anda</p>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', padding: '20px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#67e8f9' }}>{isLoadingStats ? '...' : stats.docs}</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Dokumen Nota AI</p>
          </div>
          {userProfile.role === 'admin' && (
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', padding: '20px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#86efac' }}>{isLoadingStats ? '...' : stats.archives}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0' }}>Arkib Keseluruhan</p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '40px' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '20px', fontSize: '1.3rem', fontWeight: 'bold' }}>Modul Tersedia</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: dynamicGridColumns, gap: '22px', alignItems: 'stretch' }}>
            {allowedMenuItems.map((item) => (
              <Link key={item.id} href={item.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                <div onMouseEnter={() => setHoveredCard(item.id)} onMouseLeave={() => setHoveredCard(null)} style={{ ...styles.card, transform: hoveredCard === item.id ? 'translateY(-4px)' : 'translateY(0)', boxShadow: hoveredCard === item.id ? '0 12px 25px -5px rgba(0,0,0,0.08)' : '0 2px 4px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '10px', backgroundColor: item.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '4px' }}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '1.15rem', fontWeight: '700' }}>{item.title}</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>{item.desc}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', color: hoveredCard === item.id ? '#3b0764' : '#94a3b8', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    Akses Modul →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}