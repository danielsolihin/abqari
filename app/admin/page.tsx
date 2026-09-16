'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ENJIN TERAS ASAL (Dikekalkan 100%)
const C_LIST = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const P_LIST = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
const A_LIST = ['A1', 'A2', 'A3', 'A4', 'A5'];
const LO_LIST = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6', 'LO7', 'LO8', 'LO9', 'LO10', 'LO11'];

export default function AdminDashboardPage() {
  // ==========================================
  // STATE: DOKUMEN & SUBJEK (DIKEKALKAN 100%)
  // ==========================================
  const [documents, setDocuments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const [selectedCOs, setSelectedCOs] = useState<string[]>([]);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // ==========================================
  // STATE: PENGURUSAN PENGGUNA (REAL DATABASE)
  // ==========================================
  const [users, setUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Pensyarah');
  const [newUserDept, setNewUserDept] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // ==========================================
  // FUNGSI FETCH DOKUMEN & SUBJEK (DIKEKALKAN)
  // ==========================================
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents');
      const json = await res.json();
      if (json.success) setDocuments(json.data);
    } catch (error) {
      console.error('Ralat mengambil dokumen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      const json = await res.json();
      if (json.success) setSubjects(json.data);
    } catch (error) {
      console.error('Ralat mengambil subjek:', error);
    }
  };

  // FETCH PENGGUNA SEBENAR
  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (error) {
      console.error('Ralat mengambil senarai pengguna:', error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchSubjects();
    fetchUsers(); // Panggil data pengguna bila admin masuk ke halaman ini
  }, []);

  const toggleCO = (itemValue: string) => {
    setSelectedCOs(prev => prev.includes(itemValue) ? prev.filter(item => item !== itemValue) : [...prev, itemValue]);
  };

  const toggleLO = (lo: string) => {
    setSelectedLOs(prev => prev.includes(lo) ? prev.filter(item => item !== lo) : [...prev, lo]);
  };

  const handleEditSubjectClick = () => {
    const sub = subjects.find(s => s.id === selectedSubjectId);
    if (sub) {
      setNewCourseCode(sub.course_code === 'TIADA' ? '' : sub.course_code);
      setNewSubjectName(sub.name);
      setSelectedCOs(sub.co || []);
      setSelectedLOs(sub.lo || []);
      setEditingSubjectId(sub.id);
      setIsCreatingSubject(true);
    }
  };

  const handleSaveSubject = async () => {
    if (!newSubjectName.trim()) return alert('Sila masukkan nama subjek.');
    
    try {
      const method = editingSubjectId ? 'PUT' : 'POST';
      const payload = { 
        id: editingSubjectId, 
        name: newSubjectName, 
        courseCode: newCourseCode,
        co: selectedCOs,
        lo: selectedLOs
      };

      const res = await fetch('/api/subjects', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });
      const json = await res.json();

      if (res.ok && json.success) {
        if (editingSubjectId) {
           setSubjects(subjects.map(s => s.id === editingSubjectId ? json.data : s));
           alert('Maklumat subjek berjaya dikemas kini!');
        } else {
           setSubjects([...subjects, json.data]);
           setSelectedSubjectId(json.data.id);
           alert('Subjek baharu berjaya ditambah!');
        }
        
        setNewSubjectName('');
        setNewCourseCode('');
        setSelectedCOs([]);
        setSelectedLOs([]);
        setIsCreatingSubject(false);
        setEditingSubjectId(null);
      } else {
        alert(`Ralat: ${json.error || 'Gagal.'}`);
      }
    } catch (error) {
      alert('Gagal menyimpan subjek.');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Sila pilih fail PDF.');
    if (!selectedSubjectId) return alert('Sila pilih subjek terlebih dahulu.');

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', selectedSubjectId);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (res.ok && json.success) {
        alert('Bahan kursus berjaya dimuat naik & dianalisis!');
        setIsModalOpen(false);
        setFile(null);
        fetchDocuments(); 
      } else {
        alert(`Ralat Muat Naik: ${json.error || 'Gagal memproses.'}`);
      }
    } catch (error) {
      alert('Berlaku ralat pelayan semasa muat naik.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam dokumen ini?')) return;
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        setDocuments(documents.filter((doc) => doc.id !== id));
        setSelectedDocIds(selectedDocIds.filter(docId => docId !== id)); 
      } else {
        alert(`Ralat: ${json.error || 'Gagal memadam.'}`);
      }
    } catch (error) {
      alert('Berlaku ralat semasa memadam dokumen.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    if (!confirm(`AMARAN: Anda pasti mahu memadam ${selectedDocIds.length} dokumen ini secara serentak?`)) return;

    let successCount = 0;
    for (const id of selectedDocIds) {
      try {
        await fetch('/api/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        successCount++;
      } catch (error) {
        console.error(`Gagal memadam ${id}`);
      }
    }
    
    alert(`${successCount} dokumen berjaya dipadamkan.`);
    setSelectedDocIds([]);
    fetchDocuments(); 
  };

  const getSubjectName = (subjectId: string) => {
    const found = subjects.find((s) => s.id === subjectId);
    return found ? `${found.course_code === 'TIADA' ? '' : found.course_code} ${found.name}`.trim() : 'Tiada Subjek / Rujukan Umum';
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSubject = filterSubjectId ? doc.subject_id === filterSubjectId : true;
    const searchString = searchQuery.toLowerCase();
    const fileName = (doc.file_name || doc.title || doc.id).toLowerCase();
    const matchesSearch = fileName.includes(searchString);
    return matchesSubject && matchesSearch;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedDocIds(filteredDocuments.map(doc => doc.id));
    else setSelectedDocIds([]);
  };

  const handleSelectRow = (id: string) => {
    if (selectedDocIds.includes(id)) setSelectedDocIds(selectedDocIds.filter(docId => docId !== id));
    else setSelectedDocIds([...selectedDocIds, id]);
  };

  // ==========================================
  // FUNGSI: PENGURUSAN PENGGUNA SEBENAR
  // ==========================================
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserDept || !newUserPassword) {
      return alert('Sila lengkapkan semua maklumat pendaftaran pengguna.');
    }
    
    if (newUserPassword.length < 6) {
      return alert('Kata laluan mesti mengandungi sekurang-kurangnya 6 aksara.');
    }

    setIsCreatingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          role: newUserRole.toLowerCase(), // simpan sebagai 'admin' atau 'pensyarah'
          faculty: newUserDept
        })
      });

      const json = await res.json();
      
      if (res.ok && json.success) {
        alert('Alhamdulillah! Pengguna baharu berjaya didaftarkan ke dalam sistem.');
        fetchUsers(); // Refresh senarai pengguna
        setNewUserName(''); setNewUserEmail(''); setNewUserRole('Pensyarah'); setNewUserDept(''); setNewUserPassword('');
        setIsUserModalOpen(false);
      } else {
        alert(`Gagal mendaftar pengguna: ${json.error || 'Emel mungkin telah digunakan.'}`);
      }
    } catch (err) {
      alert('Berlaku masalah penyambungan pelayan semasa mendaftar pengguna.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, role: string) => {
    if (role === 'admin') {
      return alert('AMARAN: Anda tidak boleh memadam akaun rakan Pentadbir (Admin) dari halaman ini untuk mengelakkan risiko terkunci.');
    }

    if (!confirm('Adakah anda pasti mahu memadam akaun pensyarah ini secara KEKAL? Tindakan ini tidak boleh dikembalikan.')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert('Akaun pengguna telah berjaya dipadamkan.');
        fetchUsers(); // Refresh jadual
      } else {
        alert(`Gagal memadam pengguna: ${json.error}`);
      }
    } catch (err) {
      alert('Berlaku masalah penyambungan pelayan.');
    }
  };

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setIsUserProfileModalOpen(true);
  };

  // ==========================================
  // GAYA UI: TEMA ADMIN
  // ==========================================
  const styles = {
    page: { backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative', paddingBottom: '50px' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '260px',
      backgroundColor: '#0f172a',
      backgroundImage: `linear-gradient(135deg, #0f172a, #1e293b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)', borderBottom: '4px solid #ef4444', zIndex: 0
    },
    container: { maxWidth: '1280px', margin: '0 auto', padding: '30px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f8fafc', backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem' },
    
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '25px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: '30px' },
    
    btnPrimary: { backgroundColor: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all 0.2s' },
    btnSuccess: { backgroundColor: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' },
    btnDanger: { backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '700', border: 'none', cursor: 'pointer' },
    
    // Butang kecil untuk Jadual
    btnPrimarySmall: { backgroundColor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' },
    btnDeleteSmall: { backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' },
    
    input: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', outlineColor: '#0f172a', backgroundColor: '#f8fafc' },
    
    table: { width: '100%', borderCollapse: 'collapse' as 'collapse', marginTop: '15px' },
    th: { backgroundColor: '#f1f5f9', color: '#334155', padding: '14px 15px', textAlign: 'left' as 'left', fontSize: '0.85rem', fontWeight: '700', borderBottom: '2px solid #e2e8f0' },
    td: { padding: '14px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#0f172a' },
    
    modalOverlay: { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' as 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
    modalBoxSmall: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' as 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
    modalBoxMini: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' as 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }
  };

  return (
    <div style={styles.page}>
      <div style={styles.banner} />

      <div style={styles.container}>
        
        {/* HEADER BAR KHAS ADMIN */}
        <div style={styles.headerBox}>
          <Link href="/" style={styles.backBtn}>
            ← Ke Papan Pemuka Utama
          </Link>
          <div style={{ textAlign: 'center', color: 'white' }}>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '2rem', fontWeight: '900', color: '#f8fafc' }}>
              Tetapan & Pusat Kawalan Pentadbir 🛡️
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Akses Tahap Tertinggi: Urus Enjin Vektor, Dokumen Bebas, dan Profil Pengguna.</p>
          </div>
          <div style={{ width: '150px' }}></div>
        </div>

        {/* ==========================================
            SEKSYEN 1: PENGURUSAN PENGGUNA SISTEM
            ========================================== */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>👥</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: '800' }}>Pengurusan Pengguna Sistem</h2>
            </div>
            <button style={styles.btnSuccess} onClick={() => setIsUserModalOpen(true)}>
              + Tambah Pengguna Baharu
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {isUsersLoading ? (
               <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Memuat turun data profil pensyarah...</p>
            ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nama Penuh</th>
                  <th style={styles.th}>Emel / ID Staf</th>
                  <th style={styles.th}>Jabatan / Fakulti</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Peranan</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((usr, idx) => (
                  <tr key={usr.id}>
                    <td style={{ fontWeight: '700', color: '#64748b' }}>{`USR-${String(idx + 1).padStart(3, '0')}`}</td>
                    <td style={{ fontWeight: '700', color: '#0f172a' }}>{usr.name}</td>
                    <td style={{ color: '#475569' }}>{usr.email}</td>
                    <td style={{ color: '#475569' }}>{usr.faculty}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800',
                        backgroundColor: usr.role === 'admin' ? '#fee2e2' : '#eff6ff',
                        color: usr.role === 'admin' ? '#b91c1c' : '#1d4ed8',
                        border: usr.role === 'admin' ? '1px solid #fca5a5' : '1px solid #93c5fd'
                      }}>
                        {usr.role === 'admin' ? 'Admin' : 'Pensyarah'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          style={styles.btnPrimarySmall} 
                          onClick={() => handleViewUser(usr)}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                        >
                          👁️ Lihat
                        </button>
                        <button 
                          style={{...styles.btnDeleteSmall, opacity: usr.role === 'admin' ? 0.4 : 1, cursor: usr.role === 'admin' ? 'not-allowed' : 'pointer'}} 
                          onClick={() => handleDeleteUser(usr.id, usr.role)}
                          disabled={usr.role === 'admin'}
                          title={usr.role === 'admin' ? 'Tidak boleh dipadam' : 'Padam Pensyarah'}
                        >
                          Padam
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {/* ==========================================
            SEKSYEN 2: PANGKALAN DATA VEKTOR (MASTER)
            ========================================== */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#fef2f2', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>🗄️</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: '800' }}>Pangkalan Data Vektor (Master)</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedDocIds.length > 0 && (
                <button style={styles.btnDanger} onClick={handleBulkDelete}>
                  Padam Fail ({selectedDocIds.length})
                </button>
              )}
              {/* BUTANG UPLOAD TURBO ASAL */}
              <button style={styles.btnPrimary} onClick={() => setIsModalOpen(true)}>
                + Turbo Upload (Bebas)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" placeholder="🔍 Cari ID Vektor atau Nama Fail..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <select 
                value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)}
                style={styles.input}
              >
                <option value="">📋 Semua Indeks Vektor</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Menyemak pangkalan data Supabase...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                      <input type="checkbox" onChange={handleSelectAll} checked={filteredDocuments.length > 0 && selectedDocIds.length === filteredDocuments.length} />
                    </th>
                    <th style={styles.th}>Data Vektor / Fail PDF</th>
                    <th style={styles.th}>Pemetaan Silabus</th>
                    <th style={styles.th}>Tarikh Dimuat Naik</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Tindakan Pengurusan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} style={{ backgroundColor: selectedDocIds.includes(doc.id) ? '#f1f5f9' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => handleSelectRow(doc.id)} />
                      </td>
                      <td style={{ fontWeight: '600' }}>📄 {doc.file_name || doc.title || `${doc.id.substring(0, 8)}...`}</td>
                      <td>
                        <span style={{ backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                           {getSubjectName(doc.subject_id)}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{new Date(doc.created_at).toLocaleDateString('ms-MY')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button style={styles.btnDeleteSmall} onClick={() => handleDelete(doc.id)}>Padam Force</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          MODAL 1: DAFTAR PENGGUNA BAHARU
          ========================================== */}
      {isUserModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBoxSmall}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>Pendaftaran Pengguna Baharu</h2>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>Nama Penuh <span style={{color: '#ef4444'}}>*</span></label>
                <input type="text" required value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Cth: Dr. Ahmad Baihaqi" style={styles.input} />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>Emel / ID Staf UiTM <span style={{color: '#ef4444'}}>*</span></label>
                <input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Cth: baihaqi@uitm.edu.my" style={styles.input} />
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>Tahap Peranan <span style={{color: '#ef4444'}}>*</span></label>
                  <select required value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={styles.input}>
                    <option value="Pensyarah">Pensyarah (Biasa)</option>
                    <option value="Admin">Pentadbir (Admin)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>Kata Laluan <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="password" required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Minimum 6 Aksara" style={styles.input} />
                </div>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>Jabatan / Fakulti <span style={{color: '#ef4444'}}>*</span></label>
                <input type="text" required value={newUserDept} onChange={e => setNewUserDept(e.target.value)} placeholder="Cth: Fakulti Sains Komputer" style={styles.input} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsUserModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}>Batal</button>
                <button type="submit" disabled={isCreatingUser} style={{...styles.btnSuccess, opacity: isCreatingUser ? 0.7 : 1}}>
                  {isCreatingUser ? 'Mendaftar...' : '💾 Cipta Akaun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: LIHAT PROFIL PENGGUNA (BAHARU)
          ========================================== */}
      {isUserProfileModalOpen && selectedUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBoxMini}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>Profil Pengguna</h2>
              <button onClick={() => setIsUserProfileModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <div style={{ width: '65px', height: '65px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#3b0764', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.8rem', fontWeight: '900', border: '2px solid #e2e8f0' }}>
                   {selectedUser.name.charAt(0)}
                 </div>
                 <div>
                   <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: '800' }}>{selectedUser.name}</h3>
                   <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>ID: {selectedUser.id.substring(0,8)}</p>
                 </div>
              </div>
              
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Emel / ID Staf:</p>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: '500' }}>{selectedUser.email}</p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Jabatan / Fakulti:</p>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: '500' }}>{selectedUser.faculty}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Tahap Peranan Akses:</p>
                  <span style={{ 
                      display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800',
                      backgroundColor: selectedUser.role === 'admin' ? '#fee2e2' : '#eff6ff',
                      color: selectedUser.role === 'admin' ? '#b91c1c' : '#1d4ed8',
                      border: selectedUser.role === 'admin' ? '1px solid #fca5a5' : '1px solid #93c5fd'
                    }}>
                      {selectedUser.role === 'admin' ? '🛡️ Pentadbir (Admin)' : '🎓 Pensyarah Biasa'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                <button onClick={() => setIsUserProfileModalOpen(false)} style={styles.btnPrimary}>Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: TURBO UPLOAD & DAFTAR SUBJEK BEBAS
          ========================================== */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Enjin Muat Naik Bebas (Admin)</h2>
              <button onClick={() => { setIsModalOpen(false); setIsCreatingSubject(false); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleUpload}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>Pilih Subjek & Pemetaan</label>
                
                {!isCreatingSubject ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      style={{ ...styles.input, flex: 1 }}
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                    >
                      <option value="">-- Tiada Subjek / Rujukan Umum --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => { 
                      setNewSubjectName(''); setNewCourseCode(''); setSelectedCOs([]); setSelectedLOs([]); setEditingSubjectId(null); setIsCreatingSubject(true); 
                    }} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                      + Subjek Baharu
                    </button>
                    
                    {selectedSubjectId && (
                      <button type="button" onClick={handleEditSubjectClick} style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', padding: '10px 15px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.95rem' }}>{editingSubjectId ? 'Kemas Kini Maklumat' : 'Cipta Kategori/Subjek Bebas'}</h4>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <input type="text" style={{ ...styles.input, width: '35%' }} placeholder="Kod (Cth: UMUM)" value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} />
                      <input type="text" style={{ ...styles.input, flex: 1 }} placeholder="Nama Subjek / Kategori" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                    </div>
                    
                    <div style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '6px', backgroundColor: '#fff', maxHeight: '200px', overflowY: 'auto' }}>
                      <p style={{ margin: '0 0 10px 0', fontWeight: '700', fontSize: '0.85rem' }}>Pilih Course Outcomes (C, P, A):</p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {C_LIST.map(c => (
                          <label key={c} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(c)} onChange={() => toggleCO(c)} /> {c}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {P_LIST.map(p => (
                          <label key={p} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(p)} onChange={() => toggleCO(p)} /> {p}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {A_LIST.map(a => (
                          <label key={a} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(a)} onChange={() => toggleCO(a)} /> {a}
                          </label>
                        ))}
                      </div>
                      
                      <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '15px 0' }} />

                      <p style={{ margin: '0 0 10px 0', fontWeight: '700', fontSize: '0.85rem' }}>Pilih MQF 2.0 (LO):</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {LO_LIST.map(lo => (
                          <label key={lo} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedLOs.includes(lo)} onChange={() => toggleLO(lo)} /> {lo}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                      <button type="button" onClick={() => { setIsCreatingSubject(false); setEditingSubjectId(null); }} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '8px 15px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Batal</button>
                      <button type="button" onClick={handleSaveSubject} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>💾 Simpan</button>
                    </div>
                  </div>
                )}
              </div>

              {!isCreatingSubject && (
                <>
                  <div style={{ border: '2px dashed #94a3b8', padding: '30px 20px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: '#0f172a', fontWeight: '700' }}>Fail PDF:</label>
                    <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ margin: '0 auto', display: 'block', cursor: 'pointer' }} />
                  </div>
                  
                  <button type="submit" disabled={isUploading} style={{ width: '100%', backgroundColor: isUploading ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                    {isUploading ? 'Menghantar ke Vektor...' : 'Force Upload & Analisis AI'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}