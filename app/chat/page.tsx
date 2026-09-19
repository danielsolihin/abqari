'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import CreditBadge from '../components/CreditBadge';

// Inisialisasi Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Message = {
  role: 'user' | 'ai';
  content: string;
  sources?: any[];
};

export default function ChatPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // ==========================================
  // LOGIK MENARIK SUBJEK DARI SUPABASE 
  // ==========================================
  useEffect(() => {
    async function fetchSubjects() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Tentukan jika Admin (untuk RLS/Penapisan)
        const adminEmails = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'];
        const isAdminUser = adminEmails.includes(user.email || '') || user.user_metadata?.role === 'admin';

        let query = supabase.from('subjects').select('id, name, course_code');
        
        // Jika bukan admin, hanya tarik subjek ciptaan sendiri
        if (!isAdminUser) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        if (data) {
          setSubjects(data);
        }
      } catch (err) {
        console.error('Ralat mengambil subjek:', err);
      }
    }
    fetchSubjects();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMessage: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          subjectId: selectedSubjectId || null, 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ralat berlaku semasa menghubungi API.');
      }

      const aiMessage: Message = {
        role: 'ai',
        content: data.answer,
        sources: data.sources,
      };
      setMessages((prev) => [...prev, aiMessage]);
      
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `Ralat: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    page: { backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' as 'relative', display: 'flex', flexDirection: 'column' as 'column' },
    banner: {
      position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, height: '300px',
      backgroundColor: '#3b0764',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
      borderBottom: '4px solid #fde047',
      zIndex: 0
    },
    container: { flex: 1, display: 'flex', flexDirection: 'column' as 'column', maxWidth: '900px', margin: '0 auto', width: '100%', padding: '30px 20px', position: 'relative' as 'relative', zIndex: 1 },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    header: { textAlign: 'center' as 'center', marginBottom: '25px', color: 'white' },
    backButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fde047', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem', textShadow: '0 1px 3px rgba(0,0,0,0.3)' },
    chatContainer: { flex: 1, backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' as 'column', overflow: 'hidden', minHeight: '500px' },
    chatBox: { flex: 1, padding: '25px', overflowY: 'auto' as 'auto', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' as 'column', gap: '20px' },
    
    bubbleRow: { display: 'flex', width: '100%' },
    userBubble: { backgroundColor: '#3b0764', color: '#ffffff', padding: '14px 20px', borderRadius: '16px 16px 0 16px', maxWidth: '80%', marginLeft: 'auto', boxShadow: '0 2px 6px rgba(59, 7, 100, 0.2)', fontSize: '0.95rem', lineHeight: '1.5' },
    aiBubble: { backgroundColor: '#ffffff', color: '#0f172a', padding: '14px 20px', borderRadius: '16px 16px 16px 0', maxWidth: '85%', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', fontSize: '0.95rem', lineHeight: '1.6' },
    
    sourcesBox: { marginTop: '15px', backgroundColor: '#fef3c7', padding: '12px 15px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '0.85rem' },
    
    formArea: { display: 'flex', flexDirection: 'column' as 'column', gap: '12px', padding: '20px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' },
    inputField: { flex: 1, padding: '15px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', fontSize: '1rem', outlineColor: '#3b82f6', backgroundColor: '#f1f5f9' },
    selectField: { padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outlineColor: '#3b0764', backgroundColor: '#f8fafc', color: '#334155', width: 'fit-content', cursor: 'pointer' },
    sendBtn: { backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '30px', padding: '0 25px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(37,99,235,0.2)', height: '50px' }
  };

  return (
    <div style={styles.page}>
      <div style={styles.banner} />

      <div style={styles.container}>
        <div style={styles.topBar}>
          <Link href="/" style={styles.backButton}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Kembali ke Papan Pemuka
          </Link>

          <CreditBadge />
        </div>

        <div style={styles.header}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800', margin: '0 0 10px 0', textShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
            Pembantu AI (RAG)
          </h1>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1.05rem' }}>
            Bincang dan semak rujukan nota-nota anda dengan Enjin Pintar ABQARI.
          </p>
        </div>

        <div style={styles.chatContainer}>
          <div style={styles.chatBox}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', opacity: 0.7 }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>Ruangan Sembang Kosong</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem' }}>Sila tanya soalan tentang PDF yang telah dimuat naik.</p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div key={index} style={{ ...styles.bubbleRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={msg.role === 'user' ? styles.userBubble : styles.aiBubble}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  
                  {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                    <div style={styles.sourcesBox}>
                      <strong style={{ color: '#b45309', display: 'block', marginBottom: '8px' }}>🔍 Sumber Rujukan Ditemui:</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {msg.sources.map((src, i) => (
                          <li key={i}>{src.content}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ ...styles.bubbleRow, justifyContent: 'flex-start' }}>
                <div style={{ ...styles.aiBubble, display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                  <div style={{ width: '16px', height: '16px', border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  <span>AI sedang menaakul maklumat...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} style={styles.formArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>📚 Subjek Rujukan:</label>
              <select 
                value={selectedSubjectId} 
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                style={styles.selectField}
              >
                <option value="">-- Semua Subjek / Rujukan Umum --</option>
                {subjects.map((s, idx) => (
                  <option key={s.id || idx} value={s.id}>
                    {s.course_code && s.course_code !== 'TIADA' ? `${s.course_code} - ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Taip soalan anda di sini..."
                style={styles.inputField}
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !question.trim()} style={{ ...styles.sendBtn, opacity: (isLoading || !question.trim()) ? 0.6 : 1 }}>
                Hantar
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}