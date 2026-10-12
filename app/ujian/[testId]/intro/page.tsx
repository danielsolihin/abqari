'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function IntroAndRegistration() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [testData, setTestData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // DATA BORANG PELAJAR
  const [studentName, setStudentName] = useState('');
  const [studentMatric, setStudentMatric] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Semak jika pelajar sudah daftar (ada session di localStorage)
  const [hasSession, setHasSession] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [displayGroup, setDisplayGroup] = useState('');

  useEffect(() => {
    const fetchTestDataAndSession = async () => {
      try {
        // Ambil Maklumat Ujian
        const { data: test, error: testErr } = await supabase
          .from('online_tests')
          .select('*')
          .eq('id', testId)
          .single();

        if (testErr || !test) throw new Error('Pautan tidak sah atau ujian telah dipadamkan.');
        setTestData(test);

        // PECAHKAN SENARAI KUMPULAN (String ke Array)
        if (test.group_name) {
          const groups = test.group_name.split(',').map((g: string) => g.trim()).filter(Boolean);
          setAvailableGroups(groups);
          if (groups.length === 1) {
            setSelectedGroup(groups[0]); // Jika hanya ada 1 kumpulan, terus pilih automatik
          }
        }

        // Semak jika pelajar sedang menggunakan peranti yang sama dan sudah ada sesi
        const existingSessionId = localStorage.getItem('abqari_student_session');
        const existingGroup = localStorage.getItem('abqari_student_group');
        
        if (existingGroup) setDisplayGroup(existingGroup);

        if (existingSessionId) {
          const { data: session, error: sessionErr } = await supabase
            .from('test_sessions')
            .select('*')
            .eq('id', existingSessionId)
            .single();

          if (session && !sessionErr) {
            if (session.test_id === testId) {
              setSessionData(session);
              setHasSession(true);
            } else {
              // Pelajar klik pautan ujian lain, kosongkan sesi lama
              localStorage.removeItem('abqari_student_session');
              localStorage.removeItem('abqari_student_group');
            }
          }
        }

      } catch (error: any) {
        alert(error.message);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTestDataAndSession();
  }, [testId, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi Asas
    if (!studentName.trim() || !studentMatric.trim()) {
      alert("Sila isi Nama Penuh dan Nombor Matrik.");
      return;
    }

    // VALIDASI KETAT: NOMBOR MATRIK MINIMUM 10 AKSARA
    if (studentMatric.trim().length < 10) {
      alert("Ralat Pendaftaran:\nNombor Matrik / Kad Pelajar anda tidak sah. Sila masukkan sekurang-kurangnya 10 aksara/digit (Contoh: 2026123456).");
      return;
    }

    if (availableGroups.length > 0 && !selectedGroup) {
      alert("Sila pilih kumpulan anda dari senarai.");
      return;
    }

    // Semak Waktu Ujian (Terlalu awal atau Tamat Tempoh)
    const now = new Date();
    const startTime = new Date(testData.start_time);
    const endTime = new Date(testData.end_time);

    if (now < startTime) {
      alert(`Ujian ini belum dibuka. Ujian hanya bermula pada:\n${startTime.toLocaleString()}`);
      return;
    }

    if (now > endTime) {
      alert("Ujian ini telah ditutup. Sila hubungi pensyarah anda.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Semak jika nombor matrik sudah mengambil ujian (Elak penipuan kali ke-2)
      const { data: pastSessions } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('test_id', testId)
        .eq('student_matric', studentMatric.trim());

      if (pastSessions && pastSessions.length >= (testData.settings?.maxAttempts || 1)) {
        alert("Anda telah mencapai had percubaan maksimum untuk ujian ini.");
        setIsSubmitting(false);
        return;
      }

      // 2. Daftar sesi pelajar baharu ke pangkalan data
      // Nota: Dibuang lajur 'violation_count' supaya mematuhi skema asal jadual pangkalan data
      const { data: newSession, error: createErr } = await supabase
        .from('test_sessions')
        .insert([{
          test_id: testId,
          student_name: studentName.trim(), // Nama telah dihurufbesarkan secara automatik oleh input
          student_matric: studentMatric.trim(),
          status: 'ongoing'
        }])
        .select()
        .single();

      if (createErr || !newSession) {
        throw new Error(`Gagal mencipta sesi pendaftaran. Mesej Ralat Supabase: ${createErr?.message || 'Tiada Mesej'}`);
      }

      // 3. Simpan Session ID dan Group di LocalStorage
      localStorage.setItem('abqari_student_session', newSession.id);
      localStorage.setItem('abqari_student_group', selectedGroup || testData?.group_name || '');
      
      setSessionData(newSession);
      setDisplayGroup(selectedGroup || testData?.group_name || '');
      setHasSession(true);

    } catch (error: any) {
      alert(`Ralat Pendaftaran:\n${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTest = () => {
    // Halang jika telah tamat
    if (sessionData?.status === 'completed' || sessionData?.status === 'terminated') {
      alert(`Ujian ini telah ditutup untuk anda. Status: ${sessionData.status.toUpperCase()}`);
      return;
    }

    const confirmStart = window.confirm("Adakah anda bersedia? Masa akan mula dikira sebaik sahaja anda menekan OK.");
    if (confirmStart) {
      router.push(`/ujian/${testId}/live`);
    }
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}><h3>Memuatkan Sistem Ujian...</h3></div>;
  }

  const styles = {
    card: { backgroundColor: 'white', padding: '35px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '750px', width: '100%', margin: '40px auto' },
    label: { color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' as 'uppercase', fontWeight: 'bold' as 'bold', margin: '0 0 4px 0', display: 'block' },
    value: { color: '#0f172a', fontSize: '1.1rem', fontWeight: 'bold' as 'bold', margin: '0 0 15px 0' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc', marginBottom: '20px' }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
      <div style={styles.card}>
        
        {/* ============================================================ */}
        {/* PAPARAN 1: BORANG PENDAFTARAN (JIKA BELUM ADA SESI) */}
        {/* ============================================================ */}
        {!hasSession ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px' }}>
              <span style={{ fontSize: '3rem' }}>📝</span>
              <h1 style={{ margin: '10px 0 5px 0', color: '#1e3a8a' }}>Pendaftaran Calon Ujian</h1>
              <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>Sila lengkapkan butiran diri anda dengan tepat.</p>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={styles.label}>Tajuk Ujian</p>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#1e40af' }}>{testData?.test_name}</p>
              </div>
              <div>
                <p style={styles.label}>Kursus</p>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#1e40af' }}>{testData?.course_code}</p>
              </div>
            </div>

            <form onSubmit={handleRegister}>
              <div>
                <label style={styles.label}>Nama Penuh (Seperti dalam Kad Pengenalan)</label>
                <input 
                  type="text" 
                  required 
                  value={studentName} 
                  onChange={(e) => setStudentName(e.target.value.toUpperCase())} // KEMASKINI: Auto Huruf Besar
                  style={styles.input} 
                  placeholder="Cth: AHMAD BIN ALI"
                />
              </div>

              <div>
                <label style={styles.label}>Nombor Matrik / Kad Pelajar</label>
                <input 
                  type="text" 
                  required 
                  value={studentMatric} 
                  onChange={(e) => setStudentMatric(e.target.value)} 
                  style={styles.input} 
                  placeholder="Cth: 2026123456" // KEMASKINI: Wajib 10 digit ke atas
                />
              </div>

              {availableGroups.length > 0 && (
                <div>
                  <label style={styles.label}>Kumpulan Kuliah (Kelas)</label>
                  <select 
                    required 
                    value={selectedGroup} 
                    onChange={(e) => setSelectedGroup(e.target.value)} 
                    style={styles.input}
                  >
                    <option value="">-- Sila Pilih Kumpulan Anda --</option>
                    {availableGroups.map((group, index) => (
                      <option key={index} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: '10px' }}
              >
                {isSubmitting ? 'Mendaftar...' : 'Daftar Masuk & Sahkan Kehadiran'}
              </button>
            </form>
          </>
        ) : (
          
          /* ============================================================ */
          /* PAPARAN 2: BILIK MENUNGGU (JIKA SESI SUDAH WUJUD) */
          /* ============================================================ */
          <>
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px' }}>
              <span style={{ fontSize: '3rem' }}>⏳</span>
              <h1 style={{ margin: '10px 0 5px 0', color: '#1e3a8a' }}>Bilik Menunggu</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Sila semak butiran anda sebelum memulakan ujian.</p>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
              <div style={{ flex: '1 1 300px', backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#1e40af', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>👤 Maklumat Calon</h3>
                <p style={styles.label}>Nama Penuh</p>
                <p style={styles.value}>{sessionData?.student_name}</p>
                <p style={styles.label}>Nombor Matrik</p>
                <p style={styles.value}>{sessionData?.student_matric}</p>
                <p style={styles.label}>Kumpulan</p>
                <p style={{...styles.value, marginBottom: 0}}>{displayGroup}</p>
              </div>

              <div style={{ flex: '1 1 300px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #16a34a' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#166534', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📑 Maklumat Ujian</h3>
                <p style={styles.label}>Kursus</p>
                <p style={styles.value}>{testData?.course_code} {testData?.course_name}</p>
                <p style={styles.label}>Tajuk Ujian</p>
                <p style={styles.value}>{testData?.test_name}</p>
                <p style={styles.label}>Had Masa Menjawab</p>
                <p style={{...styles.value, marginBottom: 0, color: '#b91c1c'}}>{testData?.duration_minutes} Minit</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff1f2', padding: '25px', borderRadius: '12px', border: '1px solid #fecdd3', marginBottom: '30px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#be185d', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ ARAHAN KESELAMATAN (PROCTORING)
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#9f1239', lineHeight: '1.6', fontSize: '0.95rem' }}>
                <li style={{ marginBottom: '8px' }}>Anda diwajibkan menjawab ujian ini dalam mod <strong>Skrin Penuh (Fullscreen)</strong>.</li>
                {testData?.settings?.strictProctoring && (
                  <>
                    <li style={{ marginBottom: '8px' }}>DILARANG membuka tab/tetingkap pelayar lain. Sistem sedang merekod pergerakan skrin anda. Amaran lebih 3 kali akan menyebabkan ujian <strong>ditamatkan secara paksa</strong>.</li>
                    <li style={{ marginBottom: '8px' }}>Fungsi <i>Copy-Paste</i> dan klik kanan (right-click) telah dinyahaktifkan.</li>
                  </>
                )}
                {testData?.settings?.requireWebcam && (
                  <li style={{ marginBottom: '8px' }}>Sistem pemantauan kamera (Webcam) diaktifkan. Wajah anda akan dirakam dan dianalisis secara berterusan.</li>
                )}
                <li>Jawapan akan dihantar secara automatik sebaik sahaja pemasa tamat.</li>
              </ul>
            </div>

            <button 
              onClick={handleStartTest}
              style={{ width: '100%', padding: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)' }}
            >
              Mula Jawab Soalan 🚀
            </button>
          </>
        )}
      </div>
    </div>
  );
}