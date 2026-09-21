'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function PusatSumberContent() {
  const searchParams = useSearchParams();

  // State Profil Pengguna Dinamik Supabase
  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
  }>({
    name: 'Pengguna ABQARI',
    faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
  });

  // State Enjin Teras
  const [documents, setDocuments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Pembantu Token Pengesahan Sesi Supabase
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  // 1. Pengambilan Profil Pengguna
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

  // 2. Semak ID subjek dari URL
  useEffect(() => {
    const subjectIdParam = searchParams.get('subjectId');
    if (subjectIdParam) {
      setFilterSubjectId(subjectIdParam);
      setSelectedSubjectId(subjectIdParam);
    }
  }, [searchParams]);

  // 3. FUNGSI FETCH REAL-TIME (DOKUMEN)
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase.from('documents').select('*').order('created_at', { ascending: false });

      if (user) {
        const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
        const isAdminUser = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';

        if (!isAdminUser) {
          // Penapisan Ketat Dokumen: Hanya milik pengguna ini
          query = query.eq('user_id', user.id);
        }
      } else {
         // Jika tiada sesi user, elakkan paparan data untuk keselamatan
         setDocuments([]);
         setIsLoading(false);
         return;
      }

      const { data, error } = await query;
      if (error) console.error('Ralat pangkalan data dokumen:', error.message);
      if (data) {
        setDocuments(data);
      }
    } catch (error) {
      console.error('Ralat mengambil dokumen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // FUNGSI SUBJEK YANG TELAH DIPERBAIKI PENAPISANNYA (FILTER)
  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
         setSubjects([]); // Keselamatan: Tiada user, tiada subjek
         return; 
      }

      let query = supabase.from('subjects').select('*').order('name', { ascending: true });

      const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
      const isAdminUser = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';

      // PENAPISAN KETAT: Jika bukan admin, WAJIB hanya tarik subjek milik user.id sahaja.
      if (!isAdminUser) {
        query = query.eq('user_id', user.id); 
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Ralat pangkalan data semasa menarik subjek:', error.message);
      }
      
      if (data) {
        setSubjects(data);
      }
    } catch (error) {
      console.error('Ralat mengambil subjek:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchSubjects();
  }, []);

  // 4. Pengendali Muat Naik (Terhubung ke Enjin RAG)
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Sila pilih fail PDF.');
    if (!selectedSubjectId) return alert('Sila pilih subjek terlebih dahulu.');

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', selectedSubjectId);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { ...authHeaders },
        body: formData,
      });
      const json = await res.json();

      if (res.ok && json.success) {
        alert('Bahan kursus berjaya dimuat naik & memori AI (RAG) telah dijana!');
        setIsModalOpen(false);
        setFile(null);
        setSelectedSubjectId('');
        fetchDocuments(); // Segar semula senarai dokumen
      } else {
        alert(`Ralat Muat Naik: ${json.error || 'Gagal memproses.'}`);
      }
    } catch (error) {
      alert('Berlaku ralat pelayan semasa pemprosesan PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  // 5. Pengendali Padam
  const handleDelete = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam dokumen ini? Memori AI berkaitan juga akan terpadam.')) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
    const authHeaders = await getAuthHeaders();

    for (const id of selectedDocIds) {
      try {
        await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ id }),
        });
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
    return found ? `${found.course_code === 'TIADA' ? '' : found.course_code} ${found.name}`.trim() : 'Tiada Subjek';
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

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '300px',
      backgroundColor: '#3b0764',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)', borderBottom: '4px solid #fde047', zIndex: 0
    },
    container: { maxWidth: '1200px', margin: '0 auto', padding: '30px 20px', position: 'relative' as 'relative', zIndex: 1 },
    headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fde047', textDecoration: 'none', fontWeight: '700', fontSize: '0.95rem', textShadow: '0 1px 3px rgba(0,0,0,0.3)' },
    titleBox: { textAlign: 'center' as 'center', color: 'white' },
    
    mainCard: { backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', padding: '30px' },
    
    btnPrimary: { backgroundColor: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 6px rgba(59,130,246,0.2)' },
    btnDanger: { backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: '0.2s' },
    btnDangerSmall: { backgroundColor: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', border: '1px solid #f87171', cursor: 'pointer' },
    
    input: { padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', width: '100%', outlineColor: '#3b0764', backgroundColor: '#f8fafc' },
    
    table: { width: '100%', borderCollapse: 'collapse' as 'collapse', marginTop: '20px' },
    th: { backgroundColor: '#f8fafc', color: '#475569', padding: '14px 15px', textAlign: 'left' as 'left', fontSize: '0.85rem', fontWeight: '700', borderBottom: '2px solid #e2e8f0' },
    td: { padding: '14px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#0f172a' },
    
    modalOverlay: { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' as 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' as 'relative' }
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
          <div style={styles.titleBox}>
             <h1 style={{ margin: '0 0 5px 0', fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Pusat Sumber (Nota AI)</h1>
             <p style={{ margin: 0, color: '#cbd5e1', fontSize: '1rem' }}>Muat naik bahan rujukan, modul, atau slaid kuliah untuk dianalisis oleh enjin ABQARI.</p>
          </div>
          
          <div style={{ color: 'white', textAlign: 'right', fontSize: '0.8rem' }}>
            <strong style={{ fontSize: '0.95rem', display: 'block' }}>{userProfile.name}</strong>
            <span style={{ opacity: 0.8 }}>{userProfile.faculty}</span>
          </div>
        </div>

        {/* PANDUAN MUAT NAIK */}
        <div style={{ backgroundColor: '#eff6ff', padding: '15px 20px', borderRadius: '12px', border: '1px solid #bfdbfe', borderLeft: '5px solid #3b82f6', marginBottom: '25px', color: '#1e40af', fontSize: '0.9rem', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div>
            <strong>Panduan Muat Naik (Penting!):</strong><br/>
            Pastikan anda telah mendaftar subjek terlebih dahulu di modul <strong>Pengurusan Kursus</strong> sebelum anda boleh memuat naik fail PDF rujukan di halaman ini. Dokumen yang dimuat naik akan terus dikaitkan dengan pangkalan data Vektor.
          </div>
        </div>

        {/* KAD KANDUNGAN UTAMA */}
        <div style={styles.mainCard}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: '800' }}>Senarai Dokumen PDF</h2>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedDocIds.length > 0 && (
                <button style={styles.btnDanger} onClick={handleBulkDelete}>
                  Padam Dipilih ({selectedDocIds.length})
                </button>
              )}
              <button style={{ ...styles.btnPrimary, backgroundColor: '#3b0764', boxShadow: '0 4px 6px rgba(59,7,100,0.2)' }} onClick={() => setIsModalOpen(true)}>
                + Tambah Dokumen Baru
              </button>
            </div>
          </div>

          {/* BAR CARIAN & PENAPISAN */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" placeholder="🔍 Cari nama fail PDF atau ID..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <select 
                value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)}
                style={styles.input}
              >
                <option value="">📋 Semua Subjek</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* JADUAL DOKUMEN */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
               <p>⏳ Memuatkan pangkalan data...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
              <p>Tiada dokumen yang sepadan dengan carian anda.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '50px', textAlign: 'center' }}>
                      <input type="checkbox" onChange={handleSelectAll} checked={filteredDocuments.length > 0 && selectedDocIds.length === filteredDocuments.length} style={{ cursor: 'pointer' }}/>
                    </th>
                    <th style={styles.th}>Nama Fail / ID</th>
                    <th style={styles.th}>Subjek Pemetaan</th>
                    <th style={styles.th}>Tarikh Dimuat Naik</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} style={{ backgroundColor: selectedDocIds.includes(doc.id) ? '#f8fafc' : 'transparent', transition: 'background 0.2s' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => handleSelectRow(doc.id)} style={{ cursor: 'pointer' }}/>
                      </td>
                      <td style={{ fontWeight: '600', color: '#1e293b' }}>
                        📄 {doc.file_name || doc.title || `${doc.id.substring(0, 8)}...`}
                      </td>
                      <td>
                        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                           {getSubjectName(doc.subject_id)}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(doc.created_at).toLocaleDateString('ms-MY')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button style={styles.btnDangerSmall} onClick={() => handleDelete(doc.id)}>Padam</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL UPLOAD */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: '800' }}>Muat Naik Bahan Kursus</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            </div>

            <form onSubmit={handleUpload}>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>
                  Pilih Subjek & Pemetaan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                
                <select
                  style={{ ...styles.input, backgroundColor: '#f1f5f9', fontWeight: '600', color: '#0f172a' }}
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Subjek --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                    </option>
                  ))}
                </select>
                
                {subjects.length === 0 && (
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '5px' }}>
                    Tiada subjek dijumpai. Sila daftar subjek baharu di menu Pengurusan Kursus.
                  </p>
                )}
              </div>

              <div style={{ border: '2px dashed #cbd5e1', padding: '30px 20px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#334155', fontWeight: '700' }}>Fail PDF (Wajib) <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required style={{ margin: '0 auto', display: 'block', cursor: 'pointer' }} />
              </div>
                  
              <button 
                type="submit" 
                disabled={isUploading} 
                style={{ width: '100%', backgroundColor: isUploading ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: isUploading ? 'not-allowed' : 'pointer', boxShadow: isUploading ? 'none' : '0 4px 10px rgba(59,130,246,0.3)', transition: '0.2s' }}
              >
                {isUploading ? '⏳ Sedang Memuat Naik & Menganalisis Vektor...' : 'Muat Naik & Analisis'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function PusatSumberPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#3b0764', fontFamily: 'sans-serif' }}>
        <h2>Memuatkan Pusat Sumber...</h2>
      </div>
    }>
      <PusatSumberContent />
    </Suspense>
  );
}