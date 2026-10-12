'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// SENARAI E-MEL SUPERADMIN (KEBAL)
// ============================================================================
const SUPERADMIN_EMAILS = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  
  // Tab State (Ditambah 'tests' untuk Pemantauan Ujian)
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'credit' | 'tests'>('pending');

  // ==================== STATE PENGGUNA ====================
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedCreditUser, setSelectedCreditUser] = useState<any | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(15);
  const [bonusCredit, setBonusCredit] = useState<number>(0);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
  const [isSubmittingCredit, setIsSubmittingCredit] = useState<boolean>(false);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editData, setEditData] = useState({ name: '', faculty: '', phone: '', role: 'user' });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // ==================== STATE PEMANTAUAN UJIAN (BARU) ====================
  const [allTests, setAllTests] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourseCode, setFilterCourseCode] = useState('');
  
  const [showEditTestModal, setShowEditTestModal] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [isSavingTest, setIsSavingTest] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;

    let userEmail = user?.email || '';
    let userRole = user?.user_metadata?.role || '';
    let userName = user?.user_metadata?.full_name || 'Pentadbir';

    if (!user && localUser) {
       const parsed = JSON.parse(localUser);
       userEmail = parsed.email || '';
       userRole = parsed.role || '';
       userName = parsed.name || 'Pentadbir';
    }

    if (!userEmail && !user) {
      router.push('/login');
      return;
    }

    const isAdmin = SUPERADMIN_EMAILS.includes(userEmail) || userRole === 'admin';

    if (!isAdmin) {
      alert('Akses Ditolak: Anda bukan pentadbir (Admin) sistem ini.');
      router.push('/');
      return;
    }

    setIsAdminAuth(true);
    setAdminProfile({ name: userName, email: userEmail });
    
    // Muatkan Data Pengguna & Data Ujian Serentak
    fetchUsers();
    fetchTestsData();
  };

  // --- FUNGSI DATA PENGGUNA ---
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setUsers(json.data || json.users || []);
      }
    } catch (err) {
      console.error('Ralat menarik senarai pengguna:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (userObj: any, action: 'approve' | 'reject') => {
    if (SUPERADMIN_EMAILS.includes(userObj.email)) {
      alert('🛡️ RALAT KESELAMATAN: Akaun Superadmin adalah KEBAL dan tidak boleh ditolak atau dipadam.');
      return;
    }

    const userName = userObj.full_name || userObj.name || 'Pensyarah';
    const confirmMessage = action === 'approve' 
      ? `Adakah anda pasti mahu MELULUSKAN akaun ${userName}? Notifikasi WhatsApp & Emel akan dijana secara automatik.` 
      : `Adakah anda pasti mahu MENOLAK & MEMADAM permohonan akaun ${userName}?`;

    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userObj.id, action })
      });

      const json = await res.json();
      if (json.success) {
        if (action === 'approve') {
          alert(`✅ Akaun ${userName} berjaya diluluskan!\nSistem akan membuka pautan WhatsApp & Emel pemberitahuan.`);

          let rawPhone = (userObj.phone || '').replace(/[^0-9]/g, '');
          if (rawPhone.startsWith('0')) {
            rawPhone = '60' + rawPhone.slice(1);
          }

          const msgText = `Assalamu'alaikum & Salam Sejahtera ${userName},\n\nPendaftaran akaun ABQARI anda telah BERJAYA DILULUSKAN oleh Pentadbir (Admin) UiTM.\n\nSila log masuk ke portal ABQARI menggunakan emel rasmi dan kata laluan yang telah anda cipta semasa pendaftaran dahulu.\n\nPautan Portal: ${window.location.origin}/login\n\nSekian, terima kasih.`;

          if (rawPhone && rawPhone.length >= 10) {
            const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(msgText)}`;
            window.open(waUrl, '_blank');
          }

          if (userObj.email) {
            const mailSubject = encodeURIComponent("Kelulusan Pendaftaran Akaun ABQARI UiTM");
            const mailBody = encodeURIComponent(msgText);
            const mailUrl = `mailto:${userObj.email}?subject=${mailSubject}&body=${mailBody}`;
            window.open(mailUrl, '_blank');
          }

        } else {
          alert('🗑️ Akaun berjaya ditolak.');
        }

        setIsViewModalOpen(false);
        fetchUsers();
      } else {
        alert(`Ralat: ${json.error}`);
      }
    } catch (err) {
      alert('Ralat semasa mengemas kini status pengguna.');
    }
  };

  const handleDeleteActiveUser = async (userObj: any) => {
    if (SUPERADMIN_EMAILS.includes(userObj.email)) {
      alert('🛡️ RALAT KESELAMATAN: Akaun Superadmin adalah KEBAL dan tidak boleh dipadam dari sistem.');
      return;
    }

    const userName = userObj.full_name || userObj.name || 'Pensyarah';
    if (!confirm(`Adakah anda pasti mahu MEMADAM akaun pensyarah ${userName} secara kekal dari sistem?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userObj.id })
      });

      const json = await res.json();
      if (json.success) {
        alert('🗑️ Akaun berjaya dipadam.');
        fetchUsers();
      } else {
        alert(`Ralat: ${json.error}`);
      }
    } catch (err) {
      alert('Ralat semasa memadam pengguna.');
    }
  };

  const openEditModal = (u: any) => {
    if (SUPERADMIN_EMAILS.includes(u.email)) {
      alert('🛡️ RALAT KESELAMATAN: Maklumat Akaun Superadmin Utama tidak boleh disunting.');
      return;
    }
    setEditUser(u);
    setEditData({
      name: u.full_name || u.name || '',
      faculty: u.faculty || '',
      phone: u.phone || '',
      role: u.role || 'user'
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          userId: editUser.id,
          profileData: {
            full_name: editData.name,
            name: editData.name, 
            faculty: editData.faculty,
            phone: editData.phone,
            role: editData.role
          }
        })
      });

      const json = await res.json();
      if (json.success || res.ok) {
        alert(`✅ Profil ${editData.name} berjaya dikemas kini!`);
        setIsEditModalOpen(false);
        fetchUsers(); 
      } else {
        alert(`Ralat: ${json.error || 'Gagal mengemas kini profil.'}`);
      }
    } catch (err) {
      console.error('Ralat kemas kini pengguna:', err);
      alert('Ralat pelayan semasa menyimpan maklumat pengguna.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const openCreditModal = (u: any) => {
    if (SUPERADMIN_EMAILS.includes(u.email)) {
      alert('🛡️ Akaun Superadmin mempunyai akses tanpa had secara automatik. Tiada tetapan diperlukan.');
      return;
    }
    setSelectedCreditUser(u);
    setDailyLimit(u.daily_limit || 15);
    setBonusCredit(u.bonus_credit || 0);
    setIsUnlimited(u.role === 'admin' || u.is_unlimited === true);
    setIsCreditModalOpen(true);
  };

  const openViewModal = (u: any) => {
    setViewUser(u);
    setIsViewModalOpen(true);
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditUser) return;

    setIsSubmittingCredit(true);
    try {
      const res = await fetch('/api/admin/update-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedCreditUser.id,
          dailyLimit: Number(dailyLimit),
          bonusCredit: Number(bonusCredit),
          isUnlimited: isUnlimited
        })
      });

      const json = await res.json();
      if (json.success || res.ok) {
        alert(`✅ Tetapan kredit untuk ${selectedCreditUser.full_name || selectedCreditUser.name} berjaya dikemas kini!`);
        setIsCreditModalOpen(false);
        fetchUsers();
      } else {
        alert(`Ralat: ${json.error || 'Gagal mengemas kini kredit.'}`);
      }
    } catch (err) {
      console.error('Ralat kemas kini kredit:', err);
      alert('Ralat pelayan semasa menyimpan tetapan kredit.');
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  // --- FUNGSI DATA UJIAN DALAM TALIAN ---
  const fetchTestsData = async () => {
    try {
      const { data: testsData } = await supabase.from('online_tests').select('*').order('created_at', { ascending: false });
      if (testsData) setAllTests(testsData);

      const { data: sessionsData } = await supabase.from('test_sessions').select('id, test_id, status');
      if (sessionsData) setAllSessions(sessionsData);
    } catch (error) {
      console.error("Ralat memuat turun data ujian:", error);
    }
  };

  const openEditTestModal = (test: any) => {
    setEditingTest(test);
    setEditCourseCode(test.course_code || '');
    setEditSemester(test.semester || '');
    setShowEditTestModal(true);
  };

  const handleSaveTestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    setIsSavingTest(true);
    try {
      const { error } = await supabase
        .from('online_tests')
        .update({ course_code: editCourseCode, semester: editSemester })
        .eq('id', editingTest.id);

      if (error) throw error;

      setAllTests(prev => prev.map(t => t.id === editingTest.id ? { ...t, course_code: editCourseCode, semester: editSemester } : t));
      setShowEditTestModal(false);
      alert('✅ Berjaya! Kod Kursus dan Semester telah dikemaskini.');
    } catch (error: any) {
      alert(`Gagal menyimpan: ${error.message}`);
    } finally {
      setIsSavingTest(false);
    }
  };

  const handleDeleteTest = async (testId: string, testName: string) => {
    if (!window.confirm(`⚠️ AMARAN PENTADBIR ⚠️\n\nAdakah anda pasti mahu MENGHAPUSKAN ujian "${testName}" secara kekal? Semua rekod pelajar untuk ujian ini juga akan terhapus.`)) return;
    try {
      const { error } = await supabase.from('online_tests').delete().eq('id', testId);
      if (error) throw error;
      setAllTests(prev => prev.filter(t => t.id !== testId));
      alert('🗑️ Ujian berjaya dihapuskan.');
    } catch (error: any) {
      alert(`Gagal memadam: ${error.message}`);
    }
  };

  // --- PEMPROSESAN DATA PAPARAN ---
  if (!isAdminAuth) return null;

  const processedUsers = users.map(u => {
    if (SUPERADMIN_EMAILS.includes(u.email)) {
      return { ...u, is_approved: true, status: 'approved', role: 'admin', is_unlimited: true };
    }
    return u;
  });

  const pendingUsers = processedUsers.filter(u => !u.is_approved && u.status !== 'approved');
  const approvedUsers = processedUsers.filter(u => u.is_approved || u.status === 'approved');

  // Saringan Ujian
  const uniqueCourseCodes = Array.from(new Set(allTests.map(t => t.course_code).filter(Boolean)));
  const uniqueSemesters = Array.from(new Set(allTests.map(t => t.semester).filter(Boolean)));
  const filteredTests = allTests.filter(t => {
    const matchSemester = filterSemester ? t.semester === filterSemester : true;
    const matchCourse = filterCourseCode ? t.course_code === filterCourseCode : true;
    return matchSemester && matchCourse;
  });

  const totalOngoingSessions = allSessions.filter(s => s.status === 'ongoing').length;
  const totalCompletedSessions = allSessions.filter(s => s.status === 'completed' || s.status === 'terminated').length;

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: '60px' },
    banner: { height: '220px', background: 'linear-gradient(135deg, #3b0764, #1e1b4b)', color: 'white', padding: '35px 20px', borderBottom: '4px solid #fde047' },
    container: { maxWidth: '1400px', margin: '-50px auto 0 auto', padding: '0 20px', position: 'relative' as const, zIndex: 10 },
    card: { backgroundColor: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', marginBottom: '25px', border: '1px solid #e2e8f0' },
    
    tabBtn: (isActive: boolean) => ({
      padding: '10px 22px',
      borderRadius: '8px',
      fontWeight: '800',
      fontSize: '0.98rem',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: isActive ? '#3b0764' : '#e2e8f0',
      color: isActive ? '#ffffff' : '#475569',
      transition: 'all 0.2s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }),

    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.88rem' },
    th: { textAlign: 'left' as const, padding: '14px 12px', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '700', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' as const },
    td: { padding: '14px 12px', borderBottom: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' as const },
    
    actionContainer: { display: 'flex', flexDirection: 'row' as const, gap: '6px', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'nowrap' as const },
    
    btnView: { backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnEdit: { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnCredit: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: '4px' },

    badgePending: { backgroundColor: '#fef3c7', color: '#b45309', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as const },
    badgeApproved: { backgroundColor: '#dcfce7', color: '#15803d', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as const },
    badgeCredit: { backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as const },
    
    kebalLabel: { fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' },

    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' as const },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const },
    viewLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', marginBottom: '4px' },
    viewData: { fontSize: '0.92rem', color: '#0f172a', fontWeight: '600', marginBottom: '14px', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }
  };

  return (
    <div style={styles.page}>
      
      {/* HEADER BANNER */}
      <div style={styles.banner}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '15px' }}>
            <Link href="/" style={{ color: '#fde047', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
              ← Kembali ke Papan Pemuka Utama
            </Link>
          </div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '2.2rem', fontWeight: '900', color: '#ffffff' }}>
            🛡️ Modul Pentadbir ABQARI
          </h1>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>
            Kawalan Akses Pengguna, Pengurusan Kredit & Pemantauan Peperiksaan.
          </p>
        </div>
      </div>

      <div style={styles.container}>
        
        {/* KONTROL TAB */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button style={styles.tabBtn(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
            ⏳ Kelulusan Pengguna ({pendingUsers.length})
          </button>
          <button style={styles.tabBtn(activeTab === 'active')} onClick={() => setActiveTab('active')}>
            👥 Pensyarah Aktif ({approvedUsers.length})
          </button>
          <button style={styles.tabBtn(activeTab === 'credit')} onClick={() => setActiveTab('credit')}>
            💳 Pengurusan Kredit
          </button>
          {/* TAB BAHARU: PEMANTAUAN UJIAN */}
          <button style={styles.tabBtn(activeTab === 'tests')} onClick={() => setActiveTab('tests')}>
            📝 Pemantauan Ujian ({allTests.length})
          </button>
        </div>

        {/* =========================================================
            TAB 1: MENUNGGU KELULUSAN
        ========================================================= */}
        {activeTab === 'pending' && (
          <div style={{ ...styles.card, borderTop: '5px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
              Pendaftaran Baharu Menunggu Kelulusan Admin
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '50px' }}>Bil.</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Nama Pensyarah</th>
                    <th style={{ ...styles.th, minWidth: '220px' }}>Fakulti / Jabatan</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Emel</th>
                    <th style={{ ...styles.th, minWidth: '130px' }}>Telefon</th>
                    <th style={{ ...styles.th, width: '110px' }}>Status</th>
                    <th style={{ ...styles.th, minWidth: '220px' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>⏳ Memuatkan data pengguna...</td></tr>
                  ) : pendingUsers.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>🎉 Tiada pendaftaran baharu yang menunggu kelulusan.</td></tr>
                  ) : (
                    pendingUsers.map((u, idx) => (
                      <tr key={u.id}>
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>{u.full_name || u.name}</td>
                        <td style={styles.td}>{u.faculty}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>{u.phone}</td>
                        <td style={styles.td}><span style={styles.badgePending}>Menunggu</span></td>
                        <td style={styles.td}>
                          <div style={styles.actionContainer}>
                            <button style={styles.btnView} onClick={() => openViewModal(u)}>🔍 Lihat</button>
                            <button style={styles.btnApprove} onClick={() => handleUserAction(u, 'approve')}>Luluskan</button>
                            <button style={styles.btnReject} onClick={() => handleUserAction(u, 'reject')}>Tolak</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: PENSYARAH AKTIF
        ========================================================= */}
        {activeTab === 'active' && (
          <div style={{ ...styles.card, borderTop: '5px solid #3b0764' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
              Senarai Pensyarah Berdaftar
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '50px' }}>Bil.</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Nama Pensyarah</th>
                    <th style={{ ...styles.th, minWidth: '220px' }}>Fakulti</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Emel</th>
                    <th style={{ ...styles.th, minWidth: '130px' }}>Telefon</th>
                    <th style={{ ...styles.th, minWidth: '110px' }}>Peranan</th>
                    <th style={{ ...styles.th, minWidth: '130px' }}>Status Akses</th>
                    <th style={{ ...styles.th, minWidth: '150px' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>⏳ Memuatkan data...</td></tr>
                  ) : approvedUsers.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Tiada pengguna aktif dijumpai.</td></tr>
                  ) : (
                    approvedUsers.map((u, idx) => (
                      <tr key={u.id}>
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>{u.full_name || u.name}</td>
                        <td style={styles.td}>{u.faculty}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>{u.phone}</td>
                        <td style={styles.td}>
                          <span style={{ fontWeight: '700', color: SUPERADMIN_EMAILS.includes(u.email) || u.role === 'admin' ? '#9333ea' : '#2563eb' }}>
                            {SUPERADMIN_EMAILS.includes(u.email) ? '👑 Superadmin' : u.role === 'admin' ? '🛡️ Admin' : 'Pensyarah'}
                          </span>
                        </td>
                        <td style={styles.td}><span style={styles.badgeApproved}>Diluluskan</span></td>
                        <td style={styles.td}>
                          {SUPERADMIN_EMAILS.includes(u.email) ? (
                            <span style={styles.kebalLabel}>🔒 Pentadbir Kebal</span>
                          ) : (
                            <div style={styles.actionContainer}>
                              <button style={styles.btnEdit} onClick={() => openEditModal(u)}>Edit</button>
                              <button style={styles.btnReject} onClick={() => handleDeleteActiveUser(u)}>Hapus</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: PENGURUSAN KREDIT PENSYARAH
        ========================================================= */}
        {activeTab === 'credit' && (
          <div style={{ ...styles.card, borderTop: '5px solid #8b5cf6' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
              Tetapan & Pengurusan Kuota Kredit Pensyarah
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '50px' }}>Bil.</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Nama Pensyarah</th>
                    <th style={{ ...styles.th, minWidth: '220px' }}>Fakulti</th>
                    <th style={{ ...styles.th, minWidth: '180px' }}>Emel</th>
                    <th style={{ ...styles.th, minWidth: '120px' }}>Had Harian</th>
                    <th style={{ ...styles.th, minWidth: '120px' }}>Kredit Bonus</th>
                    <th style={{ ...styles.th, minWidth: '110px' }}>Mod Kredit</th>
                    <th style={{ ...styles.th, minWidth: '160px' }}>Tindakan Tetapan</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>⏳ Memuatkan data...</td></tr>
                  ) : approvedUsers.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Tiada pensyarah aktif untuk ditetapkan kredit.</td></tr>
                  ) : (
                    approvedUsers.map((u, idx) => (
                      <tr key={u.id}>
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>{u.full_name || u.name}</td>
                        <td style={styles.td}>{u.faculty}</td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>
                          {SUPERADMIN_EMAILS.includes(u.email) || u.is_unlimited ? '⚡ Unlimited' : `${u.daily_limit || 15} / Hari`}
                        </td>
                        <td style={styles.td}>
                          {SUPERADMIN_EMAILS.includes(u.email) ? (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tidak Relevan</span>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: '700' }}>
                              +{u.bonus_credit || 0} Bonus
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeCredit}>
                            {SUPERADMIN_EMAILS.includes(u.email) || u.is_unlimited ? 'Unlimited' : 'Standard'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {SUPERADMIN_EMAILS.includes(u.email) ? (
                             <span style={styles.kebalLabel}>🔒 Akses Mutlak</span>
                          ) : (
                            <div style={styles.actionContainer}>
                              <button style={styles.btnCredit} onClick={() => openCreditModal(u)}>
                                ⚙️ Kemaskini Kredit
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: PEMANTAUAN UJIAN DALAM TALIAN (BARU)
        ========================================================= */}
        {activeTab === 'tests' && (
          <>
            {/* STATISTIK UJIAN */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ ...styles.card, borderLeft: '4px solid #3b82f6', marginBottom: 0 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>JUMLAH UJIAN DIDAFTARKAN</div>
                <div style={{ fontSize: '2rem', color: '#0f172a', fontWeight: '900' }}>{allTests.length}</div>
              </div>
              <div style={{ ...styles.card, borderLeft: '4px solid #eab308', marginBottom: 0 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>PELAJAR SEDANG MENJAWAB (LIVE)</div>
                <div style={{ fontSize: '2rem', color: '#eab308', fontWeight: '900' }}>{totalOngoingSessions} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>pelajar</span></div>
              </div>
              <div style={{ ...styles.card, borderLeft: '4px solid #10b981', marginBottom: 0 }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>UJIAN SELESAI / DIHANTAR</div>
                <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: '900' }}>{totalCompletedSessions} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>rekod</span></div>
              </div>
            </div>

            {/* KAWALAN & SARINGAN UJIAN */}
            <div style={{ ...styles.card, borderTop: '5px solid #10b981' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔍</span> Saringan Ujian & Kawalan Parameter
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Saring Mengikut Semester / Sesi:</label>
                  <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={styles.input}>
                    <option value="">Semua Semester</option>
                    {uniqueSemesters.map((sem, i) => <option key={i} value={sem as string}>{sem as string}</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Saring Mengikut Kod Kursus:</label>
                  <select value={filterCourseCode} onChange={(e) => setFilterCourseCode(e.target.value)} style={styles.input}>
                    <option value="">Semua Kod Kursus</option>
                    {uniqueCourseCodes.map((code, i) => <option key={i} value={code as string}>{code as string}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Senarai Induk Ujian Dalam Talian</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>{filteredTests.length} rekod ditemui</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{...styles.th, width: '40px'}}>Bil.</th>
                      <th style={{...styles.th, minWidth: '100px'}}>Kod Kursus</th>
                      <th style={{...styles.th, minWidth: '220px'}}>Nama Ujian / Kumpulan</th>
                      <th style={{...styles.th, minWidth: '120px'}}>Semester</th>
                      <th style={{...styles.th, minWidth: '180px'}}>Dicipta Oleh (Pensyarah)</th>
                      <th style={{...styles.th, minWidth: '120px'}}>Calon Mendaftar</th>
                      <th style={{...styles.th, textAlign: 'center', minWidth: '180px'}}>Tindakan Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTests.length > 0 ? filteredTests.map((test, index) => {
                      const testSessionCount = allSessions.filter(s => s.test_id === test.id).length;
                      return (
                        <tr key={test.id} style={{ transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ ...styles.td, color: '#64748b' }}>{index + 1}.</td>
                          <td style={{ ...styles.td, fontWeight: 'bold', color: '#3b82f6' }}>{test.course_code || 'N/A'}</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 'bold' }}>{test.test_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Kumpulan: {test.group_name || 'Umum'}</div>
                          </td>
                          <td style={styles.td}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>{test.semester || 'N/A'}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{test.lecturer_name || 'Tidak Diketahui'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(test.created_at).toLocaleDateString('ms-MY')}</div>
                          </td>
                          <td style={styles.td}>
                            <span style={{ backgroundColor: testSessionCount > 0 ? '#dcfce7' : '#f1f5f9', color: testSessionCount > 0 ? '#166534' : '#64748b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {testSessionCount} Calon
                            </span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => openEditTestModal(test)} style={styles.btnView}>
                                ✏️ Edit
                              </button>
                              <button onClick={() => handleDeleteTest(test.id, test.test_name)} style={styles.btnReject}>
                                🗑️ Padam
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Tiada ujian ditemui berdasarkan saringan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>

      {/* =========================================================
          SEMUA MODAL DI BAWAH INI
      ========================================================= */}

      {/* MODAL 1: LIHAT BUTIRAN PENUH (VIEW USER) */}
      {isViewModalOpen && viewUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
                🔍 Maklumat Pendaftaran Lengkap
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={styles.viewLabel}>Nama Penuh / Gelaran:</span>
              <div style={styles.viewData}>{viewUser.full_name || viewUser.name}</div>

              <span style={styles.viewLabel}>Fakulti / Jabatan:</span>
              <div style={styles.viewData}>{viewUser.faculty}</div>

              <span style={styles.viewLabel}>Emel Rasmi:</span>
              <div style={styles.viewData}>{viewUser.email}</div>

              <span style={styles.viewLabel}>Nombor Telefon / WhatsApp:</span>
              <div style={styles.viewData}>{viewUser.phone}</div>

              <span style={styles.viewLabel}>Tarikh Permohonan:</span>
              <div style={styles.viewData}>{new Date(viewUser.created_at).toLocaleString('ms-MY')}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
              <button 
                onClick={() => handleUserAction(viewUser, 'reject')}
                style={{ ...styles.btnReject, padding: '10px 16px', fontSize: '0.88rem' }}
              >
                ❌ Tolak Permohonan
              </button>
              <button 
                onClick={() => handleUserAction(viewUser, 'approve')}
                style={{ ...styles.btnApprove, padding: '10px 16px', fontSize: '0.88rem' }}
              >
                ✅ Luluskan & Hantar Notifikasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: KEMASKINI PROFIL PENGGUNA (EDIT USER) */}
      {isEditModalOpen && editUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
                ✏️ Edit Maklumat Pengguna
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={styles.viewLabel}>Nama Penuh / Gelaran</label>
                <input 
                  type="text" 
                  style={styles.input} 
                  value={editData.name} 
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.viewLabel}>Fakulti / Jabatan</label>
                <input 
                  type="text" 
                  style={styles.input} 
                  value={editData.faculty} 
                  onChange={(e) => setEditData({ ...editData, faculty: e.target.value })} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.viewLabel}>Nombor Telefon</label>
                <input 
                  type="text" 
                  style={styles.input} 
                  value={editData.phone} 
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.viewLabel}>Peranan (Role)</label>
                <select 
                  style={styles.input} 
                  value={editData.role} 
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                >
                  <option value="user">Pensyarah Biasa</option>
                  <option value="admin">🛡️ Pentadbir (Admin)</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                  * Jika anda menukar kepada 'Admin', pengguna ini akan dapat melihat & mengakses butang ke halaman Modul Pentadbir.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingEdit}
                  style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {isSubmittingEdit ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: KEMASKINI KREDIT */}
      {isCreditModalOpen && selectedCreditUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
                ⚙️ Kemaskini Kredit Pensyarah
              </h3>
              <button onClick={() => setIsCreditModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
              Menetapkan kuota pengagihan kredit bagi <strong>{selectedCreditUser.full_name || selectedCreditUser.name}</strong> ({selectedCreditUser.email}).
            </p>

            <form onSubmit={handleSaveCredit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  Tanpa Had (Unlimited Credit)
                </label>
                <select 
                  style={styles.input}
                  value={isUnlimited ? 'yes' : 'no'}
                  onChange={(e) => setIsUnlimited(e.target.value === 'yes')}
                >
                  <option value="no">Standard (Mengikut Had Harian)</option>
                  <option value="yes">⚡ Unlimited (Tanpa Had - Khas Admin)</option>
                </select>
              </div>

              {!isUnlimited && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                      Had Kredit Harian (Default: 15)
                    </label>
                    <input 
                      type="number"
                      min={1}
                      max={500}
                      style={styles.input}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                      Tambah Kredit Bonus Tambahan
                    </label>
                    <input 
                      type="number"
                      min={0}
                      max={500}
                      style={styles.input}
                      value={bonusCredit}
                      onChange={(e) => setBonusCredit(Number(e.target.value))}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsCreditModalOpen(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingCredit}
                  style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {isSubmittingCredit ? '⏳ Menyimpan...' : '💾 Simpan Tetapan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: KEMASKINI UJIAN DALAM TALIAN (EDIT TEST) */}
      {showEditTestModal && editingTest && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '800' }}>
                ✏️ Kawalan Parameter Ujian Admin
              </h3>
              <button onClick={() => setShowEditTestModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveTestEdit}>
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px', fontSize: '0.85rem', color: '#475569' }}>
                Mengemaskini parameter untuk ujian: <strong>{editingTest.test_name}</strong>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={styles.viewLabel}>Kod Kursus (Boleh Diubah)</label>
                <input 
                  type="text" 
                  value={editCourseCode} 
                  onChange={(e) => setEditCourseCode(e.target.value)} 
                  style={styles.input} 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={styles.viewLabel}>Semester / Sesi (Boleh Diubah)</label>
                <select 
                  value={editSemester} 
                  onChange={(e) => setEditSemester(e.target.value)} 
                  style={styles.input}
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>*Pensyarah biasa tidak boleh mengubah parameter ini. Hanya Pentadbir (Admin) yang boleh menetapkannya.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditTestModal(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingTest}
                  style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {isSavingTest ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}