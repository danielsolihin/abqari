'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client untuk profil dinamik
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ArkibPage() {
  const [archives, setArchives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArchive, setSelectedArchive] = useState<any | null>(null);

  // STATE BAHARU: Penapis Subjek & Pilihan Padam Pukal
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // State Profil Pengguna Dinamik Supabase
  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
  }>({
    name: 'Pengguna ABQARI',
    faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
  });

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

  const fetchArchives = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/archives');
      const json = await res.json();
      if (json.success) setArchives(json.data);
    } catch (error) {
      console.error('Ralat mengambil arkib:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('AMARAN: Adakah anda pasti mahu memadam rekod set soalan ini?')) return;
    try {
      const res = await fetch('/api/archives', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setArchives(archives.filter(a => a.id !== id));
        setSelectedDocIds(prev => prev.filter(docId => docId !== id));
        alert('Set soalan berjaya dipadamkan dari Arkib.');
        if (selectedArchive?.id === id) setSelectedArchive(null);
      }
    } catch (error) {
      alert('Berlaku ralat pelayan semasa memadam arkib.');
    }
  };

  // FUNGSI BAHARU: Padam Serentak (Bulk Delete)
  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    if (!confirm(`AMARAN: Anda pasti mahu memadam ${selectedDocIds.length} rekod arkib ini secara serentak?`)) return;

    let successCount = 0;
    for (const id of selectedDocIds) {
      try {
        const res = await fetch('/api/archives', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (res.ok && json.success) successCount++;
      } catch (error) {
        console.error(`Gagal memadam arkib ID ${id}`);
      }
    }

    alert(`${successCount} rekod arkib berjaya dipadamkan.`);
    setSelectedDocIds([]);
    fetchArchives();
  };

  // FUNGSI EKSPORT PROGRAMATIK KE MS WORD (.DOCX)
  const handleExportWord = async (arkib: any) => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // HEADER UITM
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "UNIVERSITI TEKNOLOGI MARA", bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "KERTAS SOALAN PEPERIKSAAN AKHIR (JANAAN AI ABQARI)", bold: true, size: 24 })],
          }),
          new Paragraph({ text: "" }),
          
          // MAKLUMAT KURSUS
          new Paragraph({ children: [new TextRun({ text: `KURSUS\t\t: ${arkib.subject_name}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `KOD KURSUS\t: ${arkib.course_code !== 'TIADA' ? arkib.course_code : ''}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `SESI\t\t\t: ${arkib.exam_period}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `TEMA/SET\t\t: ${arkib.type}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `PENJANA\t\t: ${arkib.created_by_name || arkib.user_name || arkib.lecturer_name || arkib.author || userProfile.name}`, bold: true })] }),
          new Paragraph({ text: "" }),
          
          // ARAHAN CALON
          new Paragraph({ children: [new TextRun({ text: "ARAHAN KEPADA CALON:", bold: true, underline: {} })] }),
          new Paragraph({ text: "1. Jangan buka kertas soalan ini sehingga diberitahu." }),
          new Paragraph({ text: "2. Jawab semua soalan di dalam buku jawapan yang disediakan." }),
          new Paragraph({ text: "3. Dilarang membawa sebarang bahan selain alat tulis masuk ke dalam bilik peperiksaan." }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "------------------------------------------------------------------------------------------------------", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          // KERTAS SOALAN
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "BAHAGIAN SOALAN", bold: true })]
          }),
          new Paragraph({ text: "" }),
          ...arkib.questions_text.split('\n').map((line: string) => new Paragraph({ text: line })),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "------------------------------------------------------------------------------------------------------", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),

          // SKEMA JAWAPAN
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "SKEMA JAWAPAN / RUBRIK", bold: true })]
          }),
          new Paragraph({ text: "" }),
          ...(arkib.scheme_text ? arkib.scheme_text.split('\n').map((line: string) => new Paragraph({ text: line })) : [new Paragraph({ text: "Tiada skema jawapan disediakan." })]),
        ],
      }]
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `Kertas_Soalan_${arkib.course_code || 'ABQARI'}_${arkib.exam_period}.docx`);
    });
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\[(?:Aras|C|P|A|LO|CO)[^\]]*\])/gi);
    return parts.map((part, index) => {
      const arasMatch = part.match(/\[Aras:\s*C([1-6])\]/i);
      if (arasMatch) {
        const level = arasMatch[1]; let bgColor, textColor, borderColor;
        switch(level) {
          case '1': bgColor = '#dbeafe'; textColor = '#1e40af'; borderColor = '#93c5fd'; break;
          case '2': bgColor = '#dcfce7'; textColor = '#166534'; borderColor = '#86efac'; break;
          case '3': bgColor = '#fef9c3'; textColor = '#854d0e'; borderColor = '#fde047'; break;
          case '4': bgColor = '#ffedd5'; textColor = '#9a3412'; borderColor = '#fdba74'; break;
          case '5': bgColor = '#f3e8ff'; textColor = '#6b21a8'; borderColor = '#d8b4fe'; break;
          case '6': bgColor = '#fee2e2'; textColor = '#991b1b'; borderColor = '#fca5a5'; break;
          default: bgColor = '#f1f5f9'; textColor = '#334155'; borderColor = '#cbd5e1';
        }
        return <span key={index} style={{ backgroundColor: bgColor, color: textColor, fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${borderColor}`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      }
      if (part.match(/\[C:/i)) return <span key={index} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #7dd3fc`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[P:/i)) return <span key={index} style={{ backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #f9a8d4`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[A:/i)) return <span key={index} style={{ backgroundColor: '#ffedd5', color: '#c2410c', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #fdba74`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[LO:/i)) return <span key={index} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #c4b5fd`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      return part;
    });
  };

  // LOGIK TAPISAN & PILIHAN PUKAL
  const uniqueSubjects = Array.from(new Set(archives.map(a => a.subject_name).filter(Boolean)));

  const filteredArchives = archives.filter(a => {
    if (!selectedSubjectFilter) return true;
    return a.subject_name === selectedSubjectFilter;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDocIds(filteredArchives.map(a => a.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedDocIds.includes(id)) {
      setSelectedDocIds(selectedDocIds.filter(docId => docId !== id));
    } else {
      setSelectedDocIds([...selectedDocIds, id]);
    }
  };

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '260px',
      backgroundColor: '#3b0764',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)', borderBottom: '4px solid #fde047', zIndex: 0
    },
    container: { maxWidth: '1280px', margin: '0 auto', padding: '30px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#3b0764', backgroundColor: '#fde047', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    card: { backgroundColor: 'white', borderRadius: '16px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' },
    th: { textAlign: 'left' as 'left', padding: '15px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.85rem', fontWeight: '700', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase' as 'uppercase' },
    td: { padding: '15px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.9rem', verticalAlign: 'middle' },
    btnView: { backgroundColor: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', marginRight: '8px' },
    btnDownload: { backgroundColor: '#f0fdf4', color: '#166534', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', marginRight: '8px' },
    btnDelete: { backgroundColor: '#fef2f2', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' },
    btnDanger: { backgroundColor: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '0.85rem' },
    selectInput: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', fontWeight: '600' }
  };

  return (
    <div style={styles.page}>
      <div style={styles.banner} />
      
      <div style={styles.container}>
        <div style={styles.headerBox}>
          <Link href="/" style={styles.backBtn}>← Kembali ke Papan Pemuka</Link>
          <div style={{ textAlign: 'center', color: 'white' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Arkib Kertas Ujian</h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#e2e8f0' }}>Sejarah Penjanaan Soalan AI ABQARI</p>
          </div>

          {/* PAPARAN PROFIL PENGGUNA DINAMIK */}
          <div style={{ color: 'white', textAlign: 'right', fontSize: '0.8rem' }}>
            <strong style={{ fontSize: '0.95rem', display: 'block' }}>{userProfile.name}</strong>
            <span style={{ opacity: 0.8 }}>{userProfile.faculty}</span>
          </div>
        </div>

        <div style={styles.card}>
          {/* BAR KAWALAN: TAPISAN SUBJEK & PADAM PUKAL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '400px' }}>
              <select 
                value={selectedSubjectFilter} 
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                style={{ ...styles.selectInput, width: '100%' }}
              >
                <option value="">📋 Semua Subjek ({archives.length})</option>
                {uniqueSubjects.map((subName) => (
                  <option key={subName} value={subName}>
                    {subName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              {selectedDocIds.length > 0 && (
                <button style={styles.btnDanger} onClick={handleBulkDelete}>
                  🗑️ Padam Terpilih ({selectedDocIds.length})
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Sedang memuatkan senarai arkib...</div>
          ) : filteredArchives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🗄️</div>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a' }}>Tiada rekod dijumpai.</p>
              <Link href="/penjana" style={{ display: 'inline-block', marginTop: '15px', backgroundColor: '#3b0764', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>Jana Soalan Baharu</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll} 
                        checked={filteredArchives.length > 0 && selectedDocIds.length === filteredArchives.length} 
                      />
                    </th>
                    <th style={{ ...styles.th, width: '50px', textAlign: 'center' }}>NO.</th>
                    <th style={styles.th}>Tarikh & Masa</th>
                    <th style={styles.th}>Maklumat Subjek</th>
                    <th style={styles.th}>Nama Penjana</th>
                    <th style={styles.th}>Sesi & Tetapan</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchives.map((arkib, index) => (
                    <tr 
                      key={arkib.id} 
                      style={{ backgroundColor: selectedDocIds.includes(arkib.id) ? '#f1f5f9' : 'transparent' }}
                    >
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedDocIds.includes(arkib.id)} 
                          onChange={() => handleSelectRow(arkib.id)} 
                        />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                        {index + 1}
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>
                          {new Date(arkib.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          🕒 {new Date(arkib.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ color: '#0f172a', fontWeight: 'bold' }}>{arkib.course_code !== 'TIADA' ? `${arkib.course_code} - ` : ''}{arkib.subject_name}</div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '600', color: '#334155' }}>
                          👤 {arkib.created_by_name || arkib.user_name || arkib.lecturer_name || arkib.author || userProfile.name}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>{arkib.exam_period}</span>
                        <br/><span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '600' }}>{arkib.type}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button onClick={() => setSelectedArchive(arkib)} style={styles.btnView}>👁️ Lihat</button>
                        <button onClick={() => handleExportWord(arkib)} style={styles.btnDownload}>⬇️ Word</button>
                        <button onClick={() => handleDelete(arkib.id)} style={styles.btnDelete}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedArchive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '950px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', padding: '20px 30px', backgroundColor: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>{selectedArchive.course_code !== 'TIADA' ? `${selectedArchive.course_code} - ` : ''}{selectedArchive.subject_name}</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Penjana: <strong>{selectedArchive.created_by_name || selectedArchive.user_name || selectedArchive.lecturer_name || selectedArchive.author || userProfile.name}</strong> 
                  <span style={{ marginLeft: '10px' }}>🕒 {new Date(selectedArchive.created_at).toLocaleDateString('ms-MY')} | {new Date(selectedArchive.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</span>
                </p>
              </div>
              <button onClick={() => setSelectedArchive(null)} style={{ background: '#e2e8f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ padding: '30px', overflowY: 'auto', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div>
                <h3 style={{ margin: '0 0 15px 0', color: '#3b0764', borderBottom: '2px solid #f3e8ff', paddingBottom: '8px', fontSize: '1.1rem' }}>📄 Kertas Soalan</h3>
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.05rem', color: '#1e293b', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {renderHighlightedText(selectedArchive.questions_text)}
                </div>
              </div>

              {selectedArchive.scheme_text && (
                <div>
                  <h3 style={{ margin: '0 0 15px 0', color: '#166534', borderBottom: '2px solid #dcfce7', paddingBottom: '8px', fontSize: '1.1rem' }}>✅ Skema Jawapan</h3>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.05rem', color: '#1e293b', lineHeight: '1.6', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    {selectedArchive.scheme_text}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ padding: '15px 30px', borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => handleExportWord(selectedArchive)} style={{ padding: '10px 20px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>⬇️ Muat Turun Word</button>
              <button onClick={() => setSelectedArchive(null)} style={{ padding: '10px 20px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}