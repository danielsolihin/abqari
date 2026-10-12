'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// ENJIN BUNYI AMARAN (FALLBACK KEPADA WEB AUDIO SYNTHESIZER)
// ============================================================
const playWarningSound = () => {
  try {
    const audio = new Audio('/warning-sound.mp3');
    audio.play().catch(() => {
      playSynthBeep();
    });
  } catch (e) {
    playSynthBeep();
  }
};

const playSynthBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(1000, ctx.currentTime);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 250);
  } catch (err) {
    console.warn("Ralat Audio Context:", err);
  }
};

// ============================================================
// KOMPONEN KAMERA: TENSORFLOW.JS BLAZEFACE (REAL AI TRACKING)
// ============================================================
interface ProctoringCameraProps {
  onWarning: (reason: string) => void;
}

function ProctoringCamera({ onWarning }: ProctoringCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [aiLoaded, setAiLoaded] = useState(false);
  const [faceMissing, setFaceMissing] = useState(false);
  const missingCountRef = useRef(0);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  const initAIAndCamera = async () => {
    setHasError(false);
    setErrorMessage('');
    setStreamActive(false);

    let currentStream: MediaStream | null = null;
    let model: any = null;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240, facingMode: 'user' } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          setStreamActive(true);
        }
      } else {
        throw new Error("Kamera tidak disokong pada pelayar ini.");
      }

      if (!(window as any).tf) {
        await new Promise<void>((resolve, reject) => {
          const scriptTF = document.createElement('script');
          scriptTF.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
          scriptTF.onload = () => {
            const scriptBlaze = document.createElement('script');
            scriptBlaze.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface";
            scriptBlaze.onload = () => resolve();
            scriptBlaze.onerror = reject;
            document.body.appendChild(scriptBlaze);
          };
          scriptTF.onerror = reject;
          document.body.appendChild(scriptTF);
        });
      }

      model = await (window as any).blazeface.load();
      setAiLoaded(true);

      const intervalId = setInterval(async () => {
        if (videoRef.current && model && videoRef.current.readyState === 4) {
          try {
            const predictions = await model.estimateFaces(videoRef.current, false);
            
            if (predictions.length === 0) {
              missingCountRef.current += 1;
              setFaceMissing(true);

              if (missingCountRef.current >= 15) {
                setTimeout(() => {
                  onWarningRef.current('Wajah tidak dikesan di hadapan kamera melebihi 15 saat.');
                }, 0);
                missingCountRef.current = 0;
              }
            } else {
              missingCountRef.current = 0;
              setFaceMissing(false);
            }
          } catch (e) {
            // Abaikan ralat bingkai kamera sementara
          }
        }
      }, 1000);

      return () => {
        clearInterval(intervalId);
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
        }
      };

    } catch (err: any) {
      console.error("Ralat Kamera/AI:", err);
      setHasError(true);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Akses kamera dihalang. Sila benarkan akses kamera pada bar URL pelayar.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('Tiada peranti kamera dikesan pada komputer ini.');
      } else {
        setErrorMessage(err.message || 'Gagal mengakses kamera webkam.');
      }
    }
  };

  useEffect(() => {
    let cleanupFn: any;
    initAIAndCamera().then(fn => { cleanupFn = fn; });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '30px',   
      width: '210px',
      backgroundColor: '#0f172a',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
      border: hasError ? '2px solid #ef4444' : faceMissing ? '2px solid #f59e0b' : '2px solid #10b981',
      zIndex: 9999,
      transition: 'all 0.3s ease'
    }}>
      <div style={{ padding: '6px 10px', backgroundColor: '#1e293b', color: 'white', fontSize: '0.725rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', backgroundColor: faceMissing ? '#f59e0b' : streamActive ? '#22c55e' : '#ef4444', borderRadius: '50%', display: 'inline-block', animation: faceMissing ? 'blink 1s infinite' : 'none' }}></span>
          PEMANTAUAN AI
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>🔴 LIVE</span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '130px', backgroundColor: '#000' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: faceMissing ? 0.3 : 1 }} 
        />

        {!aiLoaded && !hasError && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <div style={{ width: '20px', height: '20px', border: '3px solid #38bdf8', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '8px' }}></div>
            <span style={{ fontSize: '0.7rem' }}>Memuatkan AI...</span>
          </div>
        )}

        {streamActive && aiLoaded && !hasError && !faceMissing && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '100px', border: '2px dashed rgba(34, 197, 94, 0.7)', borderRadius: '50%', pointerEvents: 'none' }} />
        )}

        {faceMissing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(245, 158, 11, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fcd34d', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            <span style={{ fontSize: '2rem' }}>👤❓</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center' }}>Sila pandang skrin!</span>
          </div>
        )}

        {hasError && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center', fontSize: '0.725rem', zIndex: 10 }}>
            <span style={{ fontWeight: 'bold' }}>⚠️ Kamera Ralat</span>
            <span style={{ fontSize: '0.625rem', marginTop: '4px', lineHeight: '1.2' }}>{errorMessage}</span>
            <button 
              onClick={initAIAndCamera} 
              style={{ marginTop: '8px', padding: '4px 10px', backgroundColor: 'white', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.65rem', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
            >
              🔄 Cuba Akses Semula
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '6px 8px', backgroundColor: '#0f172a', textAlign: 'center' }}>
        <span style={{ color: faceMissing ? '#f59e0b' : '#94a3b8', fontSize: '0.65rem', fontWeight: faceMissing ? 'bold' : 'normal' }}>
          {hasError ? 'Kamera tergendala' : faceMissing ? '⚠️ Wajah tidak dikesan' : 'Wajah anda sedang dirakam'}
        </span>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ============================================================
// FUNGSI MEMBACA SOALAN & PEMBERSIHAN TAG JSU MUTLAK
// ============================================================
function parseQuestions(rawText: string) {
  if (!rawText) return [];
  const rawBlocks = rawText.split(/(?=(?:^|\n)\s*(?:BAHAGIAN|PART|الجزء)?\s*[A-Z]?:?\s*\n*\s*\d+[\.\)]\s*)/gi);
  const questionsList: any[] = [];
  
  const jsuRegex = /\\?\[\s*(?:Aras\vert{}Level\vert{}Aras Bloom\vert{}CO\d*\vert{}CLO\d*\vert{}LO\d*\vert{}PO\d*\vert{}PLO\d*\vert{}C[1-6]\vert{}P[1-5]\vert{}A[1-5]\vert{}Domain\vert{}Rujukan\vert{}Topik)[^\]]*\\?\]/gi;
  const generalTagRegex = /\\?\[\s*[A-Z0-9\s:]+\s*\\?\]/gi;

  rawBlocks.forEach((block) => {
    const cleanBlock = block.replace(/^(?:BAHAGIAN|PART|الجزء)\s+[A-Z]:?\s*/gi, '').trim();
    if (/^\d+[\.\)]/i.test(cleanBlock)) {
      
      let textWithoutTag = cleanBlock.replace(jsuRegex, '').replace(generalTagRegex, '').trim();

      const optionsMatch = textWithoutTag.split(/\n\s*([A-D][\.\)])\s*/);
      let questionMainText = textWithoutTag;
      const options = [];

      if (optionsMatch.length > 1) {
        questionMainText = optionsMatch[0].trim();
        for (let i = 1; i < optionsMatch.length; i += 2) {
          const optLabel = optionsMatch[i].trim();
          let optText = optionsMatch[i+1] ? optionsMatch[i+1].trim() : '';
          
          optText = optText.replace(jsuRegex, '').replace(generalTagRegex, '').trim();
          optText = optText.replace(/(\s*\[.*?\])+\s*$/g, '').trim();
          
          options.push({ label: optLabel, text: optText });
        }
      } else {
        questionMainText = questionMainText
          .replace(jsuRegex, '')
          .replace(generalTagRegex, '')
          .replace(/(\s*\[.*?\])+\s*$/gm, '')
          .trim();
      }

      questionsList.push({
        fullText: cleanBlock,
        stem: questionMainText,
        options: options
      });
    }
  });
  return questionsList;
}

export default function LiveExamRoom() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [testData, setTestData] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  // STATE NAVIGASI UNTUK MOD SINGLE / ONE_BY_ONE
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); 
  
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. MEMUATKAN DATA UJIAN & SESI
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const sessionId = localStorage.getItem('abqari_student_session');
        if (!sessionId) throw new Error('Sesi tidak sah.');

        const { data: session, error: sessionErr } = await supabase.from('test_sessions').select('*').eq('id', sessionId).single();
        if (sessionErr || !session) throw new Error('Ralat sesi pelajar.');
        if (session.status !== 'ongoing') {
          alert('Ujian ini telah ditamatkan.');
          window.location.href = '/ujian'; return;
        }
        setSessionData(session);
        setWarningCount(session.warning_count || 0);

        const { data: test, error: testErr } = await supabase.from('online_tests').select('*').eq('id', testId).single();
        if (testErr || !test) throw new Error('Ujian tidak dijumpai.');
        setTestData(test);

        const parsedQ = parseQuestions(test.questions_data?.rawText || '');
        setQuestions(parsedQ);

        const durationSeconds = (test.duration_minutes || 60) * 60;
        const startTime = new Date(session.started_at).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = durationSeconds - elapsedSeconds;
        
        if (remaining <= 0) {
          handleForceSubmit('Masa Telah Tamat.');
        } else {
          setTimeLeft(remaining);
        }

        const { data: savedAns } = await supabase.from('test_answers').select('question_index, answer_text').eq('session_id', sessionId);
        if (savedAns) {
          const ansMap: Record<number, string> = {};
          savedAns.forEach(a => { ansMap[a.question_index] = a.answer_text; });
          setAnswers(ansMap);
        }

      } catch (error: any) {
        alert(error.message);
        window.location.href = '/ujian';
      }
    };
    fetchExamData();
  }, [testId]);

  const handleStartExam = () => {
    enterFullscreen();
    setHasStarted(true);
  };

  // 2. SISTEM PENGIRAAN MASA (TIMER)
  useEffect(() => {
    if (!hasStarted || timeLeft <= 0 || isSubmitting) return; 
    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleForceSubmit('Masa Telah Tamat. Ujian dihantar secara automatik.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [hasStarted, timeLeft, isSubmitting]);

  // 3. ENJIN PROCTORING KESELAMATAN (TAB-SWITCHING)
  useEffect(() => {
    if (!hasStarted || !testData?.settings?.strictProctoring || isSubmitting) return;

    const handleVisibilityChange = () => { if (document.hidden) handleWarning('Keluar dari tetingkap peperiksaan (Tab-Switch).'); };
    const handleWindowBlur = () => {
      if (!document.hidden) {
        if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = setTimeout(() => { handleWarning('Tetingkap hilang fokus (Aplikasi lain dibuka).'); }, 1000);
      }
    };
    const handleWindowFocus = () => { if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current); };
    const handleContextMenu = (e: Event) => e.preventDefault(); 
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'p'].includes(e.key.toLowerCase())) { e.preventDefault(); alert('Dinyahaktifkan untuk peperiksaan.'); }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasStarted, testData, warningCount, isSubmitting]);

  // FUNGSI PUSAT AMARAN
  const handleWarning = async (reason: string) => {
    if (isSubmitting) return;
    const newCount = warningCount + 1;
    setWarningCount(newCount);
    
    try {
      await supabase.from('test_sessions').update({ warning_count: newCount }).eq('id', sessionData?.id);
      if (newCount >= 3) {
        handleForceSubmit(`Ujian ditamatkan akibat amaran pelanggaran melebihi had (${reason}).`);
      } else {
        setShowWarningModal(true);
        playWarningSound();
      }
    } catch (e) {}
  };

  const enterFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); }
  };

  // 4. SIMPAN JAWAPAN SECARA LIVE
  const handleSelectAnswer = async (qIndex: number, optionLetter: string) => {
    const newAnswers = { ...answers, [qIndex]: optionLetter };
    setAnswers(newAnswers);

    try {
      const { data: existing } = await supabase.from('test_answers').select('id').eq('session_id', sessionData.id).eq('question_index', qIndex).maybeSingle();
      if (existing) {
        await supabase.from('test_answers').update({ answer_text: optionLetter, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('test_answers').insert([{ session_id: sessionData.id, question_index: qIndex, answer_text: optionLetter }]);
      }
    } catch (e) {}
  };

  // 5. HANTAR UJIAN
  const handleForceSubmit = async (reason: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    alert(reason);
    await completeTest(reason.includes('pelanggaran') || reason.includes('menipu') ? 'terminated' : 'completed');
  };

  const handleManualSubmitClick = () => {
    const unAnswered = questions.length - Object.keys(answers).length;
    let msg = unAnswered > 0 
      ? `Terdapat ${unAnswered} soalan yang belum dijawab. Anda pasti mahu menghantar ujian ini sekarang?` 
      : `Hantar ujian sekarang? Anda tidak boleh menukar jawapan selepas ini.`;
    setSubmitMsg(msg);
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
    setIsSubmitting(true);
    await completeTest('completed');
  };

  const completeTest = async (finalStatus: string) => {
    try {
      await supabase.from('test_sessions').update({ status: finalStatus, completed_at: new Date().toISOString() }).eq('id', sessionData?.id);
      if (document.fullscreenElement) { document.exitFullscreen().catch(()=>{}); }
      localStorage.removeItem('abqari_student_session');
      
      window.location.href = '/ujian/selesai'; 
    } catch (e) {
      alert("Gagal menghantar rekod.");
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!testData || !sessionData) return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Memuatkan Dewan Peperiksaan...</div>;

  // PAPARAN PERANTARA
  if (!hasStarted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '500px' }}>
          <span style={{ fontSize: '4rem' }}>🎓</span>
          <h2 style={{ color: '#0f172a', marginBottom: '10px' }}>Sedia untuk bermula?</h2>
          <p style={{ color: '#475569', marginBottom: '30px', lineHeight: '1.6' }}>
            Ujian ini akan dijalankan dalam mod <strong>Skrin Penuh (Fullscreen)</strong>. Anda dilarang membuka sebarang tab atau aplikasi lain setelah mula.
          </p>
          <button onClick={handleStartExam} style={{ backgroundColor: '#2563eb', color: 'white', padding: '15px 30px', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)' }}>
            Masuk Dewan Ujian
          </button>
        </div>
      </div>
    );
  }

  // PENENTUAN GAYA PAPARAN SOALAN (BACA DARIPADA SEMUA LOKASI REKOD TETAPAN)
  const displayMode = testData?.display_style || testData?.settings?.display_style || testData?.settings?.pagination || 'all';

  // HELPER UNTUK RENDER SOALAN INDIVIDU
  const renderSingleQuestion = (q: any, index: number) => (
    <div key={index} style={{ position: 'relative', backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.2rem', color: '#000000', marginBottom: '20px', lineHeight: '1.6', position: 'relative', zIndex: 2 }}>
        {q.stem}
      </div>

      {q.options.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 2 }}>
          {q.options.map((opt: any, optIdx: number) => {
            const isSelected = answers[index] === opt.label.replace(/[\.\)]/g, '').trim();
            return (
              <label key={optIdx} style={{ display: 'flex', alignItems: 'flex-start', padding: '15px', borderRadius: '8px', border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`, backgroundColor: isSelected ? '#eff6ff' : '#f8fafc', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="radio" name={`question_${index}`} checked={isSelected} onChange={() => handleSelectAnswer(index, opt.label.replace(/[\.\)]/g, '').trim())} style={{ marginTop: '5px', marginRight: '15px', transform: 'scale(1.2)' }} />
                <span style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '1.1rem', color: '#1e293b' }}>
                  <strong>{opt.label}</strong> {opt.text}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: '20px', position: 'relative', zIndex: 2 }}>
          <textarea value={answers[index] || ''} onChange={(e) => handleSelectAnswer(index, e.target.value)} placeholder="Taipkan jawapan anda di sini..." style={{ width: '100%', minHeight: '150px', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', fontFamily: '"Times New Roman", Times, serif', resize: 'vertical' }} />
        </div>
      )}

      <div style={{ position: 'absolute', opacity: 0.05, pointerEvents: 'none', fontSize: '2rem', transform: 'rotate(-30deg)', top: '30%', left: '10%', whiteSpace: 'nowrap', zIndex: 1 }}>
        {sessionData.student_matric} CONFIDENTIAL
      </div>
      
    </div>
  );

  // DEWAN PEPERIKSAAN SEBENAR
  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '80px', userSelect: 'none', position: 'relative' }}>
      
      {/* KAMERA AI TERAPUNG DI ATAS KANAN */}
      {testData.settings?.requireWebcam !== false && <ProctoringCamera onWarning={handleWarning} />}

      <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '2px solid #e2e8f0', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{testData.test_name}</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>{sessionData.student_name} ({sessionData.student_matric})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: timeLeft < 300 ? '#fef2f2' : '#f0fdf4', border: `2px solid ${timeLeft < 300 ? '#ef4444' : '#22c55e'}`, padding: '8px 20px', borderRadius: '30px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: timeLeft < 300 ? '#b91c1c' : '#15803d' }}>
              ⏱️ {formatTime(timeLeft)}
            </span>
          </div>
          <button onClick={handleManualSubmitClick} disabled={isSubmitting} style={{ backgroundColor: '#be185d', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
            {isSubmitting ? 'Menghantar...' : 'Hantar Ujian'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
        
        {/* =========================================================
            MOD 1: SATU SOALAN SATU PAPARAN (SINGLE / STRICT)
        ========================================================= */}
        {(displayMode === 'single' || displayMode === 'one_by_one') ? (
          <div>
            {/* PALET NOMBOR SOALAN */}
            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {questions.map((_, idx) => {
                const isAnswered = answers[idx] !== undefined && answers[idx] !== '';
                const isCurrent = idx === currentIndex;
                
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: isCurrent ? '2px solid #be185d' : '1px solid #cbd5e1',
                      backgroundColor: isCurrent ? '#be185d' : isAnswered ? '#dcfce7' : '#f8fafc',
                      color: isCurrent ? 'white' : isAnswered ? '#15803d' : '#475569',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* KAD SOALAN TUNGGAL */}
            {questions[currentIndex] && renderSingleQuestion(questions[currentIndex], currentIndex)}

            {/* KAWALAN BUTANG SEBELUMNYA / SETERUSNYA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                style={{ padding: '10px 20px', backgroundColor: currentIndex === 0 ? '#e2e8f0' : '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
              >
                ⬅️ Soalan Sebelumnya
              </button>

              <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 'bold' }}>
                Soalan {currentIndex + 1} daripada {questions.length}
              </span>

              <button
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                style={{ padding: '10px 20px', backgroundColor: currentIndex === questions.length - 1 ? '#e2e8f0' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer' }}
              >
                Soalan Seterusnya ➡️
              </button>
            </div>
          </div>
        ) : 
        
        /* =========================================================
            MOD 2: MENGIKUT BAHAGIAN (SECTION)
        ========================================================= */
        displayMode === 'section' ? (
          <div>
            {questions.map((q, index) => {
              const isObj = q.options.length > 0;
              const isFirstObj = isObj && (index === 0 || questions[index - 1].options.length === 0);
              const isFirstEssay = !isObj && (index === 0 || questions[index - 1].options.length > 0);

              return (
                <div key={index}>
                  {isFirstObj && (
                    <div style={{ backgroundColor: '#be185d', color: 'white', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      📌 BAHAGIAN A: SOALAN OBJEKTIF / ANEKA PILIHAN
                    </div>
                  )}

                  {isFirstEssay && (
                    <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '12px 20px', borderRadius: '8px', margin: '30px 0 20px 0', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      📌 BAHAGIAN B / C: SOALAN SUBJEKTIF & ESEI
                    </div>
                  )}

                  {renderSingleQuestion(q, index)}
                </div>
              );
            })}
          </div>
        ) : 
        
        /* =========================================================
            MOD 3: SEMUA SEBARIS (ALL IN ONE - DEFAULT)
        ========================================================= */
        (
          <div>
            {questions.map((q, index) => renderSingleQuestion(q, index))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button onClick={handleManualSubmitClick} disabled={isSubmitting} style={{ backgroundColor: '#2563eb', color: 'white', padding: '15px 40px', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.1rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
            {isSubmitting ? 'Merekod Jawapan...' : 'Selesai Menjawab & Hantar'}
          </button>
        </div>
      </div>

      {/* MODAL PENGESAHAN HANTAR */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', maxWidth: '450px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <span style={{ fontSize: '3rem' }}>❓</span>
            <h2 style={{ color: '#0f172a', margin: '15px 0' }}>Pengesahan Penghantaran</h2>
            <p style={{ color: '#475569', marginBottom: '30px', fontSize: '1.05rem', lineHeight: '1.5' }}>{submitMsg}</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={() => setShowSubmitModal(false)} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '12px 25px', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
              <button onClick={confirmSubmit} style={{ backgroundColor: '#be185d', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Ya, Hantar Sekarang</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AMARAN PROCTORING */}
      {showWarningModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center' }}>
            <span style={{ fontSize: '4rem' }}>🚨</span>
            <h2 style={{ color: '#dc2626', margin: '15px 0' }}>AMARAN KESELAMATAN KETAT</h2>
            <p style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 'bold' }}>AMARAN {warningCount} DARIPADA 3</p>
            <p style={{ color: '#475569', marginBottom: '30px' }}>Sistem telah mengesan anda melanggar peraturan ujian (keluar halaman / tiada wajah di kamera). Sila kekal di paparan ini. Ujian akan dibatalkan jika amaran mencapai 3 kali.</p>
            <button onClick={() => { setShowWarningModal(false); enterFullscreen(); }} style={{ backgroundColor: '#dc2626', color: 'white', padding: '15px 30px', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              Saya Faham, Kembali ke Ujian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}