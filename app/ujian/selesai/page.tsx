'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ExamCompletedPage() {
  const [completedInfo, setCompletedInfo] = useState<{
    timestamp: string;
  }>({ timestamp: '' });

  useEffect(() => {
    // Tetapkan tarikh dan masa penghantaran rasmi
    const now = new Date();
    const formattedDate = now.toLocaleDateString('ms-MY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setCompletedInfo({ timestamp: formattedDate });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '50px 40px',
        maxWidth: '580px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* Lencana Hiasan Atas */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: 'linear-gradient(90deg, #16a34a, #22c55e)'
        }} />

        {/* Ikon Kejayaan */}
        <div style={{
          width: '90px',
          height: '90px',
          backgroundColor: '#dcfce7',
          color: '#16a34a',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          margin: '0 auto 25px auto',
          boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.2)'
        }}>
          ✅
        </div>

        <h1 style={{
          margin: '0 0 10px 0',
          color: '#0f172a',
          fontSize: '1.8rem',
          fontWeight: '800'
        }}>
          Ujian Berjaya Dihantar!
        </h1>

        <p style={{
          color: '#475569',
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '30px'
        }}>
          Terima kasih. Jawapan anda telah selamat direkodkan ke dalam pangkalan data sistem <strong style={{ color: '#3b0764' }}>ABQARI</strong>.
        </p>

        {/* Kotak Ringkasan Penghantaran */}
        <div style={{
          backgroundColor: '#f1f5f9',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'left',
          marginBottom: '30px',
          border: '1px solid #cbd5e1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>STATUS PENGHANTARAN:</span>
            <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 'bold', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>SELESAI (COMPLETED)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>WAKTU TERIMA:</span>
            <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>
              {completedInfo.timestamp || 'Memproses...'}
            </span>
          </div>
        </div>

        {/* Peringatan Arahan */}
        <div style={{
          backgroundColor: '#eff6ff',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '30px',
          borderLeft: '4px solid #3b82f6',
          textAlign: 'left',
          fontSize: '0.88rem',
          color: '#1e40af'
        }}>
          💡 <strong>Nota Penting:</strong> Anda kini boleh menutup tetingkap pelayar web ini atau memaklumkan kepada pensyarah bahawa anda telah selesai menjawab.
        </div>

        {/* Butang Kembali ke Laman Utama Portal */}
        <Link 
          href="/ujian"
          style={{
            display: 'inline-block',
            width: '100%',
            padding: '14px 20px',
            backgroundColor: '#0f172a',
            color: 'white',
            borderRadius: '10px',
            fontWeight: 'bold',
            fontSize: '1rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)',
            transition: 'all 0.2s'
          }}
        >
          Kembali ke Portal Ujian
        </Link>

      </div>
    </div>
  );
}