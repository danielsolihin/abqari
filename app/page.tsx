'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

import CreditBadge from './components/CreditBadge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardUtama() {
  const router = useRouter();
  
  const [isSessionVerified, setIsSessionVerified] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [loginTime, setLoginTime] = useState<Date | null>(null);
  const [lastLoginFormatted, setLastLoginFormatted] = useState<string>('...');
  const [isAdmin, setIsAdmin] = useState(false);

  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
    email: string;
    avatarUrl: string | null;
  }>({
    name: 'Memuatkan...',
    faculty: 'UiTM',
    email: '',
    avatarUrl: null,
  });
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // KEMAS KINI: State Modal Kemaskini Butiran Profil yang diperluas
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFaculty, setEditFaculty] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [stats, setStats] = useState({ subjects: 0, docs: 0, archives: 0, users: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoadingStats(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          router.push('/login');
          return;
        }

        const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
        const isAdminUser = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';
        const isApproved = user.user_metadata?.is_approved === true || user.user_metadata?.status === 'approved';

        if (!isAdminUser && !isApproved) {
          await supabase.auth.signOut();
          document.cookie = "abqari_session=; path=/; max-age=0;";
          router.push('/login');
          return;
        }

        const hasSessionCookie = document.cookie.includes('abqari_session=');
        if (!hasSessionCookie) {
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }

        setIsSessionVerified(true);

        if (user.last_sign_in_at) {
          const lastDate = new Date(user.last_sign_in_at);
          const timeStr = lastDate.toLocaleTimeString('en-MY', { 
            hour: '2-digit', minute: '2-digit', hour12: true 
          }).toUpperCase();
          setLastLoginFormatted(timeStr);
        }

        setIsAdmin(isAdminUser);

        const meta = user.user_metadata || {};
        setUserProfile({
          name: meta.full_name || meta.name || user.email?.split('@')[0] || 'Pensyarah',
          faculty: meta.faculty || 'Fakulti / Jabatan',
          email: user.email || '',
          avatarUrl: meta.avatar_url || null,
        });
        
        setEditName(meta.full_name || meta.name || '');
        setEditPhone(meta.phone_number || '');
        setEditFaculty(meta.faculty || '');

        let subQ = supabase.from('subjects').select('*', { count: 'exact', head: true });
        let docQ = supabase.from('documents').select('*', { count: 'exact', head: true });
        let arcQ = supabase.from('archives').select('*', { count: 'exact', head: true });

        if (!isAdminUser) {
          subQ = subQ.eq('user_id', user.id);
          docQ = docQ.eq('user_id', user.id);
          arcQ = arcQ.eq('user_id', user.id);
        }

        const [
          { count: subCount },
          { count: docCountVal },
          { count: arcCountVal }
        ] = await Promise.all([subQ, docQ, arcQ]);

        let finalArchiveCount = arcCountVal || 0;

        if (finalArchiveCount === 0) {
          try {
            const timeStamp = new Date().getTime();
            const res = await fetch(`/api/archives?t=${timeStamp}`, { 
              cache: 'no-store', headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              const archivesData = isAdminUser ? json.data : json.data.filter((a: any) => a.user_id === user.id);
              finalArchiveCount = archivesData.length;
            }
          } catch (e) {
            console.error('Gagal fallback API Arkib');
          }
        }

        let totalUsers = 1;
        if (isAdminUser) {
          try {
            const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            totalUsers = uCount || 1;
          } catch (e) {
            totalUsers = 0;
          }
        }

        setStats({
          subjects: subCount || 0,
          docs: docCountVal || 0,
          archives: finalArchiveCount,
          users: totalUsers
        });

      } catch (err) {
        console.error('Ralat Inisialisasi Dashboard:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    initializeDashboard();
  }, [router]);

  useEffect(() => {
    const now = new Date();
    setLoginTime(now);
    setCurrentTime(now);

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // KEMAS KINI 1: FUNGSI PEMAMPATAN & MUAT NAIK GAMBAR PROFIL
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Fail terlalu besar. Sila pilih gambar bersaiz kurang dari 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    
    // Proses Pemampatan Gambar (Image Compression) ke Base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress kepada JPEG kualiti 0.7
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const { error } = await supabase.auth.updateUser({ 
            data: { avatar_url: compressedBase64 } 
          });

          if (error) throw error;
          setUserProfile(prev => ({ ...prev, avatarUrl: compressedBase64 }));
          alert('Berjaya mengemas kini gambar profil!');
        } catch (err: any) {
          alert('Gagal memuat naik gambar profil. Sila cuba gambar lain.');
        } finally {
          setIsUploadingAvatar(false);
        }
      };
    };
  };

  // KEMAS KINI 2: FUNGSI SIMPAN BUTIRAN PROFIL
  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const updateData: any = {
        data: {
          full_name: editName,
          name: editName,
          phone_number: editPhone,
          faculty: editFaculty
        }
      };

      if (changePassword && editPassword.length >= 6) {
        updateData.password = editPassword;
      } else if (changePassword && editPassword.length < 6) {
        throw new Error('Kata laluan baharu mesti mengandungi sekurang-kurangnya 6 aksara.');
      }

      const { error } = await supabase.auth.updateUser(updateData);

      if (error) throw error;

      setUserProfile(prev => ({ ...prev, name: editName, faculty: editFaculty }));
      alert('✅ Butiran profil berjaya dikemas kini!');
      
      setIsProfileModalOpen(false);
      setChangePassword(false);
      setEditPassword('');

    } catch (err: any) {
      alert(`Ralat: ${err.message || 'Gagal menyimpan butiran profil.'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name === 'Memuatkan...') return 'AB';
    const cleanName = name.replace(/(Prof\.|Dr\.|Ir\.|Hj\.|Hjh\.|Dato'|Datin)/gi, '').trim();
    const parts = cleanName.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '...';
    return date.toLocaleTimeString('en-MY', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    }).toUpperCase();
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (error) {}
    document.cookie = "abqari_session=; path=/; max-age=0;";
    router.push('/login');
  };

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as const },
    banner: {
      position: 'absolute' as const, top: 0, left: 0, right: 0, 
      minHeight: '320px',
      background: 'linear-gradient(135deg, #3b0764, #4a154b)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
      zIndex: 0,
      borderBottom: '4px solid #fde047'
    },
    container: { maxWidth: '1200px', margin: '0 auto', padding: '35px 20px', position: 'relative' as const, zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', paddingTop: '5px' },
    
    logoText: { color: '#fde047', fontSize: '2.4rem', fontWeight: '900', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.3)', letterSpacing: '-1px' },
    subLogo: { color: '#e2e8f0', fontSize: '0.7rem', fontWeight: '400', letterSpacing: '0.5px', margin: '4px 0 0 0', maxWidth: '350px', lineHeight: '1.4', opacity: '0.9' },
    
    profileBox: { display: 'flex', alignItems: 'flex-start', gap: '15px', color: 'white', textAlign: 'right' as const },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '35px' },
    
    statCard: { 
      backgroundColor: '#2e1065', 
      backgroundImage: 'linear-gradient(135deg, #3b0764, #2e1065)',
      padding: '18px 20px', 
      borderRadius: '14px', 
      border: '1px solid rgba(253, 224, 71, 0.25)', 
      color: 'white', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px',
      boxShadow: '0 10px 20px rgba(0,0,0,0.18)'
    },
    
    menuContainer: { display: 'flex', flexWrap: 'wrap' as const, gap: '16px', justifyContent: 'center' },
    cardWrapper: { flex: '1 1 240px', maxWidth: '280px' },
    card: { 
      height: '100%', 
      borderRadius: '12px', 
      padding: '18px', 
      cursor: 'pointer', 
      display: 'flex', 
      flexDirection: 'column' as const, 
      gap: '10px', 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
    },
    descriptionText: {
      margin: 0, color: '#64748b', fontSize: '0.82rem', lineHeight: '1.5',
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'orient' as any, overflow: 'hidden', textOverflow: 'ellipsis'
    },

    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' as const },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const }
  };

  const menuItems = [
    {
      id: 'kursus', title: 'Pengurusan Kursus',
      desc: 'Daftar subjek baharu, tetapkan pemetaan CO, LO dan format penilaian rasmi Fakulti.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>,
      link: '/kursus', bgColor: '#eff6ff',
      showForLecturer: true
    },
    {
      id: 'sumber', title: 'Pusat Sumber (Nota)',
      desc: 'Muat naik dokumen PDF, slaid, atau modul rasmi untuk dijadikan rujukan bacaan AI.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>,
      link: '/sumber', bgColor: '#ecfdf5',
      showForLecturer: true
    },
    {
      id: 'bank-soalan', title: 'Bank Soalan Kursus',
      desc: 'Simpan, susun, dan cari semula soalan peperiksaan mengikut subjek, aras Bloom, dan CO/LO.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
      link: '/bank-soalan', bgColor: '#e0e7ff',
      showForLecturer: true
    },
    {
      id: 'penjana', title: 'Penjana Soalan & JSU',
      desc: 'Jana kertas soalan peperiksaan dan skema jawapan secara automatik menggunakan AI ABQARI.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
      link: '/penjana', bgColor: '#fffbeb',
      showForLecturer: true
    },
    {
      id: 'chat', title: 'Pembantu AI (RAG)',
      desc: 'Berinteraksi dan bersoal jawab dengan nota PDF anda secara langsung melalui sembang pintar.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M13 8H7"></path><path d="M17 12H7"></path></svg>,
      link: '/chat', bgColor: '#fdf2f8',
      showForLecturer: true
    },
    {
      id: 'arkib', title: 'Arkib & Laporan',
      desc: 'Semak semula sejarah kertas soalan yang telah dijana, eksport rekod, dan muat turun dokumen.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
      link: '/arkib', bgColor: '#f5f3ff',
      showForLecturer: false 
    },
    {
      id: 'tetapan', title: 'Tetapan & Konfigurasi',
      desc: 'Urus profil pensyarah, kemas kini templat MS Word rasmi, dan kawalan tetapan enjin AI.',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
      link: '/admin', bgColor: '#fef2f2',
      showForLecturer: false 
    }
  ];

  const activeMenu = menuItems.filter(item => isAdmin || item.showForLecturer);

  if (!isSessionVerified) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#3b0764', color: 'white', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#fde047', marginBottom: '10px' }}>ABQARI UiTM</h2>
        <p style={{ opacity: 0.8 }}>🔒 Mengesahkan akses keselamatan...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      
      <div style={styles.banner} />

      <div style={styles.container}>
        
        <div style={styles.headerBox}>
          <div>
            <h1 style={styles.logoText}>ABQARI</h1>
            <p style={styles.subLogo}>ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR</p>
          </div>
          
          <div style={styles.profileBox}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '1.25rem', color: '#ffffff', letterSpacing: '0.5px' }}>
                  {userProfile.name}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {userProfile.faculty}
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                
                <div style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', 
                  alignItems: 'flex-end', justifyContent: 'center', gap: '2px', height: '100%'
                }}>
                  <div style={{ fontSize: '0.88rem', color: '#ffffff', letterSpacing: '0.5px' }}>
                    🕒 <strong style={{ color: '#fde047', fontFamily: 'monospace', fontSize: '0.95rem' }}>{formatTime(currentTime)}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                    <span style={{ opacity: 0.8 }}>Masa Masuk:</span> <span style={{ fontWeight: '600' }}>{formatTime(loginTime)}</span>
                  </div>
                  <div style={{ fontSize: '0.70rem', color: '#cbd5e1' }}>
                    <span style={{ opacity: 0.7 }}>Last Login:</span> <span style={{ fontWeight: '600', color: '#93c5fd' }}>{lastLoginFormatted}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      backgroundColor: '#ef4444', color: 'white', border: '1px solid #f87171', padding: '6px 12px',
                      borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
                      transition: 'all 0.2s', width: '100%', boxSizing: 'border-box'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                  >
                    🚪 Log Keluar
                  </button>

                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    style={{
                      backgroundColor: '#3b82f6', color: 'white', border: '1px solid #60a5fa', padding: '6px 12px',
                      borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
                      transition: 'all 0.2s', width: '100%', boxSizing: 'border-box'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    👤 Kemaskini Profil
                  </button>
                </div>
              </div>

            </div>
            
            <div 
              onClick={() => document.getElementById('avatar-file-input')?.click()}
              style={{ 
                width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fde047', color: '#3b0764', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.4rem', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '3px solid #ffffff', cursor: 'pointer', overflow: 'hidden',
                position: 'relative', flexShrink: 0
              }}
              title="Klik untuk muat naik gambar profil baharu"
            >
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt="Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(userProfile.name)
              )}

              {isUploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                  ⏳
                </div>
              )}

              <input 
                id="avatar-file-input" type="file" accept="image/jpeg, image/png, image/jpg" 
                onChange={handleAvatarUpload} style={{ display: 'none' }} 
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <CreditBadge />
        </div>

        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '10px', borderRadius: '10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#fde047' }}>{isLoadingStats ? '...' : stats.subjects}</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#f1f5f9', fontWeight: '600' }}>Kursus Berdaftar</p>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '10px', borderRadius: '10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#38bdf8' }}>{isLoadingStats ? '...' : stats.docs}</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#f1f5f9', fontWeight: '600' }}>Dokumen Sumber AI</p>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '10px', borderRadius: '10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#fb7185' }}>{isLoadingStats ? '...' : stats.archives}</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#f1f5f9', fontWeight: '600' }}>Soalan Dijana (Arkib)</p>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: '10px', borderRadius: '10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#4ade80' }}>{isLoadingStats ? '...' : stats.users}</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#f1f5f9', fontWeight: '600' }}>Pengguna Berdaftar</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '20px', fontSize: '1.3rem', fontWeight: 'bold' }}>Pilih Modul Tindakan</h2>
          
          <div style={styles.menuContainer}>
            {activeMenu.map((item) => (
              <div key={item.id} style={styles.cardWrapper}>
                <Link href={item.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                  <div 
                    onMouseEnter={() => setHoveredCard(item.id)} onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      ...styles.card,
                      backgroundColor: hoveredCard === item.id ? '#ffffff' : 'rgba(226, 232, 240, 0.65)',
                      border: hoveredCard === item.id ? '1px solid #cbd5e1' : '1px solid rgba(203, 213, 225, 0.6)',
                      transform: hoveredCard === item.id ? 'translateY(-4px)' : 'translateY(0)',
                      boxShadow: hoveredCard === item.id ? '0 12px 20px -5px rgba(0,0,0,0.08), 0 8px 8px -5px rgba(0,0,0,0.03)' : '0 2px 4px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: item.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>{item.icon}</div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: '700' }}>{item.title}</h3>
                      <p style={styles.descriptionText}>{item.desc}</p>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', color: hoveredCard === item.id ? '#3b0764' : '#64748b', fontWeight: 'bold', fontSize: '0.8rem', transition: 'color 0.2s' }}>
                      Akses Modul <span style={{ marginLeft: '4px', transform: hoveredCard === item.id ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 0.2s' }}>→</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
          <p>© {new Date().getFullYear()} ABQARI. Hak Cipta Terpelihara. ACIS, Universiti Teknologi MARA (UiTM).</p>
        </div>

      </div>

      {/* KEMAS KINI: MODAL KEMASKINI PROFIL DIPERLUAS */}
      {isProfileModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
                👤 Kemaskini Butiran Profil
              </h3>
              <button onClick={() => setIsProfileModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveProfileDetails}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  Emel Rasmi <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'normal' }}>(Tidak boleh diubah)</span>
                </label>
                <input type="text" readOnly style={{ ...styles.input, backgroundColor: '#e2e8f0', color: '#64748b', cursor: 'not-allowed' }} value={userProfile.email} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Nama Penuh & Gelaran</label>
                <input type="text" required style={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Fakulti / Jabatan</label>
                <input type="text" required style={styles.input} value={editFaculty} onChange={(e) => setEditFaculty(e.target.value)} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Nombor Telefon / WhatsApp</label>
                <input type="tel" required style={styles.input} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>

              {/* BAHAGIAN KEMASKINI KATA LALUAN PENGGUNA */}
              <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#3b0764', cursor: 'pointer' }}>
                  <input type="checkbox" checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} />
                  Tukar Kata Laluan Baharu?
                </label>
                
                {changePassword && (
                  <div style={{ marginTop: '12px' }}>
                    <input 
                      type="password" 
                      placeholder="Masukkan kata laluan baharu (min 6 aksara)" 
                      required={changePassword}
                      style={styles.input} 
                      value={editPassword} 
                      onChange={(e) => setEditPassword(e.target.value)} 
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsProfileModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}>Batal</button>
                <button type="submit" disabled={isSavingProfile} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>{isSavingProfile ? '⏳ Menyimpan...' : '💾 Simpan Profil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}