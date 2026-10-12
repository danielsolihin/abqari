'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// FUNGSI HELPER UNTUK FORMAT TARIKH KE DATETIME-LOCAL (WAKTU TEMPATAN)
const formatDateLocal = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function PengurusanUjianPensyarah() {
  const router = useRouter();
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // DATA UJIAN & SESI PELAJAR
  const [myTests, setMyTests] = useState<any[]>([]);
  const [mySessions, setMySessions] = useState<any[]>([]);
  
  // DATA SEMESTER (Hanya untuk paparan filter)
  const [managedSemesters, setManagedSemesters] = useState<any[]>([]);

  // SARINGAN (FILTERS)
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourseCode, setFilterCourseCode] = useState('');
  const [filterGroup, setFilterGroup] = useState(''); 
  const [filterFaculty, setFilterFaculty] = useState(''); 

  // STATE UNTUK PILIH & PADAM PUKAL (BULK DELETE)
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  // MODAL EDIT UJIAN (DENGAN FUNGSI AKTIFKAN SEMULA / UBAH MASA)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editTestName, setEditTestName] = useState('');
  const [editStartTime, setEditStartTime] = useState(''); // STATE MASA MULA
  const [editEndTime, setEditEndTime] = useState('');     // STATE MASA TAMAT
  const [isSaving, setIsSaving] = useState(false);

  // MODAL CETAK MARKAH
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [printSessions, setPrintSessions] = useState<any[]>([]);

  useEffect(() => {
    checkUserAccessAndFetchData();
  }, []);

  const checkUserAccessAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const userName = user.user_metadata?.full_name || user.user_metadata?.name || 'Pensyarah';
      setUserProfile({ name: userName, email: user.email, id: user.id });
      
      // Ambil ujian HANYA untuk pensyarah ini (user_id)
      const { data: testsData } = await supabase.from('online_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (testsData) {
        setMyTests(testsData);
        
        // Ambil sesi pelajar yang berkaitan dengan ujian pensyarah ini sahaja
        if (testsData.length > 0) {
          const testIds = testsData.map(t => t.id);
          const { data: sessionsData } = await supabase.from('test_sessions').select('*').in('test_id', testIds);
          if (sessionsData) setMySessions(sessionsData);
        }
      }

      // Ambil senarai semester dari database
      const { data: semsData } = await supabase.from('semesters').select('*').order('created_at', { ascending: true });
      if (semsData) setManagedSemesters(semsData);

    } catch (err) {
      console.error("Ralat memuatkan data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNGSI EDIT & AKTIFKAN SEMULA UJIAN ---
  const openEditModal = (test: any) => {
    setEditingTest(test);
    setEditCourseCode(test.course_code || '');
    setEditSemester(test.semester || '');
    setEditTestName(test.test_name || '');
    setEditStartTime(formatDateLocal(test.start_time));
    setEditEndTime(formatDateLocal(test.end_time));
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    setIsSaving(true);
    
    try {
      const newStartISO = new Date(editStartTime).toISOString();
      const newEndISO = new Date(editEndTime).toISOString();

      const { error } = await supabase
        .from('online_tests')
        .update({ 
          course_code: editCourseCode, 
          semester: editSemester,
          test_name: editTestName,
          start_time: newStartISO,
          end_time: newEndISO
        })
        .eq('id', editingTest.id);

      if (error) throw error;

      setMyTests(prev => prev.map(t => t.id === editingTest.id ? { 
        ...t, 
        course_code: editCourseCode, 
        semester: editSemester, 
        test_name: editTestName,
        start_time: newStartISO,
        end_time: newEndISO
      } : t));
      
      setShowEditModal(false);
      alert('✅ Maklumat dan tempoh ujian berjaya dikemas kini!');
    } catch (error: any) {
      alert(`Gagal menyimpan: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- FUNGSI PADAM UJIAN (INDIVIDU & PUKAL) ---
  const handleDeleteTest = async (testId: string, testName: string) => {
    if (!window.confirm(`Adakah anda pasti mahu memadam ujian "${testName}" secara kekal?\nSemua rekod jawapan dan markah pelajar untuk ujian ini juga akan terhapus.`)) return;
    
    try {
      const { error } = await supabase.from('online_tests').delete().eq('id', testId);
      if (error) throw error;
      setMyTests(prev => prev.filter(t => t.id !== testId));
      setSelectedTestIds(prev => prev.filter(id => id !== testId));
      alert('🗑️ Ujian dan rekod pelajar berkaitan telah dihapuskan.');
    } catch (error: any) {
      alert(`Gagal memadam: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTestIds.length === 0) return;
    if (!window.confirm(`Adakah anda pasti mahu memadam ${selectedTestIds.length} ujian yang dipilih secara kekal?\nSemua rekod jawapan dan markah pelajar untuk ujian-ujian ini juga akan terhapus.`)) return;
    
    try {
      const { error } = await supabase.from('online_tests').delete().in('id', selectedTestIds);
      if (error) throw error;
      
      setMyTests(prev => prev.filter(t => !selectedTestIds.includes(t.id)));
      setSelectedTestIds([]);
      alert(`🗑️ ${selectedTestIds.length} ujian berjaya dihapuskan secara pukal.`);
    } catch (error: any) {
      alert(`Gagal memadam: ${error.message}`);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>, currentList: any[]) => {
    if (e.target.checked) setSelectedTestIds(currentList.map(t => t.id));
    else setSelectedTestIds([]);
  };

  const handleSelectRow = (id: string) => {
    if (selectedTestIds.includes(id)) setSelectedTestIds(selectedTestIds.filter(testId => testId !== id));
    else setSelectedTestIds([...selectedTestIds, id]);
  };

  // --- FUNGSI CETAK MARKAH / LAPORAN ---
  const openPrintModal = (test: any) => {
    const relatedSessions = mySessions.filter(s => s.test_id === test.id);
    setPrintData(test);
    setPrintSessions(relatedSessions);
    setShowPrintModal(true);
  };

  const executePrint = () => {
    window.print();
  };

  // --- PEMPROSESAN PAPARAN ---
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Memuatkan Pengurusan Ujian...</div>;

  const uniqueCourseCodes = Array.from(new Set(myTests.map(t => t.course_code).filter(Boolean)));
  const combinedSemesters = Array.from(new Set([...myTests.map(t => t.semester), ...managedSemesters.map(s => s.name)].filter(Boolean)));
  const uniqueGroups = Array.from(new Set(myTests.map(t => t.group_name).filter(Boolean)));
  const uniqueFaculties = Array.from(new Set(myTests.map(t => t.faculty).filter(Boolean)));

  const filteredTests = myTests.filter(t => {
    const matchSemester = filterSemester ? t.semester === filterSemester : true;
    const matchCourse = filterCourseCode ? t.course_code === filterCourseCode : true;
    const matchGroup = filterGroup ? t.group_name === filterGroup : true;
    const matchFaculty = filterFaculty ? t.faculty === filterFaculty : true;
    return matchSemester && matchCourse && matchGroup && matchFaculty;
  });

  const totalOngoingSessions = mySessions.filter(s => s.status === 'ongoing').length;
  const totalCompletedSessions = mySessions.filter(s => s.status === 'completed' || s.status === 'terminated').length;

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: '60px' },
    banner: { height: '220px', background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', color: 'white', padding: '35px 20px', borderBottom: '4px solid #818cf8' },
    container: { maxWidth: '1400px', margin: '-50px auto 0 auto', padding: '0 20px', position: 'relative' as const, zIndex: 10 },
    card: { backgroundColor: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', marginBottom: '25px', border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.88rem' },
    
    th: { textAlign: 'left' as const, padding: '14px 12px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' as const },
    td: { padding: '14px 12px', borderBottom: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' as const },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outlineColor: '#4f46e5', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const, fontWeight: '400' },
    
    btnPrimary: { backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '0.8rem' },
    btnSecondary: { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'none' },
    btnDanger: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '0.8rem' },
    
    modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  };

  return (
    <div style={styles.page}>
      
      {/* HEADER BANNER */}
      <div style={styles.banner} className="no-print">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '15px' }}>
            <Link href="/" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}>
              ← Kembali ke Papan Pemuka Utama
            </Link>
          </div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '2.2rem', fontWeight: '800', color: '#ffffff' }}>
            📝 Pengurusan Ujian Online
          </h1>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '400' }}>
            Pusat kawalan bagi memantau, mengurus, mengaktifkan semula ujian dan mencetak markah.
          </p>
        </div>
      </div>

      <div style={styles.container} className="no-print">
        
        {/* STATISTIK UJIAN PENSYARAH */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
          <div style={{ ...styles.card, borderLeft: '4px solid #4f46e5', marginBottom: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>JUMLAH UJIAN ANDA</div>
            <div style={{ fontSize: '2rem', color: '#0f172a', fontWeight: '800' }}>{myTests.length}</div>
          </div>
          <div style={{ ...styles.card, borderLeft: '4px solid #eab308', marginBottom: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>PELAJAR SEDANG MENJAWAB</div>
            <div style={{ fontSize: '2rem', color: '#eab308', fontWeight: '800' }}>{totalOngoingSessions} <span style={{ fontSize: '0.9rem', fontWeight: '400' }}>calon live</span></div>
          </div>
          <div style={{ ...styles.card, borderLeft: '4px solid #10b981', marginBottom: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>UJIAN SELESAI / TAMAT</div>
            <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: '800' }}>{totalCompletedSessions} <span style={{ fontSize: '0.9rem', fontWeight: '400' }}>rekod pelajar</span></div>
          </div>
        </div>

        {/* KAWALAN & SARINGAN UJIAN */}
        <div style={{ ...styles.card, borderTop: '5px solid #4f46e5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: '600' }}>
              <span>🔍</span> Senarai Ujian Anda
            </h3>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedTestIds.length > 0 && (
                <button onClick={handleBulkDelete} style={{ ...styles.btnDanger, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  🗑️ Padam Dipilih ({selectedTestIds.length})
                </button>
              )}
              <Link href="/penjana" style={{ ...styles.btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}>
                + Cipta Ujian Baharu
              </Link>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Saring Mengikut Semester:</label>
              <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={styles.input}>
                <option value="">Semua Semester</option>
                {combinedSemesters.map((sem, i) => <option key={i} value={sem as string}>{sem as string}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Saring Mengikut Kod Kursus:</label>
              <select value={filterCourseCode} onChange={(e) => setFilterCourseCode(e.target.value)} style={styles.input}>
                <option value="">Semua Kod Kursus</option>
                {uniqueCourseCodes.map((code, i) => <option key={i} value={code as string}>{code as string}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Saring Mengikut Kumpulan:</label>
              <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} style={styles.input}>
                <option value="">Semua Kumpulan</option>
                {uniqueGroups.map((grp, i) => <option key={i} value={grp as string}>{grp as string}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Saring Fakulti / Program Pengajian:</label>
              <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} style={styles.input}>
                <option value="">Semua Fakulti / Program</option>
                {uniqueFaculties.map((fac, i) => <option key={i} value={fac as string}>{fac as string}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{...styles.th, width: '40px', textAlign: 'center'}}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => handleSelectAll(e, filteredTests)} 
                      checked={filteredTests.length > 0 && selectedTestIds.length === filteredTests.length} 
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </th>
                  <th style={{...styles.th, width: '40px'}}>Bil.</th>
                  <th style={{...styles.th, minWidth: '90px'}}>Kod Kursus</th>
                  <th style={{...styles.th, minWidth: '220px'}}>Nama Ujian & Program</th>
                  <th style={{...styles.th, minWidth: '120px', textAlign: 'center'}}>Statistik Pelajar</th>
                  <th style={{...styles.th, textAlign: 'center', minWidth: '280px'}}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.length > 0 ? filteredTests.map((test, index) => {
                  const testSessions = mySessions.filter(s => s.test_id === test.id);
                  const completedCount = testSessions.filter(s => s.status === 'completed' || s.status === 'terminated').length;
                  const isSelected = selectedTestIds.includes(test.id);
                  
                  // SEMAK STATUS UJIAN (AKTIF / TAMAT TEMPOH)
                  const now = new Date();
                  const endTime = test.end_time ? new Date(test.end_time) : new Date();
                  const isExpired = test.end_time && endTime < now;
                  
                  return (
                    <tr key={test.id} style={{ transition: 'background-color 0.2s', backgroundColor: isSelected ? '#f8fafc' : 'transparent' }} onMouseOver={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }} onMouseOut={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleSelectRow(test.id)} 
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={{ ...styles.td, color: '#64748b' }}>{index + 1}.</td>
                      <td style={{ ...styles.td, fontWeight: '600', color: '#4f46e5' }}>{test.course_code || 'UMUM'}</td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '500', color: '#0f172a' }}>{test.test_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Sem: {test.semester || 'N/A'} | Kump: {test.group_name || '-'}</div>
                        <div style={{ marginTop: '6px' }}>
                          {isExpired ? (
                            <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>🔴 Tamat Tempoh</span>
                          ) : (
                            <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>🟢 Aktif (Buka)</span>
                          )}
                        </div>
                      </td>
                      <td style={{...styles.td, textAlign: 'center'}}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {testSessions.length} Daftar
                          </span>
                          {completedCount > 0 && (
                            <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 'bold' }}>{completedCount} Selesai</span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => openEditModal(test)} style={{ ...styles.btnSecondary, backgroundColor: '#f59e0b', color: 'white' }}>
                            ✏️ Edit / Aktifkan
                          </button>
                          
                          <Link href={`/keputusan?testId=${test.id}`} style={{ ...styles.btnSecondary, backgroundColor: '#3b82f6' }}>
                            👀 Semak
                          </Link>
                          
                          <button onClick={() => openPrintModal(test)} style={{ ...styles.btnSecondary, backgroundColor: '#8b5cf6' }}>
                            🖨️ Cetak
                          </button>
                          
                          <button onClick={() => handleDeleteTest(test.id, test.test_name)} style={styles.btnDanger}>
                            🗑️ Padam
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Tiada ujian ditemui setakat ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================
          MODAL SUNTINGAN UJIAN (AKTIFKAN SEMULA)
      ========================================================= */}
      {showEditModal && editingTest && (
        <div style={styles.modalOverlay} className="no-print">
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>
                ✏️ Kemas Kini & Aktifkan Ujian
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              
              <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#334155', fontWeight: '600' }}>⏱️ Tetapan Masa Ujian</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Tarikh & Masa Dibuka</label>
                    <input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} style={styles.input} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Tarikh & Masa Ditutup</label>
                    <input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} style={styles.input} required />
                  </div>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                  * Untuk mengaktifkan semula ujian yang telah tamat tempoh, sila ubah <strong>Masa Ditutup</strong> ke suatu tarikh dan masa di hadapan.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Nama Ujian / Penilaian</label>
                <input type="text" value={editTestName} onChange={(e) => setEditTestName(e.target.value)} style={styles.input} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Kod Kursus</label>
                  <input type="text" value={editCourseCode} onChange={(e) => setEditCourseCode(e.target.value)} style={styles.input} required />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Semester / Sesi</label>
                  <select value={editSemester} onChange={(e) => setEditSemester(e.target.value)} style={styles.input}>
                    <option value="">Pilih Semester</option>
                    {combinedSemesters.map((sem, i) => <option key={i} value={sem as string}>{sem as string}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', color: '#475569', fontSize: '0.8rem' }}>Batal</button>
                <button type="submit" disabled={isSaving} style={{...styles.btnPrimary, backgroundColor: '#10b981'}}>
                  {isSaving ? '⏳ Menyimpan...' : '💾 Simpan & Aktifkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL PAPARAN CETAKAN (PRINT PREVIEW)
      ========================================================= */}
      {showPrintModal && printData && (
        <div style={{ ...styles.modalOverlay, backgroundColor: 'white', alignItems: 'flex-start', padding: 0, overflowY: 'auto' }} className="print-modal-container">
          
          <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', backgroundColor: '#0f172a', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>🖨️ Pratonton Cetakan Laporan Markah</h2>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setShowPrintModal(false)} style={{ backgroundColor: '#475569', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Kembali</button>
              <button onClick={executePrint} style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}>Mula Mencetak (PDF/Kertas)</button>
            </div>
          </div>

          <div className="printable-area" style={{ backgroundColor: 'white', padding: '40px', width: '100%', maxWidth: '900px', margin: '0 auto', color: 'black' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid black', paddingBottom: '20px' }}>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', textTransform: 'uppercase', fontWeight: 'bold' }}>UNIVERSITI TEKNOLOGI MARA</h1>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: '600' }}>LAPORAN KEPUTUSAN UJIAN DALAM TALIAN (ABQARI)</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', marginBottom: '30px', fontSize: '0.95rem' }}>
              <strong>Nama Ujian:</strong> <span>{printData.test_name}</span>
              <strong>Kod Kursus:</strong> <span>{printData.course_code || 'UMUM'}</span>
              <strong>Fakulti/Program:</strong> <span>{printData.faculty || '-'}</span>
              <strong>Kumpulan:</strong> <span>{printData.group_name || '-'} / {printData.semester}</span>
              <strong>Nama Pensyarah:</strong> <span>{printData.lecturer_name}</span>
              <strong>Tarikh Cetakan:</strong> <span>{new Date().toLocaleDateString('ms-MY')}</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '50px' }}>Bil.</th>
                  <th style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '150px' }}>No. Matrik</th>
                  <th style={{ border: '1px solid black', padding: '10px', textAlign: 'left' }}>Nama Calon</th>
                  <th style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '120px' }}>Status Sesi</th>
                  <th style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '100px' }}>Markah / Gred</th>
                </tr>
              </thead>
              <tbody>
                {printSessions.length > 0 ? (
                  printSessions.map((session, index) => {
                    const statusSesi = session.status === 'completed' ? 'Selesai' : session.status === 'terminated' ? 'Dibatalkan' : 'Menjawab';
                    const markahPaparan = session.score != null ? `${session.score} / 100` : (session.status === 'ongoing' ? '-' : 'Semakan Manual');
                    
                    return (
                      <tr key={session.id}>
                        <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{index + 1}.</td>
                        <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: '600' }}>{session.student_matric}</td>
                        <td style={{ border: '1px solid black', padding: '8px' }}>{session.student_name}</td>
                        <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{statusSesi}</td>
                        <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: '600' }}>{markahPaparan}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ border: '1px solid black', padding: '20px', textAlign: 'center' }}>Tiada calon yang mengambil ujian ini setakat ini.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <div>
                <p>Disediakan Oleh:</p>
                <br /><br />
                <p>_____________________________________</p>
                <p><strong>{userProfile?.name}</strong></p>
                <p>Pensyarah Kursus</p>
              </div>
              <div>
                <p>Disahkan Oleh:</p>
                <br /><br />
                <p>_____________________________________</p>
                <p>Cop Rasmi Jabatan / Fakulti</p>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* GAYA CSS KHAS UNTUK CETAKAN */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; }
          .print-modal-container { position: absolute; background: white; overflow: visible; }
        }
      `}</style>
    </div>
  );
}