'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(15);
  const [bonusCredits, setBonusCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadCredits() {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // =========================================================
          // TETAPAN ADMIN
          // =========================================================
          const adminEmails = [
            'admin@uitm.edu.my', 
            'syahiran@uitm.edu.my' // Gantikan dengan emel sebenar
          ];
          
          if (session.user.email && adminEmails.includes(session.user.email)) {
            setIsAdmin(true);
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('credits_remaining, daily_limit, bonus_credits, last_reset_date')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const todayStr = new Date().toISOString().split('T')[0];
            const limit = profile.daily_limit || 15;
            const bonus = profile.bonus_credits || 0;
            
            // Semak Lazy Reset pada UI
            if (profile.last_reset_date !== todayStr) {
              setCredits(limit);
            } else {
              setCredits(profile.credits_remaining ?? limit);
            }
            
            setDailyLimit(limit);
            setBonusCredits(bonus);
          }
        }
      } catch (err) {
        console.error('Ralat memuatkan kredit:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCredits();
  }, []);

  if (loading) return null;

  // PAPARAN ADMIN
  if (isAdmin) {
    return (
      <div
        title="Akaun Pentadbir: Tiada Had Penjanaan"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe',
          padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '800',
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
        }}
      >
        <span>👑</span>
        <span>Admin: Unlimited</span>
      </div>
    );
  }

  if (credits === null) return null;

  const isLow = credits <= 3;
  const isEmpty = credits <= 0;

  // PAPARAN PENSYARAH BIASA (Diasingkan Harian dan Bonus)
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      
      {/* 1. LENCANA KREDIT HARIAN */}
      <div
        title="Baki Kredit Harian Penjanaan AI"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          backgroundColor: isEmpty ? '#fee2e2' : isLow ? '#fef3c7' : '#e0e7ff',
          color: isEmpty ? '#991b1b' : isLow ? '#92400e' : '#3730a3',
          border: `1px solid ${isEmpty ? '#fca5a5' : isLow ? '#fde047' : '#a5b4fc'}`,
          padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '800',
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
        }}
      >
        <span>🪙</span>
        <span>{credits} / {dailyLimit} Harian</span>
      </div>

      {/* 2. LENCANA KREDIT BONUS (Hanya muncul jika bonus melebihi 0) */}
      {bonusCredits > 0 && (
        <div
          title="Kredit Bonus (Tidak Luput)"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d',
            padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '800',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
            animation: 'pulse 2s infinite' // Sedikit animasi supaya pensyarah perasan
          }}
        >
          <span>🎁</span>
          <span>+{bonusCredits} Bonus</span>
          <style>{`
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(252, 211, 77, 0.7); }
              70% { box-shadow: 0 0 0 6px rgba(252, 211, 77, 0); }
              100% { box-shadow: 0 0 0 0 rgba(252, 211, 77, 0); }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}