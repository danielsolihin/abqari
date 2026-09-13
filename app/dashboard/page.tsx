'use client';

import { useState, useEffect } from 'react';

// Senarai Rujukan C, P, A dan LO yang dikemas kini
const C_LIST = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const P_LIST = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
const A_LIST = ['A1', 'A2', 'A3', 'A4', 'A5'];
const LO_LIST = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6', 'LO7', 'LO8', 'LO9', 'LO10', 'LO11'];

export default function DashboardPage() {
  // ==========================================
  // STATE SEDIA ADA (Dikekalkan 100%)
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

  // ==========================================
  // STATE BAHARU UNTUK UI (Filter & Select All)
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // ==========================================
  // STATE BAHARU UNTUK C/P/A & LO + EDIT SUBJEK
  // ==========================================
  // Nota: selectedCOs dikekalkan namanya untuk API/Database, 
  // tetapi ia kini menyimpan nilai C, P, dan A.
  const [selectedCOs, setSelectedCOs] = useState<string[]>([]);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // ==========================================
  // FUNGSI FETCH SEDIA ADA (Dikekalkan)
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

  useEffect(() => {
    fetchDocuments();
    fetchSubjects();
  }, []);

  // ==========================================
  // FUNGSI TOGGLE KOTAK SEMAK (C, P, A & LO)
  // ==========================================
  const toggleCO = (itemValue: string) => {
    setSelectedCOs(prev => prev.includes(itemValue) ? prev.filter(item => item !== itemValue) : [...prev, itemValue]);
  };

  const toggleLO = (lo: string) => {
    setSelectedLOs(prev => prev.includes(lo) ? prev.filter(item => item !== lo) : [...prev, lo]);
  };

  // ==========================================
  // FUNGSI BUKA RUANG EDIT SUBJEK
  // ==========================================
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

  // ==========================================
  // FUNGSI SIMPAN SUBJEK (Baru & Kemas Kini)
  // ==========================================
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
        
        // Reset form
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
        await fetch('/api/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Papan Pemuka Pentadbir</h1>
        <p>Uruskan fail PDF dan subjek sistem anda di sini.</p>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2>Senarai Dokumen PDF</h2>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {selectedDocIds.length > 0 && (
                <button className="btn-danger" onClick={handleBulkDelete}>
                  Padam Dipilih ({selectedDocIds.length})
                </button>
              )}
              <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                + Tambah Dokumen / Subjek
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" placeholder="Cari nama fail atau ID..." className="form-control"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <select 
                className="form-control" value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              >
                <option value="">Semua Subjek</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <p className="empty-text">Memuatkan data...</p>
          ) : filteredDocuments.length === 0 ? (
            <p className="empty-text">Tiada dokumen yang sepadan dengan carian anda.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>
                      <input type="checkbox" onChange={handleSelectAll} checked={filteredDocuments.length > 0 && selectedDocIds.length === filteredDocuments.length} style={{ cursor: 'pointer', transform: 'scale(1.2)' }}/>
                    </th>
                    <th>Nama Fail / ID</th>
                    <th>Subjek</th>
                    <th>Tarikh Dimuat Naik</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} style={{ backgroundColor: selectedDocIds.includes(doc.id) ? '#f1f5f9' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => handleSelectRow(doc.id)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }}/>
                      </td>
                      <td><strong>{doc.file_name || doc.title || `${doc.id.substring(0, 8)}...`}</strong></td>
                      <td>{getSubjectName(doc.subject_id)}</td>
                      <td>{new Date(doc.created_at).toLocaleDateString('ms-MY')}</td>
                      <td>
                        <button className="btn-danger" onClick={() => handleDelete(doc.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>Padam</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Muat Naik Bahan Kursus</h2>
              <button onClick={() => { setIsModalOpen(false); setIsCreatingSubject(false); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666' }}>✕</button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Pilih Subjek & Pemetaan</label>
                
                {!isCreatingSubject ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                    >
                      <option value="">-- Pilih Subjek --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => { 
                      setNewSubjectName(''); setNewCourseCode(''); setSelectedCOs([]); setSelectedLOs([]); setEditingSubjectId(null); setIsCreatingSubject(true); 
                    }}>+ Subjek Baharu</button>
                    
                    {selectedSubjectId && (
                      <button type="button" onClick={handleEditSubjectClick} style={{ padding: '8px 12px', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ✏️ Edit Subjek
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: 0 }}>{editingSubjectId ? 'Kemas Kini Subjek' : 'Tambah Subjek Baharu'}</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="form-control" placeholder="Kod (cth: CTU556)" value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} style={{ width: '35%' }} />
                      <input type="text" className="form-control" placeholder="Nama Subjek" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    
                    {/* KOTAK SEMAK COURSE OUTCOMES & LO */}
                    <div style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '6px', backgroundColor: '#fff', maxHeight: '350px', overflowY: 'auto' }}>
                      <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Pilih Course Outcomes (C, P, A):</p>
                      
                      <p style={{ margin: '5px 0', fontSize: '0.8rem', color: '#0f766e', fontWeight: 'bold' }}>Domain Kognitif (C)</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {C_LIST.map(c => (
                          <label key={c} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(c)} onChange={() => toggleCO(c)} /> {c}
                          </label>
                        ))}
                      </div>

                      <p style={{ margin: '5px 0', fontSize: '0.8rem', color: '#0f766e', fontWeight: 'bold' }}>Domain Psikomotor (P)</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {P_LIST.map(p => (
                          <label key={p} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(p)} onChange={() => toggleCO(p)} /> {p}
                          </label>
                        ))}
                      </div>

                      <p style={{ margin: '5px 0', fontSize: '0.8rem', color: '#0f766e', fontWeight: 'bold' }}>Domain Afektif (A)</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
                        {A_LIST.map(a => (
                          <label key={a} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCOs.includes(a)} onChange={() => toggleCO(a)} /> {a}
                          </label>
                        ))}
                      </div>
                      
                      <hr style={{ borderTop: '1px dashed #cbd5e1', margin: '15px 0' }} />

                      <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Pilih MQF 2.0 (LO):</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {LO_LIST.map(lo => (
                          <label key={lo} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedLOs.includes(lo)} onChange={() => toggleLO(lo)} /> {lo}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="button" className="btn-secondary" onClick={() => { setIsCreatingSubject(false); setEditingSubjectId(null); }}>Batal</button>
                      <button type="button" className="btn-primary" onClick={handleSaveSubject}>💾 Simpan Maklumat</button>
                    </div>
                  </div>
                )}
              </div>

              {!isCreatingSubject && (
                <>
                  <div className="form-group" style={{ border: '1px dashed #cbd5e1', padding: '30px 20px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: '#475569' }}>Fail PDF:</label>
                    <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ margin: '0 auto', display: 'block' }} />
                  </div>
                  <button type="submit" className="btn-primary" disabled={isUploading} style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                    {isUploading ? 'Sedang Memproses Fail & Vektor...' : 'Muat Naik & Analisis'}
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