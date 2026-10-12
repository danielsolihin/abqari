'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function WaitingRoom() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [testData, setTestData] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWaitingRoomData = async () => {
      try {
        const sessionId = localStorage.getItem('abqari_student_session');
        
        if (!sessionId) {
          alert('Sesi tidak sah. Sila daftar masuk dari halaman utama.');
          router.push('/ujian');
          return;
        }

        // Ambil Maklumat Sesi Pelajar
        const { data: session, error: sessionErr } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionErr || !session) throw new Error('Sesi pelajar tidak dijumpai.');
        
        if (session.status === 'completed' || session.status === 'terminated') {
          alert(`Ujian ini telah ditutup untuk anda. Status: ${session.status.toUpperCase()}`);
          router.push('/ujian');
          return;
        }
        setSessionData(session);

        // Ambil Maklumat Ujian
        const { data: test, error: testErr } = await supabase
          .from('online_tests')
          .select('*')
          .eq('id', testId)
          .single();

        if (testErr || !test) throw new Error('Ujian tidak dijumpai.');
        setTestData(test);

      } catch (error: any) {
        alert(error.message);
        router.push('/ujian');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWaitingRoomData();
  }, [testId, router]);

  const handleStartTest = () => {
    const confirmStart = window.confirm("Adakah anda bersedia? Masa akan mula dikira sebaik sahaja anda menekan OK.");
    if (confirmStart) {
      router.push(`/ujian/${testId}/live`);
    }
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}><h3>Memuatkan Bilik Menunggu...</h3></div>;
  }

  const styles = {
    card: { backgroundColor: 'white', padding: '35px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '750px', width: '100%', margin: '40px auto' },
    label: { color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' as 'uppercase', fontWeight: 'bold' as 'bold', margin: '0 0 4px 0' },
    value: { color: '#0f172a', fontSize: '1.1rem', fontWeight: 'bold' as 'bold', margin: '0 0 15px 0' }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
      <div style={styles.card}>
        
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
            <p style={{...styles.value, marginBottom: 0}}>{testData?.group_name}</p>
          </div>

          <div style={{ flex: '1 1 300px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #16a34a' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#166534', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📑 Maklumat Ujian</h3>
            <p style={styles.label}>Kursus</p>
            <p style={styles.value}>{testData?.course_code} - {testData?.course_name}</p>
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
            <li style={{ marginBottom: '8px' }}>DILARANG membuka tab/tetingkap pelayar lain. Sistem sedang merekod pergerakan skrin anda. Amaran lebih 3 kali akan menyebabkan ujian <strong>ditamatkan secara paksa</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Fungsi <i>Copy-Paste</i> dan klik kanan (right-click) telah dinyahaktifkan.</li>
            <li>Jawapan akan dihantar secara automatik sebaik sahaja pemasa tamat.</li>
          </ul>
        </div>

        <button 
          onClick={handleStartTest}
          style={{ width: '100%', padding: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)' }}
        >
          Mula Jawab Soalan 🚀
        </button>

      </div>
    </div>
  );
}