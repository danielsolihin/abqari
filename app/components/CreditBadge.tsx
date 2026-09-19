'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CreditBadge() {
  const [creditData, setCreditData] = useState({
    dailyLimit: 15,
    usedCredit: 0,
    bonusCredit: 0,
    isUnlimited: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
        const isAdmin = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';

        // 1. CUBA AMBIL DARI JADUAL PROFIL
        const { data, error } = await supabase
          .from('profiles')
          .select('daily_limit, used_credit, bonus_credit, is_unlimited')
          .eq('id', user.id)
          .maybeSingle(); // guna maybeSingle utk elak error jika rekod tiada

        // Sediakan pemboleh ubah dengan fallback kepada user_metadata
        let fetchedDaily = 15;
        let fetchedUsed = 0;
        let fetchedBonus = 0;
        let fetchedUnlim = isAdmin;

        if (data) {
          fetchedDaily = data.daily_limit !== null ? Number(data.daily_limit) : 15;
          fetchedUsed = Number(data.used_credit) || 0;
          fetchedBonus = Number(data.bonus_credit) || 0;
          fetchedUnlim = data.is_unlimited || isAdmin;
        } else if (user.user_metadata) {
          // 2. FALLBACK JIKA SISTEM ADMIN UPDATE TERUS KE METADATA AUTH
          fetchedDaily = user.user_metadata.daily_limit !== undefined ? Number(user.user_metadata.daily_limit) : 15;
          fetchedBonus = Number(user.user_metadata.bonus_credit) || 0;
          fetchedUnlim = user.user_metadata.is_unlimited === true || isAdmin;
        }

        setCreditData({
          dailyLimit: fetchedDaily,
          usedCredit: fetchedUsed,
          bonusCredit: fetchedBonus,
          isUnlimited: fetchedUnlim
        });

      } catch (error) {
        console.error('Ralat menarik data kredit:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, []);

  if (loading) return null;

  if (creditData.isUnlimited) {
    return (
      <div style={{ display: 'flex', gap: '10px' }}>
        <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          ⚡ Unlimited Credit
        </span>
      </div>
    );
  }

  const remainingDaily = Math.max(0, creditData.dailyLimit - creditData.usedCredit);

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      
      {/* TAG 1: KREDIT HARIAN */}
      <span style={{ backgroundColor: '#f8fafc', color: '#334155', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        🪙 {remainingDaily} / {creditData.dailyLimit} Harian
      </span>
      
      {/* TAG 2: KREDIT BONUS (Memastikan paparan kuat sekiranya wujud) */}
      {creditData.bonusCredit > 0 && (
        <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #bbf7d0' }}>
          🎁 +{creditData.bonusCredit} Bonus
        </span>
      )}

    </div>
  );
}