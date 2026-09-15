'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client untuk profil dinamik
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ENJIN TERAS: Senarai Rujukan & Penerangan Domain C, P, A dan LO (MQF 2.0)
const C_MAP = [
  { id: 'C1', label: 'C1 - Mengingat (Remembering)' },
  { id: 'C2', label: 'C2 - Memahami (Understanding)' },
  { id: 'C3', label: 'C3 - Mengaplikasi (Applying)' },
  { id: 'C4', label: 'C4 - Menganalisis (Analyzing)' },
  { id: 'C5', label: 'C5 - Menilai (Evaluating)' },
  { id: 'C6', label: 'C6 - Mencipta (Creating)' },
];

const P_MAP = [
  { id: 'P1', label: 'P1 - Persepsi' },
  { id: 'P2', label: 'P2 - Set' },
  { id: 'P3', label: 'P3 - Respons Terbimbing' },
  { id: 'P4', label: 'P4 - Mekanisme' },
  { id: 'P5', label: 'P5 - Respons Ketara Kompleks' },
  { id: 'P6', label: 'P6 - Adaptasi' },
  { id: 'P7', label: 'P7 - Penjelmaan' },
];

const A_MAP = [
  { id: 'A1', label: 'A1 - Menerima' },
  { id: 'A2', label: 'A2 - Merespons' },
  { id: 'A3', label: 'A3 - Menilai' },
  { id: 'A4', label: 'A4 - Mengorganisasi' },
  { id: 'A5', label: 'A5 - Menghayati Nilai' },
];

const LO_MAP = [
  { id: 'LO1', label: 'LO1 - Pengetahuan & Kefahaman' },
  { id: 'LO2', label: 'LO2 - Kemahiran Kognitif' },
  { id: 'LO3', label: 'LO3 - Kemahiran Kerja Praktikal' },
  { id: 'LO4', label: 'LO4 - Kemahiran Interpersonal' },
  { id: 'LO5', label: 'LO5 - Kemahiran Komunikasi' },
  { id: 'LO6', label: 'LO6 - Kemahiran Digital' },
  { id: 'LO7', label: 'LO7 - Kemahiran Numerasi' },
  { id: 'LO8', label: 'LO8 - Kepimpinan, Autonomi & Tanggungjawab' },
  { id: 'LO9', label: 'LO9 - Kemahiran Personal (Pembelajaran Berterusan)' },
  { id: 'LO10', label: 'LO10 - Kemahiran Keusahawanan' },
  { id: 'LO11', label: 'LO11 - Etika & Profesionalisme' },
];

// FUNGSI PINTAR: Memastikan susunan sentiasa "KOD - NAMA" secara sekata
const formatSubjectDisplay = (code: string, name: string) => {
  let c = code && code !== 'TIADA' ? code.trim() : '';
  let n = name ? name.trim() : '';

  // Jika user terbalik letak "Nama - Kod" di dalam ruang Nama Kursus semasa mendaftar
  if (!c && n.includes(' - ')) {
    const parts = n.split(' - ');
    const lastPart = parts[parts.length - 1].trim();
    // Mengesan jika bahagian belakang kelihatan seperti kod (cth: ISH151)
    if (/^[a-zA-Z]{2,4}\d{3,4}$/.test(lastPart)) {
      c = lastPart.toUpperCase();
      n = parts.slice(0, -1).join(' - ').trim();
    }
  }

  if (c) {
    // Memastikan kod tidak berulang jika ia sudah ditulis di dalam nama
    const cleanName = n.replace(new RegExp(`^${c}\\s*[-:]*\\s*`, 'i'), '');
    return `${c} - ${cleanName}`;
  }
  return n;
};

