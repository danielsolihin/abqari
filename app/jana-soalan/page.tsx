'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Fungsi bantuan untuk menggoncang susunan array (Randomizer)
const shuffleArray = (array: any[]) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function JanaSoalanContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'auto';
  const querySubject = searchParams.get('subject') || '';

  const [mode, setMode] = useState<'manual' | 'auto'>(initialMode);
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState(querySubject);
  
  // Tetapan JSU (Jadual Spesifikasi Ujian)
  const [countMudah, setCountMudah] = useState<number>(10);
  const [countSederhana, setCountSederhana] = useState<number>(15);
  const [countSukar, setCountSukar] = useState<number>(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [totalMarks, setTotalMarks] = useState(0);

  // 1. Dapatkan Senarai Subjek
  const fetchSubjects = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
      const isAdminUser = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';

      let query = supabase.from('subjects').select('*').order('name', { ascending: true });
      if (!isAdminUser) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;
      setSubjects(data || []);
    } catch (err) {
      console.error('Ralat mengambil subjek:', err);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // 2. Jika masuk melalui Mod Manual, terus tarik soalan dari LocalStorage
  useEffect(() => {
    if (mode === 'manual') {
      const fetchManualQuestions = async () => {
        const storedIdsStr = localStorage.getItem('manual_jsu_ids');
        if (!storedIdsStr) {
          alert('Tiada soalan manual dijumpai. Sila pilih soalan dari Bank Soalan terlebih dahulu.');
          setMode('auto');
          return;
        }

        try {
          setIsGenerating(true);
          const ids: string[] = JSON.parse(storedIdsStr);
          
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          const { data, error } = await supabase
            .from('questions')
            .select('*')
            .in('id', ids);

          if (error) throw error;
          
          if (data) {
            // Susun data mengikut susunan ID asal yang dipilih oleh pengguna
            const sortedData = ids.map(id => data.find(d => d.id === id)).filter(Boolean);
            
            setGeneratedQuestions(sortedData);
            const marks = sortedData.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
            setTotalMarks(marks);
          }
        } catch (error) {
          console.error('Gagal menarik soalan manual:', error);
          alert('Berlaku ralat membaca soalan pilihan anda.');
        } finally {
          setIsGenerating(false);
        }
      };

      fetchManualQuestions();
    }
  }, [mode]);


  // 3. Enjin Penjana Soalan Rawak (Auto JSU)
  const handleGenerateAuto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return alert('Sila pilih subjek terlebih dahulu!');
    
    setIsGenerating(true);
    setGeneratedQuestions([]);
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );

      const { data: allQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('subject_id', selectedSubject);

      if (error) throw error;

      if (!allQuestions || allQuestions.length === 0) {
        alert('Tiada soalan ditemui di dalam Bank Soalan untuk subjek ini.');
        setIsGenerating(false);
        return;
      }

      const soalanMudah = allQuestions.filter(q => q.difficulty === 'Mudah' || !q.difficulty);
      const soalanSederhana = allQuestions.filter(q => q.difficulty === 'Sederhana');
      const soalanSukar = allQuestions.filter(q => q.difficulty === 'Sukar');

      if (soalanMudah.length < countMudah) alert(`Perhatian: Bank soalan hanya ada ${soalanMudah.length} soalan Mudah.`);
      if (soalanSederhana.length < countSederhana) alert(`Perhatian: Bank soalan hanya ada ${soalanSederhana.length} soalan Sederhana.`);
      if (soalanSukar.length < countSukar) alert(`Perhatian: Bank soalan hanya ada ${soalanSukar.length} soalan Sukar.`);

      const selectedMudah = shuffleArray(soalanMudah).slice(0, countMudah);
      const selectedSederhana = shuffleArray(soalanSederhana).slice(0, countSederhana);
      const selectedSukar = shuffleArray(soalanSukar).slice(0, countSukar);

      const finalSet = [...selectedMudah, ...selectedSederhana, ...selectedSukar];
      
      const marks = finalSet.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

      setGeneratedQuestions(finalSet);
      setTotalMarks(marks);

    } catch (err) {
      console.error('Ralat menjana soalan:', err);
      alert('Berlaku ralat semasa cuba menjana kertas soalan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const styles = {
    page: { backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: '60px' },
    banner: { height: '250px', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: 'white', padding: '30px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderBottom: '4px solid #10b981' },
    container: { maxWidth: '1000px', margin: '-40px auto 0 auto', padding: '0 20px', position: 'relative' as 'relative', zIndex: 10 },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    backBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f8fafc', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem' },
    card: { backgroundColor: 'white', borderRadius: '14px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', marginBottom: '25px' },
    input: { padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', width: '100%', backgroundColor: '#f8fafc' },
    btnPrimary: { backgroundColor: '#10b981', color: 'white', padding: '14px 20px', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', transition: 'all 0.2s', width: '100%', fontSize: '1rem', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' },
    btnSecondary: { backgroundColor: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: '8px', alignItems: 'center' },
    badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' },
  };

  return (
    <div style={styles.page}>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background-color: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .card-print { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .question-box { page-break-inside: avoid; border: none !important; border-bottom: 1px dashed #ccc !important; padding-bottom: 20px !important; margin-bottom: 20px !important; }
        }
      `}} />

      <div className="no-print" style={styles.banner}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={styles.topBar}>
            <Link href="/bank-soalan" style={styles.backBtn}>← Kembali ke Bank Soalan</Link>
            <span style={{ fontSize: '0.85rem', color: '#a7f3d0', fontWeight: '600' }}>Modul Kecerdasan & Penjanaan</span>
          </div>
          <h1 style={{ margin: '10px 0 5px 0', fontSize: '2.2rem', fontWeight: '900', color: '#10b981' }}>
            ⚙️ Penjana Set Soalan (JSU)
          </h1>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem', maxWidth: '800px' }}>
            Jana kertas soalan peperiksaan secara manual atau rawak terus dari Bank Soalan.
          </p>
        </div>
      </div>

      <div style={styles.container}>
        
        {/* NAVIGASI TAB MOD (MANUAL vs AUTO) */}
        <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setMode('auto')}
            style={{ flex: 1, padding: '15px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', border: mode === 'auto' ? '2px solid #10b981' : '1px solid #cbd5e1', backgroundColor: mode === 'auto' ? '#ecfdf5' : '#ffffff', color: mode === 'auto' ? '#047857' : '#64748b' }}
          >
            🎲 Jana Rawak Auto (JSU)
          </button>
          <button 
            onClick={() => {
              if (!localStorage.getItem('manual_jsu_ids')) {
                 alert('Sila tick soalan di Bank Soalan dahulu untuk menggunakan fungsi ini.');
                 return;
              }
              setMode('manual');
            }}
            style={{ flex: 1, padding: '15px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', border: mode === 'manual' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: mode === 'manual' ? '#fffbeb' : '#ffffff', color: mode === 'manual' ? '#b45309' : '#64748b' }}
          >
            ✅ Papar Pilihan Manual Anda
          </button>
        </div>

        {/* MOD AUTO JSU (BORANG) */}
        {mode === 'auto' && (
          <div className="no-print" style={styles.card}>
            <form onSubmit={handleGenerateAuto}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>
                  Pilih Subjek / Kursus
                </label>
                <select required style={styles.input} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">-- Pilih Subjek untuk dijana --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.course_code === 'TIADA' ? '' : `${s.course_code} - `}{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#334155' }}>📊 Taburan Aras Kesukaran (JSU)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '700', fontSize: '0.85rem', color: '#16a34a' }}>🟢 Bilangan Mudah</label>
                    <input type="number" min={0} required style={styles.input} value={countMudah} onChange={e => setCountMudah(Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '700', fontSize: '0.85rem', color: '#ca8a04' }}>🟡 Bilangan Sederhana</label>
                    <input type="number" min={0} required style={styles.input} value={countSederhana} onChange={e => setCountSederhana(Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '700', fontSize: '0.85rem', color: '#dc2626' }}>🔴 Bilangan Sukar</label>
                    <input type="number" min={0} required style={styles.input} value={countSukar} onChange={e => setCountSukar(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ marginTop: '15px', fontSize: '0.85rem', fontWeight: '700', color: '#475569', textAlign: 'right' }}>
                  Jumlah Soalan Keseluruhan: <span style={{ color: '#0f172a', fontSize: '1rem' }}>{countMudah + countSederhana + countSukar}</span>
                </div>
              </div>

              <button type="submit" disabled={isGenerating} style={styles.btnPrimary}>
                {isGenerating ? '⏳ Menyelongkar Bank Soalan...' : '✨ Jana Kertas Soalan Sekarang'}
              </button>
            </form>
          </div>
        )}

        {/* HASIL KERTAS SOALAN */}
        {generatedQuestions.length > 0 && (
          <div className="card-print" style={{ ...styles.card, marginTop: mode === 'manual' ? '0px' : '40px' }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px dashed #e2e8f0', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', color: '#0f172a' }}>✅ Kertas Soalan Sedia!</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{generatedQuestions.length} soalan terpilih | Jumlah Markah: {totalMarks}</p>
              </div>
              <button onClick={handlePrint} style={styles.btnSecondary}>
                🖨️ Cetak / Simpan PDF
              </button>
            </div>

            {/* HEADER KERTAS SOALAN */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>KERTAS SOALAN PEPERIKSAAN</h2>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                 {subjects.find(s => s.id === (selectedSubject || generatedQuestions[0]?.subject_id))?.course_code} - {subjects.find(s => s.id === (selectedSubject || generatedQuestions[0]?.subject_id))?.name}
              </p>
              <p style={{ margin: '8px 0', fontSize: '0.95rem' }}>Masa: _______________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Markah Penuh: {totalMarks}</p>
              <hr style={{ borderTop: '2px solid black', marginTop: '15px' }} />
            </div>

            {/* SENARAI SOALAN DENGAN JAJARAN SELARI RASMI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {generatedQuestions.map((q, idx) => (
                <div key={idx} className="question-box" style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', minWidth: '30px', textAlign: 'right', flexShrink: 0 }}>
                    {idx + 1}.
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', color: '#000', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                      {q.question_text}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                      <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', ...styles.badge }}>🎯 {q.bloom_level}</span>
                        <span style={{ backgroundColor: q.difficulty === 'Mudah' ? '#dcfce7' : q.difficulty === 'Sukar' ? '#fee2e2' : '#fef9c3', color: '#000', ...styles.badge }}>
                          {q.difficulty}
                        </span>
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginLeft: 'auto' }}>
                        [{q.marks} markah]
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '60px', fontWeight: 'bold', fontStyle: 'italic', letterSpacing: '1px' }}>
              --- KERTAS SOALAN TAMAT ---
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function JanaSoalanPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        <h2>Memuatkan Penjana Soalan...</h2>
      </div>
    }>
      <JanaSoalanContent />
    </Suspense>
  );
}