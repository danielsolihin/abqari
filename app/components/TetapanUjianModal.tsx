'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TetapanUjianModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedQuestions: any[]; // Senarai soalan yang telah dijana oleh AI
  courseCode: string;
  testName: string;
  groupName: string;
  semester: string;
  lecturerName: string;
}

export default function TetapanUjianModal({
  isOpen,
  onClose,
  generatedQuestions = [],
  courseCode,
  testName,
  groupName,
  semester,
  lecturerName
}: TetapanUjianModalProps) {
  // 1. AUTO-CAPTURE JUMLAH SOALAN
  const autoTotalQuestions = generatedQuestions.length || 0;

  // STATE TETAPAN UJIAN
  const [instructions, setInstructions] = useState('Sila jawab semua soalan. Dilarang merujuk sebarang bahan luar semasa ujian dijalankan.');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [maxAttempts, setMaxAttempts] = useState(1); // MEDAN BIL. PERCUBAAN
  const [displayStyle, setDisplayStyle] = useState('all_in_one');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [strictProctoring, setStrictProctoring] = useState(true);
  const [faceTracking, setFaceTracking] = useState(true);

  // STATE PAUTAN UJIAN
  const [testId, setTestId] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    // Sediakan nilai awal tarikh & masa
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 hari dari sekarang
    
    setStartTime(now.toISOString().slice(0, 16));
    setEndTime(future.toISOString().slice(0, 16));
  }, []);

  if (!isOpen) return null;

  // FUNGSI MENERBITKAN UJIAN & MENJANA PAUTAN
  const handlePublishTest = async () => {
    setIsPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const newTestPayload = {
        user_id: user?.id,
        course_code: courseCode || 'UMUM',
        test_name: testName || 'Ujian Dalam Talian',
        group_name: groupName || 'Umum',
        semester: semester || 'Semester 1',
        lecturer_name: lecturerName || 'Pensyarah',
        instructions,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: Number(durationMinutes),
        total_questions: autoTotalQuestions, // AUTO CAPTURED
        max_attempts: Number(maxAttempts),   // BERFUNGSI UNTUK HAD PERCUBAAN
        display_style: displayStyle,
        shuffle_questions: shuffleQuestions,
        strict_proctoring: strictProctoring,
        face_tracking: faceTracking,
        questions_data: { questions: generatedQuestions },
        status: 'published'
      };

      const { data, error } = await supabase.from('online_tests').insert([newTestPayload]).select().single();

      if (error) throw error;

      if (data) {
        setTestId(data.id);
        const generatedLink = `${window.location.origin}/ujian/${data.id}`;
        setTestUrl(generatedLink);
        alert('🚀 Ujian berjaya diterbitkan! Pautan ujian telah dijana.');
      }
    } catch (err: any) {
      alert(`Gagal menerbitkan ujian: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (!testUrl) return;
    navigator.clipboard.writeText(testUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const styles = {
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    card: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', fontFamily: '"Inter", sans-serif' },
    header: { backgroundColor: '#be185d', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' },
    headerTitle: { margin: 0, fontSize: '1.15rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }, // FON DINIPISKAN
    body: { padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '20px' },
    sectionBox: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' },
    sectionTitle: { margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: '600', color: '#be185d', display: 'flex', alignItems: 'center', gap: '6px' }, // FON DINIPISKAN
    label: { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: '#475569', marginBottom: '6px' }, // FON DINIPISKAN (500)
    input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', color: '#0f172a', backgroundColor: 'white', outlineColor: '#be185d', boxSizing: 'border-box' as const },
    checkboxLabel: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', fontWeight: '500', color: '#334155', cursor: 'pointer', marginBottom: '10px' },
    footer: { padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' },
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        
        {/* HEADER MODAL */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>🌐 Tetapan Ujian Dalam Talian</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={styles.body}>
          
          {/* SEKSYEN 1: ARAHAN KEPADA CALON */}
          <div style={styles.sectionBox}>
            <label style={styles.label}>Arahan Kepada Calon (Pilihan / Optional)</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              style={{ ...styles.input, resize: 'vertical' }}
              placeholder="Masukkan arahan ujian..."
            />
          </div>

          {/* SEKSYEN 2: MASA, PERCUBAAN & BILANGAN SOALAN */}
          <div style={styles.sectionBox}>
            <h3 style={styles.sectionTitle}>⏱️ Masa, Percubaan & Bilangan Soalan</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={styles.label}>Tarikh & Masa Dibuka</label>
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={styles.input} />
              </div>
              <div>
                <label style={styles.label}>Tarikh & Masa Ditutup</label>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={styles.input} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={styles.label}>Had Masa (Minit)</label>
                <input type="number" min={5} max={360} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} style={styles.input} />
              </div>

              {/* MEDAN AUTO-CAPTURE JUMLAH SOALAN */}
              <div>
                <label style={styles.label}>Jumlah Soalan (Auto)</label>
                <input 
                  type="number" 
                  value={autoTotalQuestions} 
                  readOnly 
                  style={{ ...styles.input, backgroundColor: '#f1f5f9', color: '#be185d', fontWeight: '600', cursor: 'not-allowed' }} 
                  title="Diimbas secara automatik daripada senarai soalan yang dijana"
                />
              </div>

              {/* MEDAN HAD BILANGAN PERCUBAAN (BERFUNGSI) */}
              <div>
                <label style={styles.label}>Bil. Percubaan</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={maxAttempts} 
                  onChange={(e) => setMaxAttempts(Number(e.target.value))} 
                  style={styles.input} 
                />
                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                  * 1 = Sekali sahaja
                </span>
              </div>
            </div>
          </div>

          {/* SEKSYEN 3: TETAPAN PAPARAN & KESELAMATAN */}
          <div style={styles.sectionBox}>
            <h3 style={styles.sectionTitle}>⚙️ Tetapan Paparan & Keselamatan</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={styles.label}>Gaya Paparan Soalan</label>
              <select value={displayStyle} onChange={(e) => setDisplayStyle(e.target.value)} style={styles.input}>
                <option value="all_in_one">Semua Sebaris (Satu Halaman Penuh)</option>
                <option value="one_by_one">Satu Per Satu (Satu Soalan Setiap Halaman)</option>
              </select>
            </div>

            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} style={{ marginTop: '2px', cursor: 'pointer' }} />
              <div>
                <span style={{ color: '#0f172a', fontWeight: '500' }}>Susun Atur Rawak (Reshuffle Soalan & Pilihan Jawapan)</span>
              </div>
            </label>

            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={strictProctoring} onChange={(e) => setStrictProctoring(e.target.checked)} style={{ marginTop: '2px', cursor: 'pointer' }} />
              <div>
                <span style={{ color: '#0f172a', fontWeight: '500' }}>Aktifkan Pengawasan Ketat (Strict Proctoring)</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '400' }}>Halang Copy-Paste, pengesanan Tab dilarang, dan wajibkan Skrin Penuh (Fullscreen).</p>
              </div>
            </label>

            <label style={{ ...styles.checkboxLabel, marginBottom: 0 }}>
              <input type="checkbox" checked={faceTracking} onChange={(e) => setFaceTracking(e.target.checked)} style={{ marginTop: '2px', cursor: 'pointer' }} />
              <div>
                <span style={{ color: '#0f172a', fontWeight: '500' }}>Aktifkan Pemantauan Kamera AI (Face Tracking)</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '400' }}>Mewajibkan akses webcam pelajar. Sistem akan merakam pergerakan muka dan memberi amaran jika wajah tidak dikesan.</p>
              </div>
            </label>
          </div>

          {/* SEKSYEN 4 (BAHARU): PAUTAN AKSES UJIAN PELAJAR */}
          <div style={{ ...styles.sectionBox, backgroundColor: testUrl ? '#f0fdf4' : '#f8fafc', borderColor: testUrl ? '#86efac' : '#e2e8f0' }}>
            <h3 style={{ ...styles.sectionTitle, color: testUrl ? '#166534' : '#be185d' }}>
              🔗 Pautan Akses Ujian Pelajar
            </h3>
            
            {testUrl ? (
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#15803d', fontWeight: '500' }}>
                  Pautan ujian telah sedia! Salin dan kongsikan pautan ini kepada pelajar anda:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={testUrl} readOnly style={{ ...styles.input, backgroundColor: '#white', color: '#0f172a', fontWeight: '500' }} />
                  <button 
                    type="button"
                    onClick={handleCopyLink} 
                    style={{ padding: '8px 16px', backgroundColor: isCopied ? '#16a34a' : '#15803d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {isCopied ? '✅ Tersalin!' : '📋 Salin Pautan'}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                * Pautan rasmi ujian akan dijana secara automatik sebaik sahaja anda menekan butang "Terbitkan Ujian Sekarang".
              </p>
            )}
          </div>

        </div>

        {/* FOOTER MODAL */}
        <div style={styles.footer}>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '8px 18px', borderRadius: '8px', color: '#475569', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Batal
          </button>
          
          <button 
            type="button" 
            onClick={handlePublishTest} 
            disabled={isPublishing} 
            style={{ backgroundColor: '#be185d', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '500', cursor: isPublishing ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isPublishing ? '⏳ Menerbitkan...' : '🚀 Terbitkan Ujian Sekarang'}
          </button>
        </div>

      </div>
    </div>
  );
}