export default function PengurusanKursusPage() {
  const router = useRouter();

  // State Profil Pengguna Dinamik Supabase
  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
  }>({
    name: 'Pengguna ABQARI',
    faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
  });

  // STATE ASAL ENGINE (DIKEKALKAN 100%)
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [selectedCOs, setSelectedCOs] = useState<string[]>([]);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // Pengambilan Profil Pengguna Dinamik (Supabase Auth / LocalStorage)
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          setUserProfile({
            name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Pengguna ABQARI',
            faculty: meta.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
          });
        } else if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setUserProfile({
              name: parsed.name || 'Pengguna ABQARI',
              faculty: parsed.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
            });
          } catch (e) {}
        }
      } catch (err) {
        console.error('Ralat mengambil profil pengguna:', err);
      }
    };

    fetchUserProfile();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      const json = await res.json();
      if (json.success) setSubjects(json.data);
    } catch (error) {
      console.error('Ralat mengambil subjek:', error);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const toggleCO = (itemValue: string) => {
    setSelectedCOs(prev => prev.includes(itemValue) ? prev.filter(item => item !== itemValue) : [...prev, itemValue]);
  };

  const toggleLO = (lo: string) => {
    setSelectedLOs(prev => prev.includes(lo) ? prev.filter(item => item !== lo) : [...prev, lo]);
  };

  const handleSelectSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    const sub = subjects.find(s => s.id === id);
    if (sub) {
      setNewCourseCode(sub.course_code === 'TIADA' ? '' : sub.course_code);
      setNewSubjectName(sub.name);
      setSelectedCOs(sub.co || []);
      setSelectedLOs(sub.lo || []);
      setEditingSubjectId(sub.id);
    } else {
      handleCancel();
    }
  };

  // FUNGSI BATAL
  const handleCancel = () => {
    setSelectedSubjectId('');
    setNewCourseCode('');
    setNewSubjectName('');
    setSelectedCOs([]);
    setSelectedLOs([]);
    setEditingSubjectId(null);
  };

  // FUNGSI SIMPAN
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
        } else {
           setSubjects([...subjects, json.data]);
           setSelectedSubjectId(json.data.id);
        }
        
        if (confirm('Maklumat subjek berjaya disimpan! Adakah anda mahu terus ke Pusat Sumber untuk muat naik dokumen PDF bagi subjek ini?')) {
          router.push(`/sumber?subjectId=${json.data.id}`);
        }
      } else {
        alert(`Ralat: ${json.error || 'Gagal.'}`);
      }
    } catch (error) {
      alert('Gagal menyimpan subjek.');
    }
  };

  // FUNGSI PADAM SUBJEK
  const handleDeleteSubject = async () => {
    if (!editingSubjectId) return;
    
    if (!confirm('AMARAN: Adakah anda pasti mahu memadam subjek ini beserta tetapan pemetaannya?\n\nTindakan ini tidak boleh dipulihkan.')) return;

    try {
      const res = await fetch('/api/subjects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingSubjectId }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setSubjects(subjects.filter(s => s.id !== editingSubjectId));
        alert('Subjek berjaya dipadamkan.');
        handleCancel();
      } else {
        alert(`Ralat: ${json.error || 'Gagal memadam subjek.'}`);
      }
    } catch (error) {
      alert('Berlaku ralat pelayan semasa memadam subjek.');
    }
  };

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '260px',
      backgroundColor: '#3b0764',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)', borderBottom: '4px solid #fde047', zIndex: 0
    },
    container: { maxWidth: '1280px', margin: '0 auto', padding: '30px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#3b0764', backgroundColor: '#fde047', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    
    gridContainer: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: '25px', alignItems: 'start' },
    card: { backgroundColor: 'white', borderRadius: '16px', padding: '25px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' },
    cardHeader: { color: '#0f172a', fontSize: '1.1rem', fontWeight: '800', marginBottom: '18px', textTransform: 'uppercase' as 'uppercase', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' },
    
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' },
    select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#f8fafc' },
    
    sectionTitle: { fontSize: '0.88rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
    checkboxGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' },
    checkboxItem: (isChecked: boolean) => ({
      padding: '10px 12px', borderRadius: '8px', border: isChecked ? '1px solid #3b0764' : '1px solid #e2e8f0',
      backgroundColor: isChecked ? '#f3e8ff' : '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '0.8rem', fontWeight: isChecked ? '700' : '500', color: isChecked ? '#3b0764' : '#475569', transition: 'all 0.15s'
    }),
    
    // GAYA ITEM SENARAI SUBJEK BAHARU
    subjectCardItem: (isSelected: boolean) => ({
      padding: '10px 12px',
      borderRadius: '8px',
      border: isSelected ? '2px solid #3b0764' : '1px solid #e2e8f0',
      backgroundColor: isSelected ? '#f3e8ff' : '#ffffff',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }),

    btnSave: { backgroundColor: '#3b0764', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(59,7,100,0.2)' },
    btnCancel: { backgroundColor: 'white', color: '#475569', padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' },
    btnDelete: { backgroundColor: '#fee2e2', color: '#ef4444', padding: '12px 20px', borderRadius: '8px', border: '1px solid #f87171', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }
  };

  return (
    <div style={styles.page}>
      <div style={styles.banner} />

      <div style={styles.container}>
        
        {/* HEADER BAR */}
        <div style={styles.headerBox}>
          <Link href="/" style={styles.backBtn}>
            ← Kembali ke Papan Pemuka
          </Link>
          <div style={{ textAlign: 'center', color: 'white' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Pengurusan Kursus & OBE</h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#e2e8f0' }}>Tetapan Kod Subjek, Domain Taksonomi & Pemetaan MQF 2.0</p>
          </div>

          {/* PAPARAN PROFIL PENGGUNA DINAMIK */}
          <div style={{ color: 'white', textAlign: 'right', fontSize: '0.8rem' }}>
            <strong style={{ fontSize: '0.95rem', display: 'block' }}>{userProfile.name}</strong>
            <span style={{ opacity: 0.8 }}>{userProfile.faculty}</span>
          </div>
        </div>

        {/* 2 LAJUR REKA BENTUK PENGURUSAN */}
        <div style={styles.gridContainer}>

          {/* LAJUR KIRI: DIPECAHKAN KEPADA DUA KOTAK BERASINGAN (FLEX COLUMN) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* KOTAK 1: SELEKSI & PENDAFTARAN SUBJEK */}
            <div style={styles.card}>
              <h3 style={styles.cardHeader}>1. SUBJEK & PENETAPAN</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Pilih Subjek Berdaftar:</label>
                <select
                  style={styles.select}
                  value={selectedSubjectId}
                  onChange={(e) => handleSelectSubjectChange(e.target.value)}
                >
                  <option value="">-- + Tambah Subjek Baharu --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSubjectDisplay(s.course_code, s.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '15px', marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f172a' }}>
                  {editingSubjectId ? '✏️ Kemas Kini Subjek' : '➕ Daftar Subjek Baharu'}
                </h4>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>Kod Kursus:</label>
                  <input type="text" style={styles.input} placeholder="Contoh: CTU552" value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>Nama Kursus Penuh:</label>
                  <input type="text" style={styles.input} placeholder="Contoh: Falsafah dan Isu Semasa" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
                </div>
              </div>

              {/* TIP DIKEKALKAN DI DALAM KOTAK 1 SEPERTI DIMINTA */}
              <div style={{ backgroundColor: '#eff6ff', padding: '12px 15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', fontSize: '0.8rem', color: '#1e40af' }}>
                <strong>💡 Langkah Seterusnya:</strong><br />
                Sila lengkapkan pemetaan Domain di kotak sebelah kanan, kemudian tekan butang <strong>Simpan</strong> di bahagian bawah.
              </div>
            </div>

            {/* KOTAK BAHARU TERASING: SENARAI SUBJEK BERDAFTAR */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: '800', textTransform: 'uppercase' }}>
                  📚 SENARAI SUBJEK ({subjects.length})
                </h3>
                <button 
                  type="button" 
                  onClick={handleCancel}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  + Baharu
                </button>
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {subjects.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: '15px 0' }}>
                    Tiada subjek berdaftar lagi.
                  </p>
                ) : (
                  subjects.map((sub) => {
                    const isSelected = selectedSubjectId === sub.id;
                    return (
                      <div 
                        key={sub.id} 
                        onClick={() => handleSelectSubjectChange(sub.id)}
                        style={styles.subjectCardItem(isSelected)}
                      >
                        <div>
                          <strong style={{ color: isSelected ? '#3b0764' : '#0f172a', fontSize: '0.85rem', display: 'block' }}>
                            {formatSubjectDisplay(sub.course_code, sub.name)}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {sub.co ? `${sub.co.length} Domain` : '0 Domain'} | {sub.lo ? `${sub.lo.length} LO` : '0 LO'}
                          </span>
                        </div>
                        {isSelected && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#3b0764', backgroundColor: '#e9d5ff', padding: '2px 6px', borderRadius: '4px' }}>✓ Aktif</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* LAJUR KANAN: PEMETAAN TERPERINCI C, P, A & LO (MQF 2.0) */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>2. PEMETAAN DOMAIN HASIL PEMBELAJARAN (OBE)</h3>

            {/* DOMAIN KOGNITIF (C) */}
            <div style={styles.sectionTitle}>
              <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Domain C</span>
              Domain Kognitif (Cognitive Taxonomy)
            </div>
            <div style={styles.checkboxGrid}>
              {C_MAP.map(c => (
                <div key={c.id} style={styles.checkboxItem(selectedCOs.includes(c.id))} onClick={() => toggleCO(c.id)}>
                  <input type="checkbox" checked={selectedCOs.includes(c.id)} readOnly style={{ cursor: 'pointer' }} />
                  <span>{c.label}</span>
                </div>
              ))}
            </div>

            {/* DOMAIN PSIKOMOTOR (P) */}
            <div style={styles.sectionTitle}>
              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Domain P</span>
              Domain Psikomotor (Psychomotor Taxonomy)
            </div>
            <div style={styles.checkboxGrid}>
              {P_MAP.map(p => (
                <div key={p.id} style={styles.checkboxItem(selectedCOs.includes(p.id))} onClick={() => toggleCO(p.id)}>
                  <input type="checkbox" checked={selectedCOs.includes(p.id)} readOnly style={{ cursor: 'pointer' }} />
                  <span>{p.label}</span>
                </div>
              ))}
            </div>

            {/* DOMAIN AFEKTIF (A) */}
            <div style={styles.sectionTitle}>
              <span style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Domain A</span>
              Domain Afektif (Affective Taxonomy)
            </div>
            <div style={styles.checkboxGrid}>
              {A_MAP.map(a => (
                <div key={a.id} style={styles.checkboxItem(selectedCOs.includes(a.id))} onClick={() => toggleCO(a.id)}>
                  <input type="checkbox" checked={selectedCOs.includes(a.id)} readOnly style={{ cursor: 'pointer' }} />
                  <span>{a.label}</span>
                </div>
              ))}
            </div>

            <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '20px 0' }} />

            {/* HASIL PEMBELAJARAN PROGRAM / MQF 2.0 (LO) */}
            <div style={styles.sectionTitle}>
              <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>MQF 2.0</span>
              Hasil Pembelajaran Program (Learning Outcomes - LO)
            </div>
            <div style={styles.checkboxGrid}>
              {LO_MAP.map(lo => (
                <div key={lo.id} style={styles.checkboxItem(selectedLOs.includes(lo.id))} onClick={() => toggleLO(lo.id)}>
                  <input type="checkbox" checked={selectedLOs.includes(lo.id)} readOnly style={{ cursor: 'pointer' }} />
                  <span>{lo.label}</span>
                </div>
              ))}
            </div>

            {/* ACTION BAR: PADAM, BATAL & SIMPAN */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '35px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
              
              <div>
                {editingSubjectId && (
                  <button 
                    type="button" 
                    onClick={handleDeleteSubject}
                    style={styles.btnDelete}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }}
                  >
                    🗑️ Padam Subjek
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  type="button" 
                  onClick={handleCancel}
                  style={styles.btnCancel}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  Batal
                </button>
                
                <button 
                  type="button" 
                  onClick={handleSaveSubject}
                  style={styles.btnSave}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  💾 Simpan Maklumat Subjek
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}