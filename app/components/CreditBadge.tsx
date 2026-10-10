'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CreditBadge() {
  const [creditInfo, setCreditInfo] = useState({
    available: 0,
    limit: 5,
    isUnlimited: false,
    isAdmin: false
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredit = async () => {
    try {
      // WAJIB GUNA getUser() UNTUK DATA TERKINI DARI SERVER (Bukan getSession)
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return;

      const meta = user.user_metadata || {};
      const email = user.email || '';
      
      const isAdmin = meta.role === 'admin' || ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'].includes(email);
      const isUnlimited = isAdmin || meta.is_unlimited === true;

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
      let usage = meta.daily_usage || 0;
      const lastDate = meta.last_generation_date || '';

      if (lastDate !== today) {
        usage = 0; 
      }

      const dailyLimit = meta.daily_limit !== undefined ? meta.daily_limit : 5; 
      const bonus = meta.bonus_credit || 0;
      
      const available = dailyLimit + bonus - usage;

      setCreditInfo({
        available: available > 0 ? available : 0,
        limit: dailyLimit + bonus,
        isUnlimited,
        isAdmin
      });
    } catch (error) {
      console.error("Ralat memuatkan lencana:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredit();

    // Dengar isyarat dari penjana soalan, dan panggil fetchCredit sekali lagi
    const handleUpdate = () => {
      setIsLoading(true);
      setTimeout(() => fetchCredit(), 500); // Beri masa server Supabase update
    };
    
    window.addEventListener('credit-updated', handleUpdate);
    return () => window.removeEventListener('credit-updated', handleUpdate);
  }, []);

  if (isLoading) {
    return (
      <div style={{ backgroundColor: '#f1f5f9', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', border: '1px solid #cbd5e1' }}>
        ⏳ Menyemak Kredit...
      </div>
    );
  }

  if (creditInfo.isUnlimited) {
    return (
      <div style={{ backgroundColor: '#fdf4ff', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', color: '#9333ea', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
        ⚡ Akses Tanpa Had
      </div>
    );
  }

  const isLow = creditInfo.available <= 2;

  return (
    <div style={{ 
      backgroundColor: isLow ? '#fee2e2' : '#fef9c3', 
      padding: '6px 14px', 
      borderRadius: '20px', 
      fontSize: '0.85rem', 
      fontWeight: 'bold', 
      color: isLow ? '#991b1b' : '#854d0e',
      border: `1px solid ${isLow ? '#fca5a5' : '#fde047'}`,
      display: 'flex', 
      alignItems: 'center', 
      gap: '6px',
      transition: 'all 0.3s'
    }}>
      🪙 {creditInfo.available} / {creditInfo.limit} Harian
    </div>
  );
}