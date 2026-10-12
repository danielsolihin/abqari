'use client';

import { useState, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// IMPORT KOMPONEN LENCANA KREDIT
import CreditBadge from '../components/CreditBadge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const escapeXml = (unsafe: string) => {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;'; case '>': return '&gt;';
      case '&': return '&amp;'; case '\'': return '&apos;';
      case '"': return '&quot;'; default: return c;
    }
  });
};

const formatTextToOOXML = (text: string, lang: string = 'Bahasa Melayu') => {
  if (!text) return '';
  
  const cleanFullText = text.replace(/\n{3,}/g, '\n\n');
  const lines = cleanFullText.split('\n');
  
  let xml = '';
  const isArabic = lang === 'Bahasa Arab';
  const bidiP = isArabic ? '<w:bidi w:val="1"/>' : '';
  const rtlR = isArabic ? '<w:rtl w:val="1"/>' : '';

  let inCodeBlock = false;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return; 
    }
    
    if (trimmed === '' && !inCodeBlock) {
      xml += `<w:p><w:pPr>${bidiP}<w:spacing w:after="120"/></w:pPr></w:p>`;
      return;
    }

    let jc = isArabic && !inCodeBlock ? '<w:jc w:val="right"/>' : '<w:jc w:val="both"/>'; 
    let ind = ''; let tabs = ''; let runContent = ''; let isBold = false;
    
    let cleanText = line; 
    if (!inCodeBlock) {
      cleanText = trimmed.replace(/\*\*/g, '').replace(/\\?\[\s*(?:Aras|Level|Aras Bloom|CO\w*|LO\w*|PO\w*|Domain|[CPA]\d*|Rujukan|Topik)[^\]]*\\?\]/gi, '').trim();
      if (cleanText === '') return;
    } else {
      cleanText = line.replace(/\*\*/g, ''); 
    }

    const optMatch = cleanText.match(/^([A-E][\.\)])\s*(.*)/); 
    const qMatch = cleanText.match(/^(\d+[\.\)])\s*(.*)/); 
    const romanMatch = cleanText.match(/^((?:viii|vii|vi|v|iv|iii|ii|i)[\.\)])\s*(.*)/i); 
    const essaySubMatch = cleanText.match(/^([a-e][\.\)])\s*(.*)/); 
    const bulletMatch = cleanText.match(/^[-*]\s+(.*)/); 
    const markMatch = cleanText.match(/^[\[\(]\d+(?:\.\d+)?\s*(?:Markah|Marks|درجات)[\]\)]$/i); 
    const isHeading = cleanText.match(/^(BAHAGIAN|SOALAN|PART|الجزء|#)/i);
    const isTrueFalse = cleanText.match(/^\[\s*(BENAR|SALAH|TRUE|FALSE)\s*\/\s*(BENAR|SALAH|TRUE|FALSE)\s*\]/i);

    let currType = 'text';
    if (inCodeBlock) currType = 'code';
    else if (isHeading) currType = 'heading';
    else if (markMatch) currType = 'mark';
    else if (isTrueFalse) currType = 'trueFalse';
    else if (optMatch) currType = 'option';
    else if (qMatch) currType = 'question';
    else if (romanMatch) currType = 'roman';
    else if (essaySubMatch) currType = 'essaySub';
    else if (bulletMatch) currType = 'bullet';

    if (inCodeBlock) {
      jc = '<w:jc w:val="left"/>'; 
      ind = '<w:ind w:left="720"/>';
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    }
    else if (currType === 'heading') {
      isBold = true;
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    } 
    else if (currType === 'mark') {
      jc = isArabic ? '<w:jc w:val="left"/>' : '<w:jc w:val="right"/>';
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    }
    else if (currType === 'trueFalse') {
      ind = isArabic ? '<w:ind w:right="700"/>' : '<w:ind w:left="700"/>';
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
      isBold = true;
    }
    else if (currType === 'option' && optMatch) {
      ind = isArabic ? '<w:ind w:right="700" w:hanging="300"/>' : '<w:ind w:left="700" w:hanging="300"/>';
      tabs = isArabic ? '<w:tabs><w:tab w:val="right" w:pos="700"/></w:tabs>' : '<w:tabs><w:tab w:val="left" w:pos="700"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(optMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(optMatch[2])}</w:t>`;
    } 
    else if (currType === 'question' && qMatch) {
      ind = isArabic ? '<w:ind w:right="400" w:hanging="400"/>' : '<w:ind w:left="400" w:hanging="400"/>';
      tabs = isArabic ? '<w:tabs><w:tab w:val="right" w:pos="400"/></w:tabs>' : '<w:tabs><w:tab w:val="left" w:pos="400"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(qMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(qMatch[2])}</w:t>`;
    } 
    else if (currType === 'roman' && romanMatch) {
      ind = isArabic ? '<w:ind w:right="700" w:hanging="300"/>' : '<w:ind w:left="700" w:hanging="300"/>';
      tabs = isArabic ? '<w:tabs><w:tab w:val="right" w:pos="700"/></w:tabs>' : '<w:tabs><w:tab w:val="left" w:pos="700"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(romanMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(romanMatch[2])}</w:t>`;
    }
    else if (currType === 'essaySub' && essaySubMatch) {
      ind = isArabic ? '<w:ind w:right="700" w:hanging="300"/>' : '<w:ind w:left="700" w:hanging="300"/>';
      tabs = isArabic ? '<w:tabs><w:tab w:val="right" w:pos="700"/></w:tabs>' : '<w:tabs><w:tab w:val="left" w:pos="700"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(essaySubMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(essaySubMatch[2])}</w:t>`;
    }
    else if (currType === 'bullet' && bulletMatch) {
      ind = isArabic ? '<w:ind w:right="700" w:hanging="300"/>' : '<w:ind w:left="700" w:hanging="300"/>';
      tabs = isArabic ? '<w:tabs><w:tab w:val="right" w:pos="700"/></w:tabs>' : '<w:tabs><w:tab w:val="left" w:pos="700"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">-</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(bulletMatch[1])}</w:t>`;
    }
    else {
      ind = isArabic ? '<w:ind w:right="400"/>' : '<w:ind w:left="400"/>';
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    }

    let fontSettings = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/>`;
    if (inCodeBlock) {
       fontSettings = `<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/>`;
    }

    let rPr = `<w:rPr>${!inCodeBlock ? rtlR : ''}${fontSettings}${isBold ? '<w:b/>' : ''}</w:rPr>`;
    
    let pPr = `<w:pPr>${jc}${!inCodeBlock ? bidiP : ''}${ind}${tabs}<w:spacing w:after="120"/></w:pPr>`;
    if (inCodeBlock) {
        pPr = `<w:pPr><w:jc w:val="left"/><w:ind w:left="720"/><w:spacing w:after="0"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:pPr>`;
    }

    xml += `<w:p>${pPr}<w:r>${rPr}${runContent}</w:r></w:p>`;
    
  });
  return xml;
};

const formatSubjectDisplay = (code: string, name: string) => {
  let c = code && code !== 'TIADA' ? code.trim() : '';
  let n = name ? name.trim() : '';

  if (!c && n.includes(' - ')) {
    const parts = n.split(' - ');
    const lastPart = parts[parts.length - 1].trim();
    if (/^[a-zA-Z]{2,4}\d{3,4}$/.test(lastPart)) {
      c = lastPart.toUpperCase();
      n = parts.slice(0, -1).join(' - ').trim();
    }
  }

  if (c) {
    const cleanName = n.replace(new RegExp(`^${c}\\s*[-:]*\\s*`, 'i'), '');
    return `${c} - ${cleanName}`;
  }
  return n;
};

const islamicQuotes = [
  '📖 "Wahai Tuhanku, tambahkanlah kepadaku ilmu pengetahuan." — (Surah Taha: 114)',
  '✨ "Barangsiapa menempuh jalan untuk menuntut ilmu, Allah akan mudahkan baginya jalan ke syurga." — (HR. Muslim)',
  '🌟 "Allah mengangkat kedudukan orang-orang yang beriman dan orang-orang yang diberi ilmu beberapa darjat." — (Surah Al-Mujadilah: 11)',
  '💡 "Sebaik-baik manusia adalah yang paling bermanfaat kepada manusia lain." — (HR. Ahmad)',
  '🌱 "Sesungguhnya bersama kesulitan itu ada kemudahan." — (Surah Ash-Sharh: 6)',
  '🎓 Mendidik dengan ihsan, menyusun soalan dengan hikmah demi melahirkan generasi bertakwa...',
  '🤲 "Katakanlah: Adakah sama orang-orang yang mengetahui dengan orang-orang yang tidak mengetahui?" — (Surah Az-Zumar: 9)',
  '📚 "Ilmu itu adalah kehidupan bagi hati daripada kegelapan kejahilan." — (Imam al-Ghazali)',
  '🕊️ "Niat yang ikhlas dalam menyampaikan ilmu adalah punca keberkatan ilmu tersebut."'
];

export default function PenjanaSoalanPage() {
  const router = useRouter();
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [managedSemesters, setManagedSemesters] = useState<any[]>([]); // KEMASKINI: TAMBAH STATE SEMESTER
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [userProfile, setUserProfile] = useState<{id?: string; name: string; faculty: string;}>({
    name: 'Pengguna ABQARI', faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
  });

  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [examPeriod, setExamPeriod] = useState('JULAI 2026');
  const [duration, setDuration] = useState('2 JAM');
  const [theme, setTheme] = useState('Semua Tema');
  const [setSoalan, setSetSoalan] = useState('1');
  
  const [language, setLanguage] = useState('Bahasa Melayu');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');

  const [subjectCOs, setSubjectCOs] = useState<string[]>([]);
  const [subjectLOs, setSubjectLOs] = useState<string[]>([]);
  const [subjectDomains, setSubjectDomains] = useState<string[]>([]);

  const [topicDistribution, setTopicDistribution] = useState<{name: string, percentage: string}[]>([{ name: '', percentage: '' }]);

  // KEMASKINI: MENAMBAH singleMode: false DALAM STRUKTUR ASAL SECTIONS
  const [sections, setSections] = useState<any>({
    A: { enabled: true, type: 'objektif', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0, mixedMode: false, singleMode: false },
    B: { enabled: true, type: 'true_false', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0, mixedMode: false, singleMode: false },
    C: { enabled: true, type: 'essay', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0, mixedMode: false, singleMode: false }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string | null>(null);
  const [generatedScheme, setGeneratedScheme] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isSavedBank, setIsSavedBank] = useState(false);
  
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [modalMode, setModalMode] = useState<'preview' | 'edit'>('preview');
  const [tempEditedQuestions, setTempEditedQuestions] = useState('');
  
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Sedia untuk menjana...');
  const [quoteText, setQuoteText] = useState('Meningkatkan ketepatan format menggunakan seni bina modular...');

  // STATE UNTUK MODAL UJIAN ONLINE
  const [showOnlineTestModal, setShowOnlineTestModal] = useState(false);
  const [isPublishingTest, setIsPublishingTest] = useState(false);
  const [publishedTestLink, setPublishedTestLink] = useState(''); 
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  const [testSettings, setTestSettings] = useState({
    programFaculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
    courseCode: '',
    testName: 'Ujian Akhir Semester',
    semester: 'Semester 1',
    description: 'Ujian penilaian kefahaman dan penulisan kursus.',
    instructions: 'Sila jawab semua soalan. Dilarang merujuk sebarang bahan luar semasa ujian dijalankan.',
    totalQuestions: 20,
    maxAttempts: 1,
    groupName: '',
    startTime: '',
    endTime: '',
    durationMinutes: 60,
    pagination: 'all',
    reshuffle: true,
    strictProctoring: true,
    requireWebcam: false,
  });

  const getAuthHeaders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    } catch (e) {
      return {};
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const facultyName = meta.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)';
          setUserProfile({ id: session.user.id, name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Pengguna ABQARI', faculty: facultyName });
          setTestSettings(prev => ({ ...prev, programFaculty: facultyName }));
          
          const adminCheck = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'].includes(session.user.email || '') || meta.role === 'admin';
          setIsAdmin(adminCheck);

        } else if (localUser) {
          try { 
            const parsed = JSON.parse(localUser); 
            const facultyName = parsed.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)';
            setUserProfile({ id: parsed.id, name: parsed.name || 'Pengguna ABQARI', faculty: facultyName }); 
            setTestSettings(prev => ({ ...prev, programFaculty: facultyName }));

            const adminCheck = ['admin@uitm.edu.my', 'syahiran@uitm.edu.my'].includes(parsed.email || '') || parsed.role === 'admin';
            setIsAdmin(adminCheck);
          } catch (e) {}
        }
      } catch (err) { console.error('Ralat:', err); }
    };
    fetchUserProfile();
  }, []);

  // KEMASKINI: BACA SEMESTER DARI DATABASE ADMIN SECARA DINAMIK
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const { data, error } = await supabase.from('semesters').select('*').order('created_at', { ascending: true });
        if (data && !error) {
          setManagedSemesters(data);
          // Set pilihan lalai ke semester pertama dalam jadual jika belum diset
          if (data.length > 0) {
            setTestSettings(prev => ({ ...prev, semester: data[0].name }));
          }
        }
      } catch (err) {
        console.error('Ralat memuatkan semester:', err);
      }
    };
    fetchSemesters();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        const isAdminCheck = user ? (['admin@uitm.edu.my', 'syahiran@uitm.edu.my'].includes(user.email || '') || user.user_metadata?.role === 'admin') : false;

        let query = supabase.from('subjects').select('*').order('created_at', { ascending: false });

        if (!isAdminCheck && user) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (!error && data) {
          setSubjects(data);
        } else {
          const authHeaders = await getAuthHeaders();
          const response = await fetch('/api/subjects', { headers: { ...authHeaders } });
          const text = await response.text();
          const json = text ? JSON.parse(text) : {};
          
          if (json && json.success && Array.isArray(json.data)) {
            const filteredData = isAdminCheck ? json.data : json.data.filter((s: any) => s.user_id === user?.id);
            setSubjects(filteredData);
          }
        }
      } catch (error) { 
        console.error('Ralat mengambil subjek:', error); 
      }
    };
    fetchSubjects();
  }, []);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    const sub = subjects.find(s => s.id === subjectId);
    if (sub) {
      const formatted = formatSubjectDisplay(sub.course_code, sub.name);
      if (formatted.includes(' - ')) {
         const parts = formatted.split(' - ');
         setCourseCode(parts[0].trim()); setCourseName(parts.slice(1).join(' - ').trim());
      } else {
         setCourseCode(''); setCourseName(formatted);
      }
      
      const rawCOs = Array.isArray(sub.co) ? sub.co : [];
      const formattedCOs = rawCOs.map((c: any) => {
        let str = String(c).toUpperCase().trim();
        if (/^C\d+$/.test(str)) return str.replace('C', 'CO');
        return str;
      });
      
      setSubjectCOs(formattedCOs);
      setSubjectLOs(Array.isArray(sub.lo) ? sub.lo : []);
      setSubjectDomains(Array.isArray(sub.domain) ? sub.domain : (sub.co || ['C1', 'C2', 'C3', 'P3', 'P4']));
    }
  };

  const updateSection = (part: 'A' | 'B' | 'C', field: string, value: any) => { 
    setSections((prev: any) => ({ ...prev, [part]: { ...prev[part], [field]: value } })); 
  };

  const getRequestedBloomCounts = () => {
    const counts = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
    (['A', 'B', 'C'] as const).forEach(part => {
      if (sections[part].enabled) {
        counts.C1 += (Number(sections[part].bloom.C1) || 0); counts.C2 += (Number(sections[part].bloom.C2) || 0);
        counts.C3 += (Number(sections[part].bloom.C3) || 0); counts.C4 += (Number(sections[part].bloom.C4) || 0);
        counts.C5 += (Number(sections[part].bloom.C5) || 0); counts.C6 += (Number(sections[part].bloom.C6) || 0);
      }
    }); return counts;
  };
  const requestedBloomCounts = getRequestedBloomCounts();

  const addTopic = () => setTopicDistribution([...topicDistribution, { name: '', percentage: '' }]);
  const updateTopic = (index: number, field: string, value: string) => {
    const newTopics = [...topicDistribution];
    newTopics[index] = { ...newTopics[index], [field]: value };
    setTopicDistribution(newTopics);
  };
  const removeTopic = (index: number) => {
    if (topicDistribution.length > 1) {
      setTopicDistribution(topicDistribution.filter((_, i) => i !== index));
    }
  };

  const activeTopics = topicDistribution.filter(t => t.name.trim() !== '' || String(t.percentage).trim() !== '');
  const isTopicEmpty = activeTopics.length === 0;
  const totalTopicPercentage = activeTopics.reduce((sum, topic) => sum + (Number(topic.percentage) || 0), 0);
  const isTopicSectionValid = isTopicEmpty || (totalTopicPercentage === 100 && activeTopics.every(t => t.name.trim() !== '' && Number(t.percentage) > 0));

  const isAllSectionsValid = (['A', 'B', 'C'] as const).every(part => {
    if (!sections[part].enabled) return true;
    const currentSum = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].reduce((sum, level) => sum + (sections[part].bloom?.[level] || 0), 0);
    return currentSum === (sections[part].count || 0);
  });

  const getValidationErrors = () => {
    let errors: string[] = [];
    (['A', 'B', 'C'] as const).forEach(part => {
      if (sections[part].enabled && sections[part].type === 'essay' && sections[part].count > 0) {
        const marksPerQ = sections[part].marks / sections[part].count;
        
        if (marksPerQ < 1) {
          errors.push(`BAHAGIAN ${part}: Purata ${marksPerQ.toFixed(2)} markah per soalan. Soalan esei mesti bernilai sekurang-kurangnya 1 markah per soalan.`);
        } else if (marksPerQ % 0.5 !== 0) {
          errors.push(`BAHAGIAN ${part}: Purata ${marksPerQ.toFixed(2)} markah per soalan tidak sah. Sila ubah bilangan markah/soalan supaya purata berakhir dengan gandaan 0.5 (Cth: 1.5, 2.0, 2.5).`);
        }
      }
    });
    return errors;
  };
  
  const validationErrors = getValidationErrors();
  const hasValidationErrors = validationErrors.length > 0;

  const isGenerateDisabled = isGenerating || !isAllSectionsValid || !isTopicSectionValid || hasValidationErrors;

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\\?\[\s*(?:Aras|Level|Aras Bloom|CO\d*|CLO\d*|LO\d*|PO\d*|PLO\d*|C\d+|P\d+|A\d+|Rujukan|Topik)[^\]]*\\?\])/gi);
    return parts.map((part, index) => {
      const arasMatch = part.match(/\\?\[\s*(?:Aras(?: Bloom)?|Level):\s*C([1-6])\\?\]/i);
      if (arasMatch) {
        const level = arasMatch[1]; let bgColor, textColor, borderColor;
        switch(level) {
          case '1': bgColor = '#dbeafe'; textColor = '#1e40af'; borderColor = '#93c5fd'; break;
          case '2': bgColor = '#dcfce7'; textColor = '#166534'; borderColor = '#86efac'; break;
          case '3': bgColor = '#fef9c3'; textColor = '#854d0e'; borderColor = '#fde047'; break;
          case '4': bgColor = '#ffedd5'; textColor = '#9a3412'; borderColor = '#fdba74'; break;
          case '5': bgColor = '#f3e8ff'; textColor = '#6b21a8'; borderColor = '#d8b4fe'; break;
          case '6': bgColor = '#fee2e2'; textColor = '#991b1b'; borderColor = '#fca5a5'; break;
          default: bgColor = '#f1f5f9'; textColor = '#334155'; borderColor = '#cbd5e1';
        }
        return <span key={index} style={{ backgroundColor: bgColor, color: textColor, fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${borderColor}`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      }
      
      if (part.match(/\[CO\d*\]/i) || part.match(/\[CO:/i) || part.match(/\[CLO\d*\]/i)) return <span key={index} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #7dd3fc`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[LO\d*\]/i) || part.match(/\[PO\d*\]/i) || part.match(/\[PLO\d*\]/i) || part.match(/\[LO:/i)) return <span key={index} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #c4b5fd`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[A[1-5]\]/i) || part.match(/\[A:/i)) return <span key={index} style={{ backgroundColor: '#ffedd5', color: '#c2410c', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #fdba74`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[P[1-7]\]/i) || part.match(/\[P:/i)) return <span key={index} style={{ backgroundColor: '#fce7f3', color: '#9d174d', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #fbcfe8`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[C[1-6]\]/i) || part.match(/\[C:/i)) return <span key={index} style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #5eead4`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      
      if (part.match(/\[Rujukan/i)) return <span key={index} style={{ backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 'bold', fontStyle: 'italic', padding: '2px 6px', borderRadius: '4px', border: `1px dashed #9ca3af`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[Topik/i)) return <span key={index} style={{ backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 'bold', fontStyle: 'italic', padding: '2px 6px', borderRadius: '4px', border: `1px solid #fbcfe8`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      
      return part;
    });
  };

  const handleOpenModal = () => { 
    setTempEditedQuestions((generatedQuestions || '') + (generatedScheme ? '\n\n[PENJANAAN SKEMA JAWAPAN]\n\n' + generatedScheme : '')); 
    setModalMode('preview');
    setShowLevelModal(true); 
  };
  
  const handleSaveChanges = () => { 
    const fullText = tempEditedQuestions;
    let splitIndex = fullText.indexOf('[PENJANAAN SKEMA JAWAPAN]');
    if (splitIndex === -1) {
      const match = fullText.match(/(?:BAHAGIAN\s*2|MARKING SCHEME|SKEMA JAWAPAN|خطة تصحيح)/i);
      if (match && match.index !== undefined) splitIndex = match.index;
    }

    if (splitIndex !== -1) {
        setGeneratedQuestions(fullText.substring(0, splitIndex).trim());
        setGeneratedScheme(fullText.substring(splitIndex).replace('[PENJANAAN SKEMA JAWAPAN]', '').trim());
    } else { 
        setGeneratedQuestions(fullText); 
        setGeneratedScheme(""); 
    }
    setShowLevelModal(false); 
  };

  const handlePrintModal = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Sila izinkan tetingkap pop-up dalam tetapan pelayar anda untuk mencetak.');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${courseCode || 'Soalan'} - ABQARI UiTM</title>
          <style>
            body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.6; padding: 40px; direction: ${language === 'Bahasa Arab' ? 'rtl' : 'ltr'}; text-align: ${language === 'Bahasa Arab' ? 'right' : 'left'}; }
            .header { text-align: center; font-weight: bold; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 10px; text-transform: uppercase; }
            pre { white-space: pre-wrap; font-family: "Times New Roman", serif; font-size: 12pt; }
          </style>
        </head>
        <body>
          <div class="header">${courseCode || ''} ${courseName || ''} (${examPeriod || ''})</div>
          <pre>${tempEditedQuestions}</pre>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea"); textArea.value = text; textArea.style.position = "fixed"; textArea.style.left = "-999999px"; document.body.appendChild(textArea); textArea.focus(); textArea.select();
    try { document.execCommand('copy'); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); } catch (err) { alert('Gagal menyalin teks.'); } document.body.removeChild(textArea);
  };
  const handleCopy = () => {
    const fullText = (generatedQuestions || '') + '\n\n\n' + (generatedScheme || '');
    if (!fullText.trim()) return;
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(fullText).then(() => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }).catch(() => fallbackCopy(fullText)); } else fallbackCopy(fullText);
  };

  const handleDownloadQuestionWord = async () => {
    if (!generatedQuestions) return;
    try {
      const finalSections = {
        A: { ...sections.A, enabled: sections.A.enabled && sections.A.count > 0 },
        B: { ...sections.B, enabled: sections.B.enabled && sections.B.count > 0 },
        C: { ...sections.C, enabled: sections.C.enabled && sections.C.count > 0 }
      };
      const activeCount = [finalSections.A.enabled, finalSections.B.enabled, finalSections.C.enabled].filter(Boolean).length;
      const countText = activeCount === 3 ? 'TIGA' : activeCount === 2 ? 'DUA' : 'SATU';
      let templateFileName = activeCount === 1 ? 'Template_Soalan_1.docx' : activeCount === 2 ? 'Template_Soalan_2.docx' : 'Template_Soalan_3.docx'; 

      const response = await fetch(`/${templateFileName}`);
      if (!response.ok) throw new Error(`Templat ${templateFileName} tidak dijumpai.`);
      const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
      const zip = new PizZip(arrayBuffer); const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      
      doc.render({
        "SUBJEK SUMBER": courseName, "KOD KURSUS": courseCode, "PEPERIKSAAN": examPeriod, "MASA PEPERIKSAAN": duration,
        "TETAPAN_BAHAGIAN": countText, "JUMLAH": activeCount,
        "bil_a": finalSections.A.count, "markah_a": finalSections.A.marks, "bil_b": finalSections.B.count, "markah_b": finalSections.B.marks, "bil_c": finalSections.C.count, "markah_c": finalSections.C.marks,
        "kertas_soalan": formatTextToOOXML(generatedQuestions, language) 
      });
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(out, `${courseCode}_Kertas_Soalan_SET_${setSoalan}.docx`);
    } catch (error) { alert(`Gagal menjana Word.`); }
  };

  const handleDownloadSchemeWord = async () => {
    if (!generatedScheme) return;
    try {
      const response = await fetch('/Template_Skema.docx');
      if (!response.ok) throw new Error('Templat Skema tidak dijumpai.');
      const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
      const zip = new PizZip(arrayBuffer); const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({ "SUBJEK SUMBER": courseName, "KOD KURSUS": courseCode, "PEPERIKSAAN": examPeriod, "SKEMA": formatTextToOOXML(generatedScheme, language) });
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(out, `${courseCode}_Skema_Jawapan_SET_${setSoalan}.docx`);
    } catch (error) { alert('Gagal menjana Word.'); }
  };

  const handleSaveToBank = async () => {
    if (!generatedQuestions) return;
    if (!selectedSubject) {
      alert('Sila pilih subjek di bahagian (1. Maklumat Peperiksaan) terlebih dahulu.');
      return;
    }

    setIsSavingBank(true);
    
    try {
      const { data: existingQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('question_text')
        .eq('subject_id', selectedSubject);

      if (fetchError) throw new Error(`Gagal menyemak Bank Soalan: ${fetchError.message}`);

      const normalizeText = (str: string) => {
        return str
          .replace(/^(?:\d+[\.\)]|BAHAGIAN\s+[A-Z]:?|PART\s+[A-Z]:?)\s*/gi, '')
          .replace(/\\?\[\s*(?:Aras|Level|CO\d*|CLO\d*|LO\d*|PLO\d*|PO\d*|C\d+|P\d+|A\d*)[^\]]*\\?\]/gi, '')
          .replace(/^[A-E]\.\s+.*$/gm, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      const getFingerprint = (str: string) => normalizeText(str).substring(0, 100);

      const existingSet = new Set(
        (existingQuestions || []).map((q: any) => getFingerprint(q.question_text || ''))
      );

      const questionBlocks = generatedQuestions
        .split(/(?=(?:^|\n)\s*(?:BAHAGIAN|PART|الجزء)?\s*[A-Z]?:?\s*\n*\s*\d+[\.\)]\s*)/gi)
        .map((b) => b.replace(/^(?:BAHAGIAN|PART|الجزء)\s+[A-Z]:?\s*/gi, '').trim())
        .filter((b) => b.length > 5 && /^\d+[\.\)]/i.test(b));

      const finalBlocks = questionBlocks.length > 0 ? questionBlocks : [generatedQuestions.trim()];

      const newUniqueBlocks = finalBlocks.filter((block) => {
        const fingerprint = getFingerprint(block);
        return fingerprint.length > 5 && !existingSet.has(fingerprint);
      });

      if (newUniqueBlocks.length === 0) {
        alert('ℹ️ Tiada soalan baharu disimpan. Semua soalan ini telah sedia ada dalam Bank Soalan bagi subjek ini!');
        setIsSavingBank(false);
        return;
      }

      const insertPayload = newUniqueBlocks.map((block) => {
        const bloomMatch = block.match(/\[(C[1-6]|P[1-5]|A[1-5])\]/i);
        const detectedBloom = bloomMatch ? bloomMatch[1].toUpperCase() : 'C1';

        const coMatch = block.match(/\[(CO\d*|CLO\d*)\]/i);
        const detectedCO = coMatch ? coMatch[1].toUpperCase() : (subjectCOs[0] || 'CO1');

        const loMatch = block.match(/\[(LO\d*|PLO\d*)\]/i);
        const detectedLO = loMatch ? loMatch[1].toUpperCase() : (subjectLOs[0] || 'LO1');

        const isObjectiveOrTF = /[A-D]\.[\t\s]|[A-D]\)[\t\s]|\[\s*(BENAR|SALAH|TRUE|FALSE)\s*\]/i.test(block);
        const markVal = isObjectiveOrTF ? 1 : 5;

        return {
          subject_id: selectedSubject,
          question_text: block,
          answer_scheme: '',
          marks: markVal,
          bloom_level: detectedBloom,
          co_code: detectedCO,
          lo_code: detectedLO,
          difficulty: 'Sederhana'
        };
      });

      const { error } = await supabase.from('questions').insert(insertPayload);

      if (!error) {
        setIsSavedBank(true);
        const skippedCount = finalBlocks.length - newUniqueBlocks.length;
        let msg = `✅ Berjaya! ${newUniqueBlocks.length} soalan baharu telah disimpan ke Bank Soalan.`;
        if (skippedCount > 0) {
          msg += `\n\nℹ️ Nota: ${skippedCount} soalan yang serupa/pendua telah ditapis secara automatik.`;
        }
        alert(msg);
        setTimeout(() => setIsSavedBank(false), 3000);
      } else {
        throw new Error(error.message || 'Gagal menyimpan ke Bank Soalan.');
      }
    } catch (error: any) {
      console.error("Ralat menyimpan ke Bank Soalan:", error);
      alert(`Gagal menyimpan ke Bank Soalan: ${error.message}`);
    } finally {
      setIsSavingBank(false);
    }
  };

  // ============================================================
  // FUNGSI JANA ONLINE TEST (DENGAN RECOVERY MEKANISME PELINDUNG GANDA)
  // ============================================================
  const handleCreateOnlineTest = async () => {
    // LANGKAH 2: JIKA SUDAH DITERBITKAN (PAUTAN WUJUD), KLIK KE-2 AKAN BAWA KE DASHBOARD
    if (publishedTestLink) {
      router.push('/');
      return;
    }

    // LANGKAH 1: KLIK KALI PERTAMA (SIMPAN UJIAN DAN JANA PAUTAN PELAJAR)
    if (!testSettings.groupName || !testSettings.testName) {
      alert("Sila lengkapkan butiran Nama Ujian dan Sasaran Kumpulan Pelajar.");
      return;
    }
    
    setIsPublishingTest(true);

    try {
      let totalMarks = 0;
      (['A', 'B', 'C'] as const).forEach(part => {
        if (sections[part].enabled) {
          totalMarks += Number(sections[part].marks || 0);
        }
      });

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const finalStartTime = testSettings.startTime ? new Date(testSettings.startTime).toISOString() : now.toISOString();
      const finalEndTime = testSettings.endTime ? new Date(testSettings.endTime).toISOString() : tomorrow.toISOString();

      // PAYLOAD TERAS (PASTI SELAMAT)
      const corePayload: any = {
        user_id: userProfile.id || null,
        faculty: testSettings.programFaculty || userProfile.faculty || 'Fakulti Umum',
        course_code: testSettings.courseCode || courseCode || 'UMUM',
        course_name: courseName || 'Ujian Umum',
        group_name: testSettings.groupName,
        test_name: testSettings.testName,
        lecturer_name: userProfile.name || 'Pensyarah',
        start_time: finalStartTime,
        end_time: finalEndTime,
        duration_minutes: Number(testSettings.durationMinutes) || 60,
        full_marks: totalMarks,
        questions_data: { rawText: generatedQuestions },
        scheme_data: { rawText: generatedScheme },
        settings: {
          pagination: testSettings.pagination,
          display_style: testSettings.pagination,
          reshuffle: testSettings.reshuffle,
          strictProctoring: testSettings.strictProctoring,
          requireWebcam: testSettings.requireWebcam,
          description: testSettings.description,
          instructions: testSettings.instructions,
          semester: testSettings.semester,
          totalQuestions: testSettings.totalQuestions,
          maxAttempts: testSettings.maxAttempts
        }
      };

      // CUBA INSERT MENGGUNAKAN PAYLOAD PENUH (JIKA DB WUJUD LAJUR KHAS)
      const fullPayload = {
        ...corePayload,
        description: testSettings.description,
        instructions: testSettings.instructions,
        semester: testSettings.semester,
        total_questions: Number(testSettings.totalQuestions) || 0,
        max_attempts: Number(testSettings.maxAttempts) || 1,
        display_style: testSettings.pagination
      };

      let savedData: any = null;
      let { data, error } = await supabase.from('online_tests').insert([fullPayload]).select().single();

      // FALLBACK JIKA SUPABASE PULANGKAN ERROR UNTUK LAJUR TAMBAHAN
      if (error) {
        console.warn("Mencuba semula dengan corePayload...", error);
        const retryRes = await supabase.from('online_tests').insert([corePayload]).select().single();
        if (retryRes.error) {
          throw retryRes.error;
        }
        savedData = retryRes.data;
      } else {
        savedData = data;
      }

      // JANA PAUTAN UNTUK PELAJAR (/intro DIIKUTI BROWSER)
      if (savedData && savedData.id) {
        const testUrl = `${window.location.origin}/ujian/${savedData.id}/intro`;
        setPublishedTestLink(testUrl);
        alert(`✅ Ujian Dalam Talian Berjaya Dicipta!\n\nPautan ujian telah sedia untuk dikongsi kepada pelajar.`);
      }

    } catch (error: any) {
      console.error("Ralat mencipta ujian:", error);
      alert(`Gagal mencipta ujian. Ralat: ${error.message || 'Gagal menyimpan ke pangkalan data'}`);
    } finally {
      setIsPublishingTest(false);
    }
  };

  const handleCopyTestLink = () => {
    if (!publishedTestLink) return;
    navigator.clipboard.writeText(publishedTestLink);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return alert('Sila pilih subjek terlebih dahulu.');
    if (!isAllSectionsValid) return alert('Ralat: Sila pastikan jumlah nilai pecahan Aras Bloom sama dengan Jumlah Soalan.');
    if (!isTopicSectionValid && !isTopicEmpty) return alert('Ralat: Sila pastikan jumlah Wajaran Topik tepat 100%.');
    if (hasValidationErrors) return alert('Ralat: Sila betulkan purata markah sebelum menjana soalan.');

    setIsGenerating(true); 
    setGeneratedQuestions(null); 
    setGeneratedScheme(null); 
    setProgress(10);
    setProgressText('Menjana draf awal soalan secara berurutan...');
    setQuoteText(islamicQuotes[0]);

    const progressMessages = [
      "Mengekstrak rujukan nota (Anti-Halusinasi)...",
      "Semakan silang pematuhan JSU...",
      "Mengemaskini format & jarak...",
      "Menyelaras struktur modular akhir..."
    ];
    
    let msgIndex = 0;
    const intervalId = setInterval(() => {
      setProgressText(progressMessages[msgIndex % progressMessages.length]);
      setQuoteText(islamicQuotes[(msgIndex + 1) % islamicQuotes.length]);
      msgIndex++;
      setProgress((prev) => (prev < 70 ? prev + 10 : prev));
    }, 2500);

    const cost = aiModel === 'gpt-4o' ? 2 : 1;
    const authHeaders = await getAuthHeaders();

    try {
      const creditRes = await fetch('/api/deduct-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ cost })
      });
      const creditData = await creditRes.json();
      
      if (!creditRes.ok || !creditData.success) {
        alert(`❌ GAGAL: Baki kredit harian anda tidak mencukupi untuk menggunakan enjin ini. \n\nSila pilih enjin yang lebih murah (Standard) atau hubungi Pentadbir.\nKos Diperlukan: ${cost} Kredit.`);
        setIsGenerating(false);
        clearInterval(intervalId);
        return;
      }
    } catch (err) {
      console.error("Ralat penolakan kredit:", err);
      alert("Ralat menyemak baki kredit. Sila cuba lagi.");
      setIsGenerating(false);
      clearInterval(intervalId);
      return;
    }

    try {
      const activeParts = (['A', 'B', 'C'] as const).filter(p => sections[p].enabled && sections[p].count > 0);
      let fullQuestionsText = "";

      const activeTopicsList = activeTopics.map(t => `"${t.name}" (${t.percentage}%)`).join(', ');
      const topicStrictPrompt = activeTopics.length > 0 
          ? `\n\n[AMARAN MUTLAK: Anda WAJIB membina soalan secara seimbang dan merangkumi keseluruhan topik berikut mengikut wajaran: ${activeTopicsList}. DILARANG HANYA FOKUS PADA SATU TOPIK SAHAJA!]`
          : '';

      for (const part of activeParts) {
        setProgressText(`Sedang memproses BAHAGIAN ${part}...`);

        const res = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            mode: part,
            subjectId: selectedSubject,
            courseName: courseName + topicStrictPrompt,
            courseCode,
            theme,
            sectionData: sections[part],
            topicDistribution,
            aiModel,
            co: subjectCOs,
            lo: subjectLOs,
            domain: subjectDomains,
            setSoalan,
            language
          }),
        });

        const text = await res.text();
        const json = text ? JSON.parse(text) : {};

        if (!res.ok || !json.success) {
          clearInterval(intervalId);
          setIsGenerating(false);
          alert(`Gagal Menjana Bahagian ${part}:\n${json.error || 'Ralat tidak diketahui'}`);
          return;
        }

        const partTitle = language === 'English' ? `PART ${part}` : language === 'Bahasa Arab' ? `الجزء ${part}` : `BAHAGIAN ${part}`;
        fullQuestionsText += `${partTitle}:\n\n${json.data}\n\n`;
      }

      setGeneratedQuestions(fullQuestionsText.trim());

      setProgress(85);
      setProgressText('Menjana Skema Jawapan penuh...');

      const schemeRes = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          mode: 'SCHEMA',
          subjectId: selectedSubject,
          courseName,
          courseCode,
          fullQuestions: fullQuestionsText.trim(),
          aiModel,
          language
        }),
      });

      const schemeText = await schemeRes.text();
      const schemeData = schemeText ? JSON.parse(schemeText) : {};

      if (schemeRes.ok && schemeData.success) {
        setGeneratedScheme(schemeData.data);
      } else {
        setGeneratedScheme("Skema gagal dijana.");
      }

      try {
        const archiveData = {
          course_code: courseCode || 'TIADA',
          subject_name: courseName || 'Tiada Nama Subjek',
          exam_period: examPeriod || 'Sesi Umum',
          type: theme || 'Umum',
          user_name: userProfile.name,
          questions_text: fullQuestionsText.trim(),
          scheme_text: schemeData?.data || "Tiada skema dijana"
        };

        await fetch('/api/archives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(archiveData)
        });
      } catch (archiveErr) {
        console.error("Amaran: Gagal menghantar salinan ke Arkib.", archiveErr);
      }

      setProgress(100);
      setProgressText('Selesai! Baki kredit anda telah ditolak.');
      setTimeout(() => {
        setIsGenerating(false);
        window.dispatchEvent(new Event('credit-updated')); 
      }, 500);

    } catch (error: any) { 
      clearInterval(intervalId);
      console.error(error);
      alert(`Ralat sistem: ${error.message || 'Gagal memproses soalan.'}`);
      setIsGenerating(false); 
    }
  };

  const styles = {
    card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '25px', position: 'relative' as 'relative', zIndex: 1 },
    sectionTitle: { marginTop: 0, color: '#0f172a', fontSize: '1.1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', fontWeight: '600' as 'bold' },
    label: { fontSize: '0.8rem', fontWeight: '500', color: '#475569', marginBottom: '6px', display: 'block' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', backgroundColor: '#f8fafc', transition: 'all 0.2s', outlineColor: '#3b82f6', fontWeight: '400' },
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '340px', background: 'linear-gradient(135deg, #3b0764, #4a154b)', zIndex: 0 }} />
      <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '45px', paddingTop: '10px' }}>
          
            <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#3b0764',
              backgroundColor: '#fde047',
              padding: '8px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            ← Kembali ke Papan Pemuka
          </Link>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.2rem', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-1px' }}><span style={{ color: '#fde047' }}>ABQARI</span></h1>
            <p style={{ color: '#e2e8f0', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '1px', margin: '0 0 15px 0' }}>ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <CreditBadge/>
            <div style={{ color: 'white', textAlign: 'right', fontSize: '0.85rem' }}>
              <strong style={{ fontSize: '0.95rem', display: 'block', fontWeight: '600' }}>{userProfile.name}</strong>
              <span style={{ color: '#cbd5e1' }}>{userProfile.faculty}</span>
            </div>
          </div>
          
        </div>

        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column' }}>
            
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>1. Maklumat Peperiksaan</h3>
              <label style={styles.label}>Subjek Sumber</label>
              <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={{...styles.input, marginBottom: '10px'}}>
                <option value="">-- Sila Pilih Subjek --</option>
                {subjects.map((s) => (<option key={s.id} value={s.id}>{formatSubjectDisplay(s.course_code, s.name)}</option>))}
              </select>

              {selectedSubject && (
                <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: '600', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📌</span> Pemetaan Hasil Pembelajaran Subjek:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>CO/CLO:</span>
                      {subjectCOs.length > 0 ? subjectCOs.map((co, idx) => (
                        <span key={idx} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #7dd3fc' }}>{co}</span>
                      )) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>LO/PLO:</span>
                      {subjectLOs.length > 0 ? subjectLOs.map((lo, idx) => (
                        <span key={idx} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #c4b5fd' }}>{lo}</span>
                      )) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>Domain:</span>
                      {subjectDomains.length > 0 ? subjectDomains.map((dom, idx) => (
                        <span key={idx} style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #fdba74' }}>{dom}</span>
                      )) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                 <div>
                   <label style={{...styles.label, color: '#16a34a'}}>Tema Soalan</label>
                   <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{...styles.input, borderColor: '#86efac', backgroundColor: '#f0fdf4'}}>
                     <option value="Semua Tema">Semua Tema</option><option value="Sains & Teknologi">Sains & Komputer (IT)</option><option value="Agama">Agama</option><option value="Falsafah">Falsafah</option>
                   </select>
                 </div>
                 <div>
                   <label style={{...styles.label, color: '#0284c7'}}>Set Soalan (Reshuffle)</label>
                   <select value={setSoalan} onChange={(e) => setSetSoalan(e.target.value)} style={{...styles.input, borderColor: '#bae6fd', backgroundColor: '#f0f9ff'}}>
                     {[1,2,3].map(n => <option key={n} value={n}>Set {n}</option>)}
                   </select>
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{...styles.label, color: '#2563eb'}}>Enjin AI Penjana</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={{...styles.input, borderColor: '#bfdbfe', backgroundColor: '#eff6ff'}}>
                    <option value="gpt-4o-mini">Standard (Kos: 1 Kredit)</option>
                    <option value="gpt-4o">Premium (Kos: 2 Kredit)</option>
                  </select>
                </div>
                <div>
                  <label style={{...styles.label, color: '#d97706'}}>Bahasa Pengantar</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{...styles.input, borderColor: '#fde68a', backgroundColor: '#fffbeb'}}>
                    <option value="Bahasa Melayu">Bahasa Melayu</option>
                    <option value="English">English</option>
                    <option value="Bahasa Arab">Bahasa Arab (RTL)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div><label style={styles.label}>Kod Kursus</label><input type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Sesi Peperiksaan</label><input type="text" value={examPeriod} onChange={e => setExamPeriod(e.target.value)} style={styles.input} /></div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div><label style={styles.label}>Nama Kursus</label><input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Masa Peperiksaan</label><input type="text" value={duration} onChange={e => setDuration(e.target.value)} style={styles.input} /></div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>2. Tetapan Bahagian Soalan (Berserta JSU)</h3>
              {(['A', 'B', 'C'] as const).map(part => {
                const currentSum = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].reduce((sum, level) => sum + (sections[part].bloom?.[level] || 0), 0);
                const targetCount = sections[part].count || 0;
                const isMatch = currentSum === targetCount;

                return (
                  <div key={part} style={{ marginBottom: '15px', padding: '15px', backgroundColor: sections[part].enabled ? '#ffffff' : '#f8fafc', borderRadius: '10px', border: sections[part].enabled ? '1px solid #cbd5e1' : '1px dashed #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sections[part].enabled ? '12px' : '0' }}>
                      <label style={{ fontWeight: '600', color: sections[part].enabled ? '#0f172a' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={sections[part].enabled} onChange={e => updateSection(part, 'enabled', e.target.checked)} style={{ marginRight: '10px' }} />BAHAGIAN {part}</label>
                    </div>
                    {sections[part].enabled && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1.2fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Format</span>
                            <select value={sections[part].type} onChange={e => updateSection(part, 'type', e.target.value)} style={styles.input}>
                              <option value="objektif">Objektif (A, B, C, D)</option>
                              <option value="true_false">Benar / Salah</option>
                              <option value="essay">Subjektif / Esei</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}><span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Bil. Soalan</span><input type="number" min="0" value={sections[part].count} onChange={e => updateSection(part, 'count', Number(e.target.value))} style={styles.input} /></div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}><span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Markah Keseluruhan</span><input type="number" min="0" value={sections[part].marks} onChange={e => updateSection(part, 'marks', Number(e.target.value))} style={styles.input} /></div>
                        </div>
                        
                        {(sections[part].type === 'objektif') && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#475569', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                Bilangan Soalan Berlapis (Penyata + Roman):
                                <input type="number" min="0" max={sections[part].count || 0} value={sections[part].beranakCount || 0} onChange={e => updateSection(part, 'beranakCount', Number(e.target.value))} style={{...styles.input, width: '70px', marginLeft: '10px', padding: '4px 8px'}} />
                              </label>

                              <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#0f766e', display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#ccfbf1', padding: '6px 12px', borderRadius: '8px', border: '1px solid #5eead4' }}>
                                <input type="checkbox" checked={sections[part].mixedMode || false} onChange={e => updateSection(part, 'mixedMode', e.target.checked)} style={{ marginRight: '8px' }} />
                                Aktifkan Mod Campuran (20-30% Soalan KECUALI / BENAR / SALAH)
                              </label>
                            </div>
                        )}

                        {/* KEMASKINI BAHARU: SUIS KAWALAN MOD SOALAN TUNGGAL UNTUK FORMAT ESEI / SUBJEKTIF */}
                        {(sections[part].type === 'essay') && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#be185d', display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#fce7f3', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fbcfe8' }}>
                                <input 
                                  type="checkbox" 
                                  checked={sections[part].singleMode || false} 
                                  onChange={e => updateSection(part, 'singleMode', e.target.checked)} 
                                  style={{ marginRight: '10px', width: '16px', height: '16px' }} 
                                />
                                🎯 Aktifkan Mod Soalan Tunggal (Markah Penuh Per Soalan - Tanpa Sub Soalan a, b, c)
                              </label>
                              {sections[part].singleMode && sections[part].count > 0 && sections[part].marks > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontStyle: 'italic', marginLeft: '4px' }}>
                                  ✓ Purata {(sections[part].marks / sections[part].count).toFixed(1)} markah bagi setiap 1 soalan tunggal.
                                </span>
                              )}
                            </div>
                        )}

                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Pecahan Aras Bloom:</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: isMatch ? '#16a34a' : '#dc2626', backgroundColor: isMatch ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: '12px' }}>
                              Jumlah: {currentSum} / {targetCount} {isMatch ? '✓' : '⚠️'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                            {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(level => (
                              <div key={level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: '600' }}>{level}</label><input type="number" min="0" value={sections[part].bloom?.[level] ?? 0} onChange={e => setSections((prev: any) => ({ ...prev, [part]: { ...prev[part], bloom: { ...prev[part].bloom, [level]: Number(e.target.value) } } }))} style={{ width: '100%', padding: '6px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1' }} /></div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '600' }}>3. Cakupan Topik & Wajaran (%) <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal' }}>(Optional)</span></h3>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: isTopicSectionValid ? (isTopicEmpty ? '#64748b' : '#16a34a') : '#dc2626', backgroundColor: isTopicSectionValid ? (isTopicEmpty ? '#f1f5f9' : '#dcfce7') : '#fee2e2', padding: '4px 10px', borderRadius: '12px' }}>
                  {isTopicEmpty ? 'Tidak Ditetapkan' : `Jumlah: ${totalTopicPercentage}% ${isTopicSectionValid ? '✓' : '⚠️'}`}
                </span>
              </div>
              
              {topicDistribution.map((t, i) => (
                 <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input style={{...styles.input, flex: 1}} placeholder="Contoh: Pengenalan kepada Python" value={t.name} onChange={e => updateTopic(i, 'name', e.target.value)} />
                    <input style={{...styles.input, width: '100px'}} placeholder="%" type="number" value={t.percentage} onChange={e => updateTopic(i, 'percentage', e.target.value)} />
                    <button onClick={() => removeTopic(i)} style={{ padding: '0 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>✕</button>
                 </div>
              ))}
              <button onClick={addTopic} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', width: '100%', fontWeight: '500' }}>+ Tambah Topik</button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>4. Ringkasan Aras Bloom (Keseluruhan)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(lvl => (
                   <div key={lvl} style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{lvl}</div>
                      <div style={{ fontSize: '1.2rem', color: '#2563eb', fontWeight: '800' }}>{requestedBloomCounts[lvl as keyof typeof requestedBloomCounts]}</div>
                   </div>
                ))}
              </div>
            </div>
            
            {hasValidationErrors && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '12px', padding: '15px', marginBottom: '20px' }}>
                {validationErrors.map((err, idx) => (
                  <p key={idx} style={{ color: '#dc2626', fontWeight: '500', margin: '0 0 5px 0', fontSize: '0.9rem' }}>
                    <span style={{ marginRight: '8px' }}>🔴</span>{err}
                  </p>
                ))}
              </div>
            )}

            <button 
              onClick={handleGenerate} 
              disabled={isGenerateDisabled} 
              style={{ width: '100%', padding: '18px', backgroundColor: isGenerateDisabled ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: isGenerateDisabled ? 'not-allowed' : 'pointer', marginBottom: '30px' }}
            >
              {isGenerating ? '⚙ Sistem Modular Sedang Memproses...' : (!isAllSectionsValid || !isTopicSectionValid) ? '⚠️ Sila Cukupkan Aras Bloom & Wajaran Topik' : hasValidationErrors ? '⚠️ Betulkan Purata Markah' : '✨ Jana Kertas Soalan & Skema'}
            </button>
          </div>

          <div style={{ flex: '1 1 550px', backgroundColor: '#ffffff', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', minHeight: '800px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: '700' }}>Pratonton Kertas Ujian</h3>
              {generatedQuestions && !isGenerating && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleOpenModal} style={{ padding: '8px 14px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>✏️ Semak Soalan</button>
                  <button onClick={handleCopy} style={{ padding: '8px 14px', backgroundColor: isCopied ? '#dcfce7' : '#f1f5f9', color: isCopied ? '#166534' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>{isCopied ? '✓ Disalin!' : 'Salin'}</button>
                  <button onClick={handleDownloadQuestionWord} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>📄 MS Word</button>
                  {generatedScheme && ( <button onClick={handleDownloadSchemeWord} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>✅ Skema</button> )}
                  
                  <button 
                    onClick={handleSaveToBank} 
                    disabled={isSavingBank}
                    style={{ padding: '8px 14px', backgroundColor: isSavedBank ? '#ecfdf5' : '#4f46e5', color: isSavedBank ? '#047857' : 'white', border: isSavedBank ? '1px solid #34d399' : 'none', borderRadius: '8px', cursor: isSavingBank ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '0.85rem', transition: 'all 0.3s' }}
                  >
                    {isSavingBank ? '⏳ Menyimpan...' : isSavedBank ? '✓ Berjaya Disimpan' : '💾 Simpan ke Bank'}
                  </button>

                  <button 
                    onClick={() => {
                      let countQ = 0;
                      if (generatedQuestions) {
                        const matches = generatedQuestions.match(/(?:^|\n)\s*(?:BAHAGIAN|PART|الجزء)?\s*[A-Z]?:?\s*\n*\s*\d+[\.\)]/gi);
                        countQ = matches ? matches.length : 0;
                      }
                      setTestSettings(prev => ({ 
                        ...prev, 
                        courseCode: courseCode || prev.courseCode,
                        totalQuestions: countQ || prev.totalQuestions 
                      }));
                      setPublishedTestLink(''); 
                      setShowOnlineTestModal(true);
                    }} 
                    style={{ padding: '8px 14px', backgroundColor: '#be185d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', boxShadow: '0 4px 6px -1px rgba(190, 24, 93, 0.4)' }}
                  >
                    🌐 Jadikan Ujian Online
                  </button>
                </div>
              )}
            </div>

            {isGenerating ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '60px', height: '60px', border: '5px solid #f1f5f9', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                
                <div style={{ width: '80%', backgroundColor: '#e2e8f0', borderRadius: '10px', height: '14px', marginBottom: '15px', overflow: 'hidden' }}>
                   <div style={{ width: `${progress}%`, backgroundColor: '#2563eb', height: '100%', transition: 'width 0.5s ease-in-out' }}></div>
                </div>
                <div style={{ fontWeight: '800', color: '#2563eb', fontSize: '1.2rem', marginBottom: '10px' }}>{progress}%</div>

                <p style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.1rem', marginBottom: '10px' }}>{progressText}</p>
                <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', maxWidth: '80%', transition: 'opacity 0.5s ease-in-out' }}>{quoteText}</p>
              </div>
            ) : generatedQuestions ? (
              <div style={{ flex: 1, whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.1rem', color: '#000000', backgroundColor: '#ffffff', padding: '40px 50px', borderRadius: '4px', border: '1px solid #cbd5e1', overflowY: 'auto', 
              direction: language === 'Bahasa Arab' ? 'rtl' : 'ltr', textAlign: language === 'Bahasa Arab' ? 'right' : 'left' }}>
                  <div style={{ marginBottom: '50px'}}>{renderHighlightedText(generatedQuestions)}</div>
                  {generatedScheme && (
                      <div style={{ borderTop: '2px dashed #94a3b8', paddingTop: '30px' }}>
                          <h4 style={{ color: '#166534', margin: '0 0 15px 0', fontFamily: '"Inter", sans-serif' }}>--- PEMISAH: SKEMA JAWAPAN ---</h4>
                          <div>{renderHighlightedText(generatedScheme)}</div>
                      </div>
                  )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>Ruangan Kertas Ujian Kosong</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLevelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '950px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600' }}>
                <span>✏️</span> Semakan Teks & JSU
              </h2>
              
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                <button 
                  onClick={() => setModalMode('preview')} 
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontWeight: '500', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: modalMode === 'preview' ? '#2563eb' : 'transparent', color: modalMode === 'preview' ? 'white' : '#475569' }}
                >
                  🎨 Paparan Tag Berwarna
                </button>
                <button 
                  onClick={() => setModalMode('edit')} 
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontWeight: '500', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: modalMode === 'edit' ? '#2563eb' : 'transparent', color: modalMode === 'edit' ? 'white' : '#475569' }}
                >
                  📝 Mod Suntingan Teks
                </button>
              </div>

              <button onClick={() => setShowLevelModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <div style={{ padding: '30px', overflowY: 'auto', flex: 1, backgroundColor: '#f1f5f9' }}>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                
                {modalMode === 'preview' ? (
                  <div style={{ minHeight: '450px', whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.05rem', color: '#000000', direction: language === 'Bahasa Arab' ? 'rtl' : 'ltr', textAlign: language === 'Bahasa Arab' ? 'right' : 'left' }}>
                    {renderHighlightedText(tempEditedQuestions)}
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '15px', color: '#475569', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                      <span>💡</span>
                      <p style={{ margin: 0 }}><strong>Mod Sunting Teks:</strong> Anda boleh mengubah sebarang ayat penyata atau tag JSU secara manual. Selepas selesai, tukar ke <strong>Paparan Tag Berwarna</strong> untuk melihat hasilnya.</p>
                    </div>
                    <textarea
                      value={tempEditedQuestions}
                      onChange={(e) => setTempEditedQuestions(e.target.value)}
                      style={{ width: '100%', minHeight: '450px', padding: '20px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '1rem', fontFamily: '"Times New Roman", Times, serif', lineHeight: '1.6', resize: 'vertical',
                      direction: language === 'Bahasa Arab' ? 'rtl' : 'ltr', textAlign: language === 'Bahasa Arab' ? 'right' : 'left' }}
                      placeholder="Sunting soalan anda di sini..."
                    />
                  </>
                )}

              </div>
            </div>

            <div style={{ padding: '20px 30px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', flexWrap: 'wrap', gap: '10px' }}>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={handlePrintModal} 
                  style={{ padding: '10px 16px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🖨️ Cetak / PDF
                </button>
                <button 
                  onClick={() => { handleSaveChanges(); setTimeout(() => handleDownloadQuestionWord(), 300); }} 
                  style={{ padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📄 MS Word (Soalan)
                </button>
                {generatedScheme && (
                  <button 
                    onClick={() => { handleSaveChanges(); setTimeout(() => handleDownloadSchemeWord(), 300); }} 
                    style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ✅ MS Word (Skema)
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowLevelModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleSaveChanges} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>💾 Simpan Perubahan</button>
              </div>

            </div>
            
          </div>
        </div>
      )}

      {/* MODAL TETAPAN UJIAN DALAM TALIAN */}
      {showOnlineTestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            
            <div style={{ padding: '16px 24px', backgroundColor: '#be185d', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🌐 Tetapan Ujian Dalam Talian
              </h2>
              <button onClick={() => setShowOnlineTestModal(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* BAHAGIAN 1: MAKLUMAT AKADEMIK & ASAS */}
              <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#be185d', fontSize: '0.92rem', fontWeight: '600' }}>📋 Maklumat Akademik & Subjek</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={styles.label}>Nama Program / Fakulti</label>
                    <input type="text" value={testSettings.programFaculty} onChange={(e) => setTestSettings({...testSettings, programFaculty: e.target.value})} style={styles.input} placeholder="Cth: Fakulti Sains Komputer" disabled={!!publishedTestLink} />
                  </div>

                  <div>
                    <label style={styles.label}>Kod Kursus</label>
                    <input type="text" value={testSettings.courseCode} onChange={(e) => setTestSettings({...testSettings, courseCode: e.target.value})} style={styles.input} placeholder="Cth: CTU556" disabled={!!publishedTestLink} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={styles.label}>Tajuk Ujian</label>
                    <input type="text" value={testSettings.testName} onChange={(e) => setTestSettings({...testSettings, testName: e.target.value})} style={styles.input} placeholder="Cth: Ujian Akhir Semester" disabled={!!publishedTestLink} />
                  </div>

                  <div>
                    <label style={styles.label}>Semester / Sesi {isAdmin ? '' : '🔒'}</label>
                    <select 
                      value={testSettings.semester} 
                      onChange={(e) => setTestSettings({...testSettings, semester: e.target.value})} 
                      style={{...styles.input, backgroundColor: (isAdmin && !publishedTestLink) ? 'white' : '#e2e8f0', cursor: (isAdmin && !publishedTestLink) ? 'pointer' : 'not-allowed', color: (isAdmin && !publishedTestLink) ? '#0f172a' : '#64748b'}}
                      disabled={!isAdmin || !!publishedTestLink}
                    >
                      {managedSemesters.length > 0 ? (
                        managedSemesters.map((sem, idx) => (
                          <option key={sem.id || idx} value={sem.name}>{sem.name}</option>
                        ))
                      ) : (
                        <option value="Semester 1">Semester 1</option>
                      )}
                    </select>
                    {!isAdmin && !publishedTestLink && <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'block', marginTop: '4px' }}>*Hanya pentadbir boleh menukar sesi.</span>}
                  </div>
                </div>

                <div>
                  <label style={styles.label}>Sasaran Kumpulan Pelajar</label>
                  <input type="text" value={testSettings.groupName} onChange={(e) => setTestSettings({...testSettings, groupName: e.target.value})} style={styles.input} placeholder="Cth: IC1201A, IC1201B" disabled={!!publishedTestLink} />
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>*Pelajar perlu memilih kumpulan ini semasa mendaftar ujian.</span>
                </div>
              </div>

              {/* BAHAGIAN 2: DESKRIPSI & ARAHAN */}
              <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#be185d', fontSize: '0.92rem', fontWeight: '600' }}>📝 Deskripsi & Arahan Soalan</h4>

                <div style={{ marginBottom: '15px' }}>
                  <label style={styles.label}>Deskripsi Ujian</label>
                  <textarea rows={2} value={testSettings.description} onChange={(e) => setTestSettings({...testSettings, description: e.target.value})} style={{...styles.input, fontFamily: 'inherit'}} placeholder="Penjelasan ringkas mengenai skop ujian..." disabled={!!publishedTestLink} />
                </div>

                <div>
                  <label style={styles.label}>Arahan Kepada Calon (Pilihan / Optional)</label>
                  <textarea rows={2} value={testSettings.instructions} onChange={(e) => setTestSettings({...testSettings, instructions: e.target.value})} style={{...styles.input, fontFamily: 'inherit'}} placeholder="Arahan khas contohnya: Jawab semua soalan dalam Bahagian A..." disabled={!!publishedTestLink} />
                </div>
              </div>

              {/* BAHAGIAN 3: MASA, PERCUBAAN & BILANGAN SOALAN */}
              <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#be185d', fontSize: '0.92rem', fontWeight: '600' }}>⏱️ Masa, Percubaan & Bilangan Soalan</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={styles.label}>Tarikh & Masa Dibuka</label>
                    <input type="datetime-local" value={testSettings.startTime} onChange={(e) => setTestSettings({...testSettings, startTime: e.target.value})} style={styles.input} disabled={!!publishedTestLink} />
                  </div>
                  <div>
                    <label style={styles.label}>Tarikh & Masa Ditutup</label>
                    <input type="datetime-local" value={testSettings.endTime} onChange={(e) => setTestSettings({...testSettings, endTime: e.target.value})} style={styles.input} disabled={!!publishedTestLink} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={styles.label}>Had Masa (Minit)</label>
                    <input type="number" min="1" value={testSettings.durationMinutes} onChange={(e) => setTestSettings({...testSettings, durationMinutes: Number(e.target.value)})} style={styles.input} disabled={!!publishedTestLink} />
                  </div>

                  <div>
                    <label style={styles.label}>Jumlah Soalan (Auto-Capture)</label>
                    <input 
                      type="number" 
                      value={testSettings.totalQuestions} 
                      readOnly 
                      style={{ ...styles.input, backgroundColor: '#f1f5f9', color: '#be185d', fontWeight: '600', cursor: 'not-allowed' }} 
                      title="Diimbas secara automatik daripada senarai soalan yang dijana"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Bil. Percubaan</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={testSettings.maxAttempts} 
                      onChange={(e) => setTestSettings({...testSettings, maxAttempts: Number(e.target.value)})} 
                      style={styles.input} 
                      disabled={!!publishedTestLink}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      * 1 = sekali sahaja, 2 = 2 kali, dsb.
                    </span>
                  </div>
                </div>
              </div>

              {/* BAHAGIAN 4: PAPARAN & KESELAMATAN */}
              <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#be185d', fontSize: '0.92rem', fontWeight: '600' }}>⚙️ Tetapan Paparan & Keselamatan</h4>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={styles.label}>Gaya Paparan Soalan</label>
                  <select value={testSettings.pagination} onChange={(e) => setTestSettings({...testSettings, pagination: e.target.value})} style={styles.input} disabled={!!publishedTestLink}>
                    <option value="all">Semua Sebaris (Satu Halaman Penuh)</option>
                    <option value="section">Mengikut Bahagian (Bahagian A, B, C)</option>
                    <option value="single">Satu Soalan Satu Paparan (Strict)</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: publishedTestLink ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#334155', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={testSettings.reshuffle} onChange={(e) => setTestSettings({...testSettings, reshuffle: e.target.checked})} style={{ marginRight: '10px', width: '16px', height: '16px' }} disabled={!!publishedTestLink} />
                  Susun Atur Rawak (Reshuffle Soalan & Pilihan Jawapan)
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', cursor: publishedTestLink ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#be185d', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={testSettings.strictProctoring} onChange={(e) => setTestSettings({...testSettings, strictProctoring: e.target.checked})} style={{ marginRight: '10px', width: '16px', height: '16px', marginTop: '2px' }} disabled={!!publishedTestLink} />
                  <div>
                    Aktifkan Pengawasan Ketat (Strict Proctoring)
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Halang Copy-Paste, pengesanan Tab dilarang, dan wajibkan Skrin Penuh (Fullscreen).</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', cursor: publishedTestLink ? 'not-allowed' : 'pointer', fontWeight: '500', color: '#7c3aed', marginTop: '12px', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={testSettings.requireWebcam} onChange={(e) => setTestSettings({...testSettings, requireWebcam: e.target.checked})} style={{ marginRight: '10px', width: '16px', height: '16px', marginTop: '2px' }} disabled={!!publishedTestLink} />
                  <div>
                    Aktifkan Pemantauan Kamera AI (Face Tracking)
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>Mewajibkan akses webkam pelajar. Sistem akan merakam pergerakan muka dan memberi amaran jika wajah tidak dikesan.</div>
                  </div>
                </label>
              </div>

              {/* BAHAGIAN 5: MEDAN PAUTAN AKSES UJIAN PELAJAR */}
              <div style={{ backgroundColor: publishedTestLink ? '#f0fdf4' : '#f8fafc', padding: '18px', borderRadius: '12px', border: `1px solid ${publishedTestLink ? '#86efac' : '#e2e8f0'}` }}>
                <h4 style={{ margin: '0 0 10px 0', color: publishedTestLink ? '#166534' : '#be185d', fontSize: '0.92rem', fontWeight: '600' }}>
                  🔗 Pautan Akses Ujian Pelajar
                </h4>
                
                {publishedTestLink ? (
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#15803d', fontWeight: '500' }}>
                      Pautan ujian telah sedia! Salin dan kongsikan pautan ini kepada pelajar anda:
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={publishedTestLink} readOnly style={{ ...styles.input, backgroundColor: 'white', color: '#0f172a', fontWeight: '500' }} />
                      <button 
                        type="button"
                        onClick={handleCopyTestLink} 
                        style={{ padding: '8px 16px', backgroundColor: isCopiedLink ? '#16a34a' : '#15803d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                      >
                        {isCopiedLink ? '✅ Tersalin!' : '📋 Salin Pautan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                    * Pautan rasmi ujian akan dijana secara automatik sebaik sahaja anda menekan butang "Klik untuk Proses".
                  </p>
                )}
              </div>

            </div>

            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowOnlineTestModal(false)} 
                style={{ padding: '8px 18px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Batal
              </button>
              
              <button 
                onClick={handleCreateOnlineTest} 
                disabled={isPublishingTest}
                style={{ padding: '8px 20px', backgroundColor: publishedTestLink ? '#16a34a' : '#be185d', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: isPublishingTest ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
              >
                {isPublishingTest ? '⏳ Memproses...' : publishedTestLink ? '🚀 Terbitkan Ujian Sekarang' : '⚙️ Klik untuk Proses'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}