'use client';

import { useState, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import Link from 'next/link';
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

export default function PenjanaSoalanPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');

  const [userProfile, setUserProfile] = useState<{name: string; faculty: string;}>({
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

  const [sections, setSections] = useState<any>({
    A: { enabled: true, type: 'objektif', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0 },
    B: { enabled: true, type: 'true_false', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0 },
    C: { enabled: true, type: 'essay', count: 0, marks: 0, bloom: { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 }, beranakCount: 0 }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string | null>(null);
  const [generatedScheme, setGeneratedScheme] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // State untuk fungsi simpan ke Bank Soalan
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isSavedBank, setIsSavedBank] = useState(false);
  
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [modalMode, setModalMode] = useState<'preview' | 'edit'>('preview');
  const [tempEditedQuestions, setTempEditedQuestions] = useState('');
  
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Sedia untuk menjana...');
  const [quoteText, setQuoteText] = useState('Meningkatkan ketepatan format menggunakan seni bina modular...');

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          setUserProfile({ name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Pengguna ABQARI', faculty: meta.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)', });
        } else if (localUser) {
          try { const parsed = JSON.parse(localUser); setUserProfile({ name: parsed.name || 'Pengguna ABQARI', faculty: parsed.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)', }); } catch (e) {}
        }
      } catch (err) { console.error('Ralat:', err); }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/subjects', { headers: { ...authHeaders } });
        const json = await response.json();
        if (json.success) setSubjects(json.data);
      } catch (error) { console.error('Ralat:', error); }
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
      setSubjectCOs(Array.isArray(sub.co) ? sub.co : []);
      setSubjectLOs(Array.isArray(sub.lo) ? sub.lo : []);
      setSubjectDomains(Array.isArray(sub.domain) ? sub.domain : (sub.domain ? [sub.domain] : ['C1', 'C2', 'C3', 'P3', 'P4']));
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

  const isGenerateDisabled = isGenerating || !isAllSectionsValid || !isTopicSectionValid;

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\\?\[\s*(?:Aras|Level|Aras Bloom|CO\d*|LO\d*|PO\d*|C\d+|P\d+|A\d+|Rujukan|Topik)[^\]]*\\?\])/gi);
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
      if (part.match(/\[CO\d*\]/i) || part.match(/\[CO:/i)) return <span key={index} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #7dd3fc`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
      if (part.match(/\[LO\d*\]/i) || part.match(/\[PO\d*\]/i) || part.match(/\[LO:/i)) return <span key={index} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #c4b5fd`, marginLeft: '3px', marginRight: '3px', fontSize: '0.8rem' }}>{part.replace(/\\/g, '')}</span>;
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
      // Mengira jumlah markah keseluruhan yang ditetapkan
      const totalMarks = (sections.A.enabled ? sections.A.marks : 0) + 
                         (sections.B.enabled ? sections.B.marks : 0) + 
                         (sections.C.enabled ? sections.C.marks : 0) || 100;

      const payload = {
        subject_id: selectedSubject,
        question_text: generatedQuestions,
        answer_scheme: generatedScheme || '',
        marks: totalMarks,
        bloom_level: 'Campuran',
        co_code: subjectCOs[0] || 'CO1',
        lo_code: subjectLOs[0] || 'LO1',
        difficulty: 'Sederhana'
      };

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIsSavedBank(true);
        setTimeout(() => setIsSavedBank(false), 3000);
      } else {
        throw new Error(json.error || 'Gagal menyimpan ke Bank Soalan.');
      }
    } catch (error: any) {
      console.error("Ralat menyimpan ke Bank Soalan:", error);
      alert(`Gagal menyimpan ke Bank Soalan: ${error.message}`);
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return alert('Sila pilih subjek terlebih dahulu.');
    if (!isAllSectionsValid) return alert('Ralat: Sila pastikan jumlah nilai pecahan Aras Bloom sama dengan Jumlah Soalan.');
    if (!isTopicSectionValid && !isTopicEmpty) return alert('Ralat: Sila pastikan jumlah Wajaran Topik tepat 100%.');

    setIsGenerating(true); 
    setGeneratedQuestions(null); 
    setGeneratedScheme(null); 
    setProgress(10);
    setProgressText('Menjana draf awal soalan (Parallel)...');

    const progressMessages = [
      "Mengekstrak rujukan silabus rasmi (Anti-Halusinasi)...",
      "Semakan silang pematuhan JSU....",
      "Mengemaskini format & jarak....",
      "Menapis & menyemak tatabahasa....",
      "Menyelaras struktur modular akhir..."
    ];
    
    const progressQuotes = [
      '"Sesiapa yang menempuh jalan untuk menuntut ilmu, Allah akan memudahkan baginya jalan ke syurga." (HR. Muslim)',
      '"Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lain." (HR. Ahmad)',
      '"Ilmu itu bukan yang dihafal, tetapi yang memberi manfaat." (Imam as-Syafie)',
      '"Guru ibarat pelita, membakar diri untuk menerangi jalan generasi masa hadapan."',
      '"Ketenangan dan kesabaran adalah kunci kepada hasil kerja yang sempurna. Sedikit masa lagi..."'
    ];

    let msgIndex = 0;
    setQuoteText(progressQuotes[0]);

    const intervalId = setInterval(() => {
      setProgressText(progressMessages[msgIndex % progressMessages.length]);
      setQuoteText(progressQuotes[msgIndex % progressQuotes.length]);
      msgIndex++;
      setProgress((prev) => (prev < 50 ? prev + 5 : prev));
    }, 3500);

    try {
      const activeParts = (['A', 'B', 'C'] as const).filter(p => sections[p].enabled && sections[p].count > 0);
      const authHeaders = await getAuthHeaders();

      const promises = activeParts.map(part => {
        return fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            mode: part,
            courseName,
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
      });

      const responseObjs = await Promise.all(promises);
      
      // TAMBAHAN: Semak respon untuk had kredit (HTTP 429)
      for (const res of responseObjs) {
        if (res.status === 429) {
           const errData = await res.json();
           clearInterval(intervalId);
           setIsGenerating(false);
           alert(errData.error || "Had kredit harian telah dicapai.");
           return; // Hentikan penjanaan serta merta
        }
      }

      const results = await Promise.all(responseObjs.map(res => res.json()));
      
      clearInterval(intervalId);
      setProgress(60);
      setProgressText('Menyatukan hasil soalan modular...');

      let fullQuestionsText = "";
      activeParts.forEach((part, index) => {
        const partTitle = language === 'English' ? `PART ${part}` : language === 'Bahasa Arab' ? `الجزء ${part}` : `BAHAGIAN ${part}`;
        const dataText = results[index]?.data || `[Gagal menjana Bahagian ${part}]`;
        fullQuestionsText += `${partTitle}:\n\n${dataText}\n\n`;
      });
      
      setGeneratedQuestions(fullQuestionsText.trim());

      setProgress(80);
      setProgressText('Menjana Skema Jawapan penuh...');

      const schemeRes = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          mode: 'SCHEMA',
          courseName,
          courseCode,
          fullQuestions: fullQuestionsText.trim(),
          aiModel,
          language
        }),
      });

      const schemeData = await schemeRes.json();
      setGeneratedScheme(schemeData?.data || "Skema gagal dijana.");

      // AUTO-SIMPAN KE DALAM JADUAL 'archives' MELALUI API
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

        const archiveRes = await fetch('/api/archives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(archiveData)
        });

        const archiveJson = await archiveRes.json();
        
        if (!archiveRes.ok || !archiveJson.success) {
           throw new Error(archiveJson.error || "Ralat tidak diketahui");
        }
        
        console.log("Salinan berjaya dihantar ke Arkib Admin secara automatik.");
      } catch (archiveErr) {
        console.error("Amaran: Gagal menghantar salinan ke Arkib.", archiveErr);
      }

      setProgress(100);
      setProgressText('Selesai!');
      setTimeout(() => setIsGenerating(false), 800);
      
    } catch (error) { 
      clearInterval(intervalId);
      console.error(error);
      alert("Ralat sistem semasa memproses secara modular.");
      setIsGenerating(false); 
    }
  };

  const styles = {
    card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '25px', position: 'relative' as 'relative', zIndex: 1 },
    sectionTitle: { marginTop: 0, color: '#0f172a', fontSize: '1.15rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', fontWeight: 'bold' as 'bold' },
    label: { fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#f8fafc', transition: 'all 0.2s', outlineColor: '#3b82f6' },
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
            <h1 style={{ fontSize: '3.2rem', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '-1px' }}><span style={{ color: '#fde047' }}>ABQARI</span></h1>
            <p style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '700', letterSpacing: '1px', margin: '0 0 15px 0' }}>SISTEM PENJANA MODULAR BERSEPADU (M.I.G.S)</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <CreditBadge/>
            <div style={{ color: 'white', textAlign: 'right', fontSize: '0.85rem' }}>
              <strong style={{ fontSize: '0.95rem', display: 'block' }}>{userProfile.name}</strong>
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
                  <div style={{ fontWeight: 'bold', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📌</span> Pemetaan Hasil Pembelajaran Subjek:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>CO/CLO:</span>
                      {subjectCOs.length > 0 ? subjectCOs.map((co, idx) => (
                        <span key={idx} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #7dd3fc' }}>{co}</span>
                      )) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>LO/PLO:</span>
                      {subjectLOs.length > 0 ? subjectLOs.map((lo, idx) => (
                        <span key={idx} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #c4b5fd' }}>{lo}</span>
                      )) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Domain:</span>
                      {subjectDomains.length > 0 ? subjectDomains.map((dom, idx) => (
                        <span key={idx} style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #fdba74' }}>{dom}</span>
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
                     {[1,2,3,4,5].map(n => <option key={n} value={n}>Set {n}</option>)}
                   </select>
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{...styles.label, color: '#2563eb'}}>Enjin AI Penjana</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={{...styles.input, borderColor: '#bfdbfe', backgroundColor: '#eff6ff'}}>
                    <option value="gpt-4o-mini">Standard (Patuh Format)</option>
                    <option value="gpt-4o">Premium (Kreativiti Tinggi)</option>
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
                      <label style={{ fontWeight: 'bold', color: sections[part].enabled ? '#0f172a' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={sections[part].enabled} onChange={e => updateSection(part, 'enabled', e.target.checked)} style={{ marginRight: '10px' }} />BAHAGIAN {part}</label>
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
                           <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                Bilangan Soalan Beranak (Penyata + Roman):
                                <input type="number" min="0" max={sections[part].count || 0} value={sections[part].beranakCount || 0} onChange={e => updateSection(part, 'beranakCount', Number(e.target.value))} style={{...styles.input, width: '70px', marginLeft: '10px', padding: '4px 8px'}} />
                              </label>
                           </div>
                        )}

                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Pecahan Aras Bloom:</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isMatch ? '#16a34a' : '#dc2626', backgroundColor: isMatch ? '#dcfce7' : '#fee2e2', padding: '4px 10px', borderRadius: '12px' }}>
                              Jumlah: {currentSum} / {targetCount} {isMatch ? '✓' : '⚠️'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                            {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(level => (
                              <div key={level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 'bold' }}>{level}</label><input type="number" min="0" value={sections[part].bloom?.[level] ?? 0} onChange={e => setSections((prev: any) => ({ ...prev, [part]: { ...prev[part], bloom: { ...prev[part].bloom, [level]: Number(e.target.value) } } }))} style={{ width: '100%', padding: '6px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1' }} /></div>
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
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 'bold' }}>3. Cakupan Topik & Wajaran (%) <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>(Optional)</span></h3>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isTopicSectionValid ? (isTopicEmpty ? '#64748b' : '#16a34a') : '#dc2626', backgroundColor: isTopicSectionValid ? (isTopicEmpty ? '#f1f5f9' : '#dcfce7') : '#fee2e2', padding: '4px 10px', borderRadius: '12px' }}>
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
              <button onClick={addTopic} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', width: '100%', fontWeight: 'bold' }}>+ Tambah Topik</button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>4. Ringkasan Aras Bloom (Keseluruhan)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                {['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(lvl => (
                   <div key={lvl} style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{lvl}</div>
                      <div style={{ fontSize: '1.2rem', color: '#2563eb', fontWeight: '900' }}>{requestedBloomCounts[lvl as keyof typeof requestedBloomCounts]}</div>
                   </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={isGenerateDisabled} 
              style={{ width: '100%', padding: '18px', backgroundColor: isGenerateDisabled ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isGenerateDisabled ? 'not-allowed' : 'pointer', marginBottom: '30px' }}
            >
              {isGenerating ? '⚙️ Sistem Modular Sedang Memproses...' : (!isAllSectionsValid || !isTopicSectionValid) ? '⚠️ Sila Cukupkan Aras Bloom & Wajaran Topik' : '✨ Jana Kertas Soalan & Skema'}
            </button>
          </div>

          <div style={{ flex: '1 1 550px', backgroundColor: '#ffffff', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', minHeight: '800px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem', fontWeight: '800' }}>Pratonton Kertas Ujian</h3>
              {generatedQuestions && !isGenerating && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleOpenModal} style={{ padding: '8px 14px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>✏️ Semak Soalan</button>
                  <button onClick={handleCopy} style={{ padding: '8px 14px', backgroundColor: isCopied ? '#dcfce7' : '#f1f5f9', color: isCopied ? '#166534' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>{isCopied ? '✓ Disalin!' : 'Salin'}</button>
                  <button onClick={handleDownloadQuestionWord} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>📄 MS Word</button>
                  {generatedScheme && ( <button onClick={handleDownloadSchemeWord} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>✅ Skema</button> )}
                  
                  {/* BUTANG DIKEMAS KINI: Simpan ke Bank Soalan */}
                  <button 
                    onClick={handleSaveToBank} 
                    disabled={isSavingBank}
                    style={{ padding: '8px 14px', backgroundColor: isSavedBank ? '#ecfdf5' : '#4f46e5', color: isSavedBank ? '#047857' : 'white', border: isSavedBank ? '1px solid #34d399' : 'none', borderRadius: '8px', cursor: isSavingBank ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.3s' }}
                  >
                    {isSavingBank ? '⏳ Menyimpan...' : isSavedBank ? '✓ Berjaya Disimpan' : '💾 Simpan ke Bank'}
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

                <p style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '10px' }}>{progressText}</p>
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
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>✏️</span> Semakan Teks & JSU
              </h2>
              
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                <button 
                  onClick={() => setModalMode('preview')} 
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: modalMode === 'preview' ? '#2563eb' : 'transparent', color: modalMode === 'preview' ? 'white' : '#475569' }}
                >
                  🎨 Paparan Tag Berwarna
                </button>
                <button 
                  onClick={() => setModalMode('edit')} 
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: modalMode === 'edit' ? '#2563eb' : 'transparent', color: modalMode === 'edit' ? 'white' : '#475569' }}
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
                  style={{ padding: '10px 16px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🖨️ Cetak / PDF
                </button>
                <button 
                  onClick={() => { handleSaveChanges(); setTimeout(() => handleDownloadQuestionWord(), 300); }} 
                  style={{ padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📄 MS Word (Soalan)
                </button>
                {generatedScheme && (
                  <button 
                    onClick={() => { handleSaveChanges(); setTimeout(() => handleDownloadSchemeWord(), 300); }} 
                    style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ✅ MS Word (Skema)
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowLevelModal(false)} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleSaveChanges} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan Perubahan</button>
              </div>

            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}