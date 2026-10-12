'use client';

import { useEffect, useRef, useState } from 'react';

export default function ProctoringCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then((stream) => {
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
      })
      .catch((err) => {
        console.error("Akses kamera ditolak/ralat:", err);
        setHasError(true);
      });

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '210px',
      backgroundColor: '#0f172a',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
      border: hasError ? '2px solid #ef4444' : '2px solid #10b981',
      zIndex: 9999
    }}>
      {/* HEADER TETINGKAP */}
      <div style={{
        padding: '6px 10px',
        backgroundColor: '#1e293b',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: streamActive ? '#22c55e' : '#ef4444',
            borderRadius: '50%',
            display: 'inline-block'
          }}></span>
          PEMANTAUAN AI
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>🔴 LIVE</span>
      </div>

      {/* VIDEO STREAM */}
      <div style={{ position: 'relative', width: '100%', height: '130px', backgroundColor: '#000' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
        />

        {hasError && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '10px', textAlign: 'center', fontSize: '0.75rem'
          }}>
            <span>⚠️ Kamera Ralat</span>
            <span style={{ fontSize: '0.65rem', marginTop: '4px' }}>Sila benarkan akses kamera webkam.</span>
          </div>
        )}
      </div>

      {/* FOOTER WARN */}
      <div style={{ padding: '4px 8px', backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '0.65rem', textAlign: 'center' }}>
        Wajah dirakam & dipantau
      </div>
    </div>
  );
}