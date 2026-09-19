'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const BLOOM_OPTIONS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'P1', 'P2', 'P3', 'P4', 'P5', 'A1', 'A2', 'A3', 'A4', 'A5'];
const DIFFICULTY_OPTIONS = ['Mudah', 'Sederhana', 'Sukar'];

export default function BankSoalanPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Penapis (Filter) & Carian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedBloomFilter, setSelectedBloomFilter] = useState('');

  // State Modal Tambah Soalan Baharu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formAnswerScheme, setFormAnswerScheme] = useState('');
  const [formMarks, setFormMarks] = useState<number>(10);
  const [formBloomLevel, setFormBloomLevel] = useState('C1');
  const [formCoCode, setFormCoCode] = useState('CO1');
  const [formLoCode, setFormLoCode] = useState('LO1');
  const [formDifficulty, setFormDifficulty] = useState('Sederhana');

  // State Toggle Tunjuk Jawapan (per question ID)
  const [expandedAnswers, setExpandedAnswers] = useState<{ [key: string]: boolean }>({});

  // 1. Fetch Subjek (Dwi-Lapisan: API Backend + Supabase Fallback)
  const fetchSubjects = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const timeStamp = new Date().getTime();
      const res = await fetch(`/api/subjects?t=${timeStamp}`, { headers });
      
      let list: any[] = [];
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) list = json;
        else if (json.success && Array.isArray(json.data)) list = json.data;
        else if (Array.isArray(json.data)) list = json.data;
      }

      if (list.length === 0) {
        const { data: directSubjects } = await supabase
          .from('subjects')
          .select('*')
          .order('name', { ascending: true });
          
        if (directSubjects && directSubjects.length > 0) {
          list = directSubjects;
        }
      }

      setSubjects(list);
    } catch (err) {
      console.error('Ralat mengambil subjek:', err);
    }
  };

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const timeStamp = new Date().getTime();
      let url = `/api/questions?t=${timeStamp}`;
      if (selectedSubjectFilter) {
        url += `&subject_id=${selectedSubjectFilter}`;
      }
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Ralat API Questions (${res.status}):`, errorText);
        setQuestions([]);
        return;
      }

      const json = await res.json();
      if (json.success) setQuestions(json.data || []);
    } catch (err) {
      console.error('Ralat mengambil soalan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubjectFilter]);

  // 2. Simpan Soalan Baharu
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId) return alert('Sila pilih subjek.');
    if (!formQuestionText.trim()) return alert('Sila masukkan teks soalan.');

    setIsSubmitting(true);
    try {
      const payload = {
        subject_id: formSubjectId,
        question_text: formQuestionText,
        answer_scheme: formAnswerScheme,
        marks: Number(formMarks),
        bloom_level: formBloomLevel,
        co_code: formCoCode,
        lo_code: formLoCode,
        difficulty: formDifficulty,
      };

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        alert(`Ralat Pelayan (${res.status}): ${errorText}`);
        return;
      }

      const json = await res.json();
      if (json.success) {
        alert('Soalan berjaya disimpan ke dalam Bank Soalan!');
        setIsModalOpen(false);
        setFormQuestionText('');
        setFormAnswerScheme('');
        setFormMarks(10);
        fetchQuestions();
      } else {
        alert(`Ralat: ${json.error || 'Gagal menyimpan.'}`);
      }
    } catch (err) {
      alert('Ralat pelayan semasa menyimpan soalan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Padam Soalan
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam soalan ini dari Bank Soalan?')) return;

    try {
      const res = await fetch('/api/questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        alert(`Ralat memadam (${res.status})`);
        return;
      }

      const json = await res.json();
      if (json.success) {
        setQuestions(prev => prev.filter(q => q.id !== id));
      } else {
        alert(`Ralat: ${json.error || 'Gagal memadam.'}`);
      }
    } catch (err) {
      alert('Berlaku ralat semasa memadam soalan.');
    }
  };

  const toggleAnswer = (id: string) => {
    setExpandedAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ==========================================
  // PENAPIS CARIAN TEMPATAN (KATA KUNCI & BLOOM)
  // ==========================================
  const filteredQuestions = questions.filter(q => {
    const safeSearchQuery = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      (q.question_text || '').toLowerCase().includes(safeSearchQuery) ||
      (q.answer_scheme || '').toLowerCase().includes(safeSearchQuery);
      
    // Semak sama ada Aras Bloom dipadankan
    // q.bloom_level biasanya disimpan dalam huruf besar, cth: "C1"
    const safeBloomFilter = selectedBloomFilter.trim().toUpperCase();
    const matchesBloom = safeBloomFilter ? (q.bloom_level || '').toUpperCase() === safeBloomFilter : true;
    
    return matchesSearch && matchesBloom;
  });

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: '60px' },
    banner: {
      height: '250px', // DINAIRKAN KETINGGIAN SUPAYA TEKS TIDAK DILINDUNGI KOTAK BAWAH
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      color: 'white',
      padding: '30px 20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
      borderBottom: '4px solid #fde047'
    },
    // MARGIN ATAS KOTAK DIKURANGKAN (-40px instead of -80px)
    container: { maxWidth: '1200px', margin: '-40px auto 0 auto', padding: '0 20px', position: 'relative' as 'relative', zIndex: 10 },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f8fafc', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem' },
    
    card: { backgroundColor: 'white', borderRadius: '14px', padding: '25px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', marginBottom: '25px' },
    
    input: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outlineColor: '#312e81', width: '100%', backgroundColor: '#fff', cursor: 'pointer' },
    btnPrimary: { backgroundColor: '#312e81', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(49,46,129,0.2)' },
    btnSuccess: { backgroundColor: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer' },
    
    badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' },
    
    modalOverlay: { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
    modalBox: { backgroundColor: 'white', borderRadius: '14px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' as 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }
  };

  return (
    <div style={styles.page}>
      
      {/* BANNER HEADER */}
      <div style={styles.banner}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={styles.topBar}>
            <Link href="/" style={styles.backBtn}>
              ← Ke Papan Pemuka Utama
            </Link>
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: '600' }}>Pusat Repositori Soalan ABQARI</span>
          </div>
          <h1 style={{ margin: '10px 0 5px 0', fontSize: '2rem', fontWeight: '900', color: '#fde047' }}>
            📚 Bank Soalan Kursus
          </h1>
          <p style={{ margin: 0, color: '#e0e7ff', fontSize: '0.9rem', maxWidth: '800px' }}>
            Koleksi soalan peperiksaan, skema jawapan, dan pemetaan Taksonomi Bloom/CO/LO mengikut kursus.
          </p>
        </div>
      </div>

      <div style={styles.container}>
        
        {/* KOTAK KAWALAN & PENAPIS (FILTERS) */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '800' }}>
                Senarai Soalan Terkumpul ({filteredQuestions.length})
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Gunakan carian dan penapis di bawah untuk mengecilkan carian soalan.</p>
            </div>

            <button style={styles.btnPrimary} onClick={() => setIsModalOpen(true)}>
              + Tambah Soalan Baharu
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>🔍 Carian Kata Kunci</label>
              <input
                type="text"
                placeholder="Taip soalan atau skema..."
                style={{ ...styles.input, cursor: 'text' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>📚 Penapis Subjek</label>
              <select
                style={styles.input}
                value={selectedSubjectFilter}
                onChange={e => setSelectedSubjectFilter(e.target.value)}
              >
                <option value="">-- Semua Subjek --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>🎯 Penapis Bloom</label>
              <select
                style={styles.input}
                value={selectedBloomFilter}
                onChange={e => setSelectedBloomFilter(e.target.value)}
              >
                <option value="">-- Semua Aras Bloom --</option>
                {BLOOM_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SENARAI SOALAN (CARDS) */}
        {isLoading ? (
          <div style={{ ...styles.card, textAlign: 'center', padding: '40px' }}>
            <p style={{ margin: 0, color: '#64748b', fontWeight: '600' }}>⏳ Memuatkan soalan dari pangkalan data...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{ ...styles.card, textAlign: 'center', padding: '50px' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 10px 0' }}>📂</p>
            <h3 style={{ margin: '0 0 5px 0', color: '#0f172a' }}>Tiada Soalan Dijumpai</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Sila tambah soalan baharu atau tukar tetapan penapis carian anda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredQuestions.map((q, idx) => (
              <div key={q.id} style={{ ...styles.card, marginBottom: 0, borderLeft: '5px solid #312e81' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', ...styles.badge }}>
                      #{idx + 1}
                    </span>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#0f172a', ...styles.badge }}>
                      📖 {q.subjects?.course_code || ''} {q.subjects?.name || 'Umum'}
                    </span>
                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', ...styles.badge }}>
                      🎯 {q.bloom_level || 'N/A'}
                    </span>
                    {q.co_code && (
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', ...styles.badge }}>
                        {q.co_code}
                      </span>
                    )}
                    {q.lo_code && (
                      <span style={{ backgroundColor: '#fdf2f8', color: '#9d174d', ...styles.badge }}>
                        {q.lo_code}
                      </span>
                    )}
                    <span style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', ...styles.badge }}>
                      📊 {q.difficulty || 'Sederhana'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#1e293b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                      Markah: {q.marks || 10}
                    </span>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🗑️ Padam
                    </button>
                  </div>
                </div>

                {/* TEKS SOALAN */}
                <div style={{ fontSize: '0.95rem', color: '#0f172a', lineHeight: '1.6', fontWeight: '600', whiteSpace: 'pre-line', marginBottom: '15px' }}>
                  {q.question_text}
                </div>

                {/* BUTANG TOGGLE & SKEMA JAWAPAN */}
                {q.answer_scheme && (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                    <button
                      onClick={() => toggleAnswer(q.id)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      {expandedAnswers[q.id] ? '👇 Sembunyikan Skema Jawapan' : '👉 Lihat Skema Jawapan & Pemarkahan'}
                    </button>

                    {expandedAnswers[q.id] && (
                      <div style={{ marginTop: '10px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                        <strong style={{ color: '#0f172a', display: 'block', marginBottom: '6px' }}>💡 Skema Jawapan:</strong>
                        {q.answer_scheme}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* MODAL TAMBAH SOALAN BAHARU */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: '800' }}>
                ✍️ Tambah Soalan ke Bank Soalan
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleCreateQuestion}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                  Pilih Subjek / Kursus <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  style={styles.input}
                  value={formSubjectId}
                  onChange={e => setFormSubjectId(e.target.value)}
                >
                  <option value="">-- Pilih Subjek --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                  Teks Soalan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Taip arahan dan teks soalan penuh di sini..."
                  style={{ ...styles.input, fontFamily: 'inherit', cursor: 'text' }}
                  value={formQuestionText}
                  onChange={e => setFormQuestionText(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                  Skema Jawapan & Kata Kunci Pemarkahan (Opsional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Sediakan poin skema jawapan rasmi..."
                  style={{ ...styles.input, fontFamily: 'inherit', cursor: 'text' }}
                  value={formAnswerScheme}
                  onChange={e => setFormAnswerScheme(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' }}>Markah</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    style={{ ...styles.input, cursor: 'text' }}
                    value={formMarks}
                    onChange={e => setFormMarks(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' }}>Aras Bloom</label>
                  <select style={styles.input} value={formBloomLevel} onChange={e => setFormBloomLevel(e.target.value)}>
                    {BLOOM_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' }}>Kod CO</label>
                  <input
                    type="text"
                    placeholder="Cth: CO1"
                    style={{ ...styles.input, cursor: 'text' }}
                    value={formCoCode}
                    onChange={e => setFormCoCode(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' }}>Kod LO</label>
                  <input
                    type="text"
                    placeholder="Cth: LO1"
                    style={{ ...styles.input, cursor: 'text' }}
                    value={formLoCode}
                    onChange={e => setFormLoCode(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' }}>Tahap Kesukaran</label>
                  <select style={styles.input} value={formDifficulty} onChange={e => setFormDifficulty(e.target.value)}>
                    {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={styles.btnSuccess}
                >
                  {isSubmitting ? '⏳ Menyimpan...' : '💾 Simpan Soalan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}