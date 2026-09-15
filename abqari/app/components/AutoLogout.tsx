'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AutoLogout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tetapan masa: 25 minit (ditukar kepada milisaat)
  const TIMEOUT_MS = 25 * 60 * 1000; 

  const handleLogout = async () => {
    console.log("Tiada pergerakan dikesan. Melog keluar secara automatik...");
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Ralat auto-logout:', error);
    }
    
    // Padam sesi cookie
    document.cookie = "abqari_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
    
    // Halakan semula ke halaman log masuk
    window.location.href = '/login';
  };

  const resetTimer = () => {
    // Padam pemasa lama jika ada pergerakan
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Mulakan semula pemasa baharu
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, TIMEOUT_MS);
  };

  useEffect(() => {
    // Abaikan jika pengguna sudah berada di halaman log masuk
    if (window.location.pathname === '/login') return;

    // Mulakan pemasa buat kali pertama
    resetTimer();

    // Senarai pergerakan yang dikira sebagai 'Aktif'
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    
    // Pasang pengesan pada keseluruhan tetingkap (window)
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup: Buang pengesan jika pengguna tutup/tukar halaman
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  // Komponen ini senyap (tiada paparan UI), ia hanya bekerja di belakang tabir
  return null; 
}