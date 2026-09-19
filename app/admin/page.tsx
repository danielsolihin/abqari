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
// E-mel ini tidak boleh dipadam, ditolak, dan sentiasa mempunyai akses penuh
// ============================================================================
const SUPERADMIN_EMAILS = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'credit'>('pending');

  // State Modal Tetapan Kredit
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedCreditUser, setSelectedCreditUser] = useState<any | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(15);
  const [bonusCredit, setBonusCredit] = useState<number>(0);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
  const [isSubmittingCredit, setIsSubmittingCredit] = useState<boolean>(false);

  // State Modal Lihat/View Pengguna
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const isAdmin = SUPERADMIN_EMAILS.includes(user.email || '') || user.user_metadata?.role === 'admin';

    if (!isAdmin) {
      alert('Akses Ditolak: Anda bukan pentadbir (Admin) sistem ini.');
      router.push('/');
      return;
    }

    setIsAdminAuth(true);
    fetchUsers();
  };

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
    // BLOK KESELAMATAN SUPERADMIN
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
    // BLOK KESELAMATAN SUPERADMIN
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

  const handleEditUser = (userName: string) => {
    alert(`Fungsi Edit untuk ${userName} sedang dalam pembangunan dan akan diaktifkan kelak.`);
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

  if (!isAdminAuth) return null;

  // =========================================================================
  // PEMPROSESAN DATA PENGGUNA (PASTIKAN SUPERADMIN SENTIASA AKTIF & KEBAL)
  // =========================================================================
  const processedUsers = users.map(u => {
    if (SUPERADMIN_EMAILS.includes(u.email)) {
      return { ...u, is_approved: true, status: 'approved', role: 'admin', is_unlimited: true };
    }
    return u;
  });

  const pendingUsers = processedUsers.filter(u => !u.is_approved && u.status !== 'approved');
  const approvedUsers = processedUsers.filter(u => u.is_approved || u.status === 'approved');

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: '60px' },
    banner: { height: '220px', background: 'linear-gradient(135deg, #3b0764, #1e1b4b)', color: 'white', padding: '35px 20px', borderBottom: '4px solid #fde047' },
    container: { maxWidth: '1400px', margin: '-50px auto 0 auto', padding: '0 20px', position: 'relative' as 'relative', zIndex: 10 },
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

    table: { width: '100%', borderCollapse: 'collapse' as 'collapse', fontSize: '0.88rem' },
    th: { textAlign: 'left' as 'left', padding: '14px 12px', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '700', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' as 'nowrap' },
    td: { padding: '14px 12px', borderBottom: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' as 'middle' },
    
    actionContainer: { display: 'flex', flexDirection: 'row' as 'row', gap: '6px', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'nowrap' as 'nowrap' },
    
    btnView: { backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnEdit: { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' },
    btnCredit: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' },

    badgePending: { backgroundColor: '#fef3c7', color: '#b45309', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as 'nowrap' },
    badgeApproved: { backgroundColor: '#dcfce7', color: '#15803d', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as 'nowrap' },
    badgeCredit: { backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap' as 'nowrap' },
    
    // Label Pentadbir Kebal
    kebalLabel: { fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' },

    modalOverlay: { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', boxSizing: 'border-box' as 'boxSizing' },
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
            Kawalan Kelulusan Akses & Pengurusan Kuota Kredit Pensyarah
          </p>
        </div>
      </div>

      <div style={styles.container}>
        
        {/* KONTROL TAB */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button style={styles.tabBtn(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
            ⏳ Menunggu Kelulusan ({pendingUsers.length})
          </button>
          <button style={styles.tabBtn(activeTab === 'active')} onClick={() => setActiveTab('active')}>
            👥 Pensyarah Aktif ({approvedUsers.length})
          </button>
          <button style={styles.tabBtn(activeTab === 'credit')} onClick={() => setActiveTab('credit')}>
            💳 Pengurusan Kredit ({approvedUsers.length})
          </button>
        </div>

        {/* TAB 1: MENUNGGU KELULUSAN */}
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

        {/* TAB 2: PENSYARAH AKTIF */}
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
                          <span style={{ fontWeight: '700', color: SUPERADMIN_EMAILS.includes(u.email) ? '#9333ea' : '#2563eb' }}>
                            {SUPERADMIN_EMAILS.includes(u.email) ? '👑 Superadmin' : 'Pensyarah'}
                          </span>
                        </td>
                        <td style={styles.td}><span style={styles.badgeApproved}>Diluluskan</span></td>
                        <td style={styles.td}>
                          {SUPERADMIN_EMAILS.includes(u.email) ? (
                            <span style={styles.kebalLabel}>🔒 Pentadbir Kebal</span>
                          ) : (
                            <div style={styles.actionContainer}>
                              <button style={styles.btnEdit} onClick={() => handleEditUser(u.full_name || u.name)}>Edit</button>
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

        {/* TAB 3: PENGURUSAN KREDIT PENSYARAH */}
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

      </div>

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

      {/* MODAL 2: KEMASKINI KREDIT */}
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
                  Akses Tanpa Had (Unlimited Credit)
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

    </div>
  );
}