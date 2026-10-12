'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function StudentPortal() {
  const router = useRouter();
  
  // States untuk Carian Ujian
  const [activeTests, setActiveTests] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  
  const [filteredTests, setFilteredTests] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // States untuk Pendaftaran Pelajar
  const [studentName, setStudentName] = useState('');
  const [studentMatric, setStudentMatric] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchActiveTests();
  }, []);

  const fetchActiveTests = async () => {
    try {
      // Ambil ujian yang sedang aktif dan belum melepasi waktu tamat
      const { data, error } = await supabase
        .from('online_tests')
        .select('*')
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString());

      if (error) throw error;

      if (data) {
        setActiveTests(data);
        
        // Ekstrak senarai unik untuk Dropdown
        const uniqueFaculties = Array.from(new Set(data.map(t => t.faculty))).sort();
        setFaculties(uniqueFaculties as string[]);
      }
    } catch (err) {
      console.error("Gagal mengambil data ujian:", err);
    }
  };

  // Kemas kini senarai kursus apabila fakulti dipilih
  useEffect(() => {
    if (selectedFaculty) {
      const filteredCourses = activeTests
        .filter(t => t.faculty === selectedFaculty)
        .map(t => t.course_code);
      setCourses(Array.from(new Set(filteredCourses)).sort());
      setSelectedCourse('');
      setSelectedGroup('');
    } else {
      setCourses([]);
    }
  }, [selectedFaculty, activeTests]);

  // Kemas kini senarai kumpulan apabila kursus dipilih
  useEffect(() => {
    if (selectedCourse) {
      const filteredGroups = activeTests
        .filter(t => t.faculty === selectedFaculty && t.course_code === selectedCourse)
        .map(t => t.group_name);
      setGroups(Array.from(new Set(filteredGroups)).sort());
      setSelectedGroup('');
    } else {
      setGroups([]);
    }
  }, [selectedCourse, selectedFaculty, activeTests]);

  // Cari Ujian
  const handleSearchTest = () => {
    if (!selectedFaculty || !selectedCourse || !selectedGroup) {
      alert('Sila pilih Fakulti, Kod Kursus, dan Kumpulan anda.');
      return;
    }

    const matchedTests = activeTests.filter(t => 
      t.faculty === selectedFaculty && 
      t.course_code === selectedCourse && 
      t.group_name === selectedGroup
    );

    setFilteredTests(matchedTests);
  };

  // Pendaftaran Sesi Pelajar
  const handleRegisterSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentMatric.trim() || !selectedTest) {
      alert("Sila masukkan Nama Penuh dan No. Matrik anda.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Semak jika pelajar sudah ada sesi untuk ujian ini
      const { data: existingSession, error: fetchErr } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('test_id', selectedTest.id)
        .eq('student_matric', studentMatric)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let sessionId;

      if (existingSession) {
        // Jika ujian sudah tamat atau dibatalkan, sekat kemasukan
        if (existingSession.status === 'completed' || existingSession.status === 'terminated') {
          alert(`Maaf, status ujian anda adalah: ${existingSession.status.toUpperCase()}. Anda tidak dibenarkan masuk semula.`);
          setIsLoading(false);
          return;
        }
        sessionId = existingSession.id;
      } else {
        // 2. Cipta sesi baharu
        const { data: newSession, error: insertErr } = await supabase
          .from('test_sessions')
          .insert([{
            test_id: selectedTest.id,
            student_name: studentName.toUpperCase(),
            student_matric: studentMatric
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;
        sessionId = newSession.id;
      }

      // 3. Simpan Session ID di LocalStorage untuk sekuriti sementara dan Bawa ke Bilik Menunggu
      localStorage.setItem('abqari_student_session', sessionId);
      router.push(`/ujian/${selectedTest.id}/intro`);

    } catch (error: any) {
      alert(`Ralat pendaftaran: ${error.message}`);
      setIsLoading(false);
    }
  };

  const styles = {
    input: { width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc', marginBottom: '15px' },
    label: { fontSize: '0.9rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px', display: 'block' },
    card: { backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '600px', width: '100%', margin: '0 auto' }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ backgroundColor: '#3b0764', padding: '20px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#fde047', margin: 0, fontSize: '2rem', fontWeight: '900', letterSpacing: '1px' }}>ABQARI <span style={{color: 'white', fontWeight: '300'}}>| Ujian Online</span></h1>
        <p style={{ color: '#cbd5e1', margin: '5px 0 0 0', fontSize: '0.9rem' }}>Portal Pentaksiran Pelajar</p>
      </div>

      <div style={{ flex: 1, padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {!selectedTest ? (
          // LANGKAH 1: CARIAN UJIAN
          <div style={styles.card}>
            <h2 style={{ margin: '0 0 25px 0', color: '#0f172a', textAlign: 'center', fontSize: '1.5rem' }}>🔍 Cari Ujian Anda</h2>
            
            <label style={styles.label}>Fakulti / Program Pengajian</label>
            <select style={styles.input} value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}>
              <option value="">-- Pilih Fakulti --</option>
              {faculties.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label style={styles.label}>Kod Kursus</label>
            <select 
              style={styles.input} 
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)} 
              disabled={selectedFaculty === '' ? true : undefined}
            >
              <option value="">-- Pilih Kod Kursus --</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={styles.label}>Kumpulan</label>
            <select 
              style={styles.input} 
              value={selectedGroup} 
              onChange={(e) => setSelectedGroup(e.target.value)} 
              disabled={selectedCourse === '' ? true : undefined}
            >
              <option value="">-- Pilih Kumpulan --</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <button 
              onClick={handleSearchTest}
              style={{ width: '100%', padding: '15px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
            >
              Cari Ujian
            </button>

            {filteredTests.length > 0 && (
              <div style={{ marginTop: '30px', borderTop: '2px dashed #e2e8f0', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', color: '#475569', marginBottom: '15px' }}>Keputusan Carian:</h3>
                {filteredTests.map(test => (
                  <div 
                    key={test.id} 
                    onClick={() => setSelectedTest(test)}
                    style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '15px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '10px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#166534', fontSize: '1.1rem' }}>{test.course_code} - {test.test_name}</strong>
                      <span style={{ backgroundColor: '#16a34a', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>Dibuka</span>
                    </div>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#15803d' }}>👨‍🏫 Pensyarah: {test.lecturer_name}</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#15803d', fontWeight: 'bold' }}>👉 Klik di sini untuk meneruskan</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // LANGKAH 2: PENDAFTARAN PELAJAR
          <div style={styles.card}>
            <button 
              onClick={() => setSelectedTest(null)} 
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, marginBottom: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              ← Kembali
            </button>

            <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', marginBottom: '25px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#1e3a8a', fontSize: '1.1rem' }}>{selectedTest.test_name}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e40af' }}>{selectedTest.course_code} - {selectedTest.course_name} ({selectedTest.group_name})</p>
            </div>

            <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', textAlign: 'center', fontSize: '1.4rem' }}>Pendaftaran Calon</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', marginBottom: '25px' }}>Sila masukkan maklumat rasmi anda. Maklumat ini akan direkodkan bersama jawapan anda.</p>

            <form onSubmit={handleRegisterSession}>
              <label style={styles.label}>Nama Penuh</label>
              <input 
                type="text" 
                required 
                style={styles.input} 
                placeholder="Cth: AHMAD BIN ABDULLAH" 
                value={studentName} 
                onChange={e => setStudentName(e.target.value.toUpperCase())} 
              />

              <label style={styles.label}>Nombor Matrik</label>
              <input 
                type="text" 
                required 
                style={styles.input} 
                placeholder="Cth: 2023123456" 
                value={studentMatric} 
                onChange={e => setStudentMatric(e.target.value)} 
              />

              <button 
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', padding: '15px', backgroundColor: '#be185d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '15px' }}
              >
                {isLoading ? 'Mengesahkan Maklumat...' : 'Seterusnya →'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}