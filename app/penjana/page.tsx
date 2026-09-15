'use client';

import { useState, useEffect } from 'react';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DATA PEMETAAN ---
const BLOOM_TAXONOMY = [
  { level: 'C1', name: 'Pengetahuan' },
  { level: 'C2', name: 'Pemahaman' },
  { level: 'C3', name: 'Aplikasi' },
  { level: 'C4', name: 'Analisis' },
  { level: 'C5', name: 'Sintesis' },
  { level: 'C6', name: 'Penilaian' }
];

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

const formatTextToOOXML = (text: string) => {
  if (!text) return '';
  const lines = text.split('\n');
  let xml = '';
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === '') {
      xml += `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`;
      return;
    }

    let jc = '<w:jc w:val="both"/>'; 
    let ind = ''; let tabs = ''; let runContent = ''; let isBold = false;
    
    // PEMBUANG TAG UNTUK MS WORD
    let cleanText = trimmed.replace(/\*\*/g, '').replace(/\[(?:Aras|C|P|A|LO|CO)[^\]]*\]/gi, '').trim();

    const optMatch = cleanText.match(/^([A-D]\.|[a-z]\))\s+(.*)/);
    const qMatch = cleanText.match(/^(\d+\.)\s+(.*)/);

    if (cleanText.startsWith('BAHAGIAN') || cleanText.startsWith('SOALAN')) {
      isBold = true;
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    } 
    else if (optMatch) {
      ind = '<w:ind w:left="1080" w:hanging="360"/>';
      tabs = '<w:tabs><w:tab w:val="left" w:pos="1080"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(optMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(optMatch[2])}</w:t>`;
    } 
    else if (qMatch) {
      ind = '<w:ind w:left="720" w:hanging="360"/>';
      tabs = '<w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs>';
      runContent = `<w:t xml:space="preserve">${escapeXml(qMatch[1])}</w:t><w:tab/><w:t xml:space="preserve">${escapeXml(qMatch[2])}</w:t>`;
    } 
    else {
      runContent = `<w:t xml:space="preserve">${escapeXml(cleanText)}</w:t>`;
    }

    let fontSettings = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/>';
    let rPr = `<w:rPr>${fontSettings}${isBold ? '<w:b/>' : ''}</w:rPr>`;
    xml += `<w:p><w:pPr>${jc}${ind}${tabs}<w:spacing w:after="120"/></w:pPr><w:r>${rPr}${runContent}</w:r></w:p>`;
  });
  return xml;
};

// FUNGSI PINTAR: Memastikan susunan sentiasa "KOD - NAMA" secara sekata
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

  // State Profil Pengguna Dinamik Supabase
  const [userProfile, setUserProfile] = useState<{
    name: string;
    faculty: string;
  }>({
    name: 'Pengguna ABQARI',
    faculty: 'Akademi Pengajian Islam Kontemporari (ACIS)',
  });

  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [examPeriod, setExamPeriod] = useState('JULAI 2026');
  const [duration, setDuration] = useState('2 JAM');
  const [theme, setTheme] = useState('Semua Tema');
  const [setSoalan, setSetSoalan] = useState('1');
  
  const [subjectCOs, setSubjectCOs] = useState<string[]>([]);
  const [subjectLOs, setSubjectLOs] = useState<string[]>([]);

  const [topicDistribution, setTopicDistribution] = useState<{name: string, percentage: string}[]>([
    { name: '', percentage: '' }
  ]);

  const [sections, setSections] = useState({
    A: { enabled: true, type: 'objektif', count: 20, marks: 20 },
    B: { enabled: true, type: 'true_false', count: 20, marks: 20 },
    C: { enabled: true, type: 'essay', count: 2, marks: 20 }
  });

  // --- STATE KAWALAN SOALAN BERTINGKAT (DISEMBUNYIKAN UI) ---
  const [enableSubQuestions, setEnableSubQuestions] = useState(false);
  const [subQuestionCount, setSubQuestionCount] = useState(5);

  const [bloomCounts, setBloomCounts] = useState({ C1: 10, C2: 10, C3: 5, C4: 5, C5: 0, C6: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string | null>(null);
  const [generatedScheme, setGeneratedScheme] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [tempEditedQuestions, setTempEditedQuestions] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  // 1. Pengambilan Profil Pengguna Dinamik (Supabase Auth / LocalStorage)
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const localUser = typeof window !== 'undefined' ? localStorage.getItem('abqari_user') : null;

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          setUserProfile({
            name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Pengguna ABQARI',
            faculty: meta.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
          });
        } else if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setUserProfile({
              name: parsed.name || 'Pengguna ABQARI',
              faculty: parsed.faculty || 'Akademi Pengajian Islam Kontemporari (ACIS)',
            });
          } catch (e) {}
        }
      } catch (err) {
        console.error('Ralat mengambil profil pengguna:', err);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(json => { if (json.success) setSubjects(json.data); });
  }, []);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    const sub = subjects.find(s => s.id === subjectId);
    if (sub) {
      const formatted = formatSubjectDisplay(sub.course_code, sub.name);
      if (formatted.includes(' - ')) {
         const parts = formatted.split(' - ');
         setCourseCode(parts[0].trim());
         setCourseName(parts.slice(1).join(' - ').trim());
      } else {
         setCourseCode('');
         setCourseName(formatted);
      }
      
      setSubjectCOs(Array.isArray(sub.co) ? sub.co : []);
      setSubjectLOs(Array.isArray(sub.lo) ? sub.lo : []);
    }
  };

  const updateSection = (part: 'A' | 'B' | 'C', field: string, value: any) => {
    setSections(prev => ({ ...prev, [part]: { ...prev[part], [field]: value } }));
  };

  const addTopic = () => setTopicDistribution([...topicDistribution, { name: '', percentage: '' }]);
  const removeTopic = (index: number) => setTopicDistribution(topicDistribution.filter((_, i) => i !== index));
  const updateTopic = (index: number, field: 'name' | 'percentage', value: string) => {
    const newTopics = [...topicDistribution];
    newTopics[index][field] = value;
    setTopicDistribution(newTopics);
  };

  const getGeneratedCounts = () => {
    const counts = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
    if (!generatedQuestions) return counts;
    const matches = generatedQuestions.match(/\[Aras:\s*C([1-6])\]/gi);
    if (matches) {
      matches.forEach(m => {
        if (m.includes('1')) counts.C1++; if (m.includes('2')) counts.C2++;
        if (m.includes('3')) counts.C3++; if (m.includes('4')) counts.C4++;
        if (m.includes('5')) counts.C5++; if (m.includes('6')) counts.C6++;
      });
    }
    return counts;
  };

  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\[(?:Aras|C|P|A|LO|CO)[^\]]*\])/gi);
    return parts.map((part, index) => {
      const arasMatch = part.match(/\[Aras:\s*C([1-6])\]/i);
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
        return <span key={index} style={{ backgroundColor: bgColor, color: textColor, fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${borderColor}`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      }
      if (part.match(/\[C:/i)) return <span key={index} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #7dd3fc`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[P:/i)) return <span key={index} style={{ backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #f9a8d4`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[A:/i)) return <span key={index} style={{ backgroundColor: '#ffedd5', color: '#c2410c', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #fdba74`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      if (part.match(/\[LO:/i)) return <span key={index} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', border: `1px solid #c4b5fd`, marginLeft: '6px', fontSize: '0.8rem' }}>{part}</span>;
      
      return part;
    });
  };

  const handleOpenModal = () => { setTempEditedQuestions(generatedQuestions || ''); setIsEditingMode(false); setShowLevelModal(true); };
  const handleSaveChanges = () => { setGeneratedQuestions(tempEditedQuestions); setIsEditingMode(false); alert('Perubahan soalan berjaya disimpan!'); };

  const handlePrintSemakan = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Sila benarkan pop-ups (allow pop-ups) pada pelayar web anda untuk mencetak.');

    const counts = getGeneratedCounts();
    let tableHtml = `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: 'Arial', sans-serif; font-size: 11pt; margin-bottom: 20px;"><thead><tr style="background-color: #f1f5f9;"><th style="text-align: left;">Aras Bloom</th><th style="text-align: center;">Sasaran (Diminta)</th><th style="text-align: center;">Jumlah Dikesan (AI)</th><th style="text-align: center;">Status</th></tr></thead><tbody>`;
    BLOOM_TAXONOMY.forEach(b => {
      const req = bloomCounts[b.level as keyof typeof bloomCounts];
      const gen = counts[b.level as keyof typeof counts];
      const status = (req === gen ? 'Tepat' : 'Berbeza');
      tableHtml += `<tr><td><strong>${b.level} - ${b.name}</strong></td><td align="center">${req}</td><td align="center"><strong>${gen}</strong></td><td align="center">${status}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;

    let formattedText = generatedQuestions || '';
    formattedText = formattedText.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/(\[Aras:\s*C[1-6]\])/gi, '<span style="background-color: #dbeafe; color: #1e40af; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #93c5fd; margin-left: 6px; font-size: 0.8rem;">$1</span>');
    formattedText = formattedText.replace(/(\[C:[^\]]*\])/gi, '<span style="background-color: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #7dd3fc; margin-left: 6px; font-size: 0.8rem;">$1</span>');
    formattedText = formattedText.replace(/(\[P:[^\]]*\])/gi, '<span style="background-color: #fce7f3; color: #be185d; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #f9a8d4; margin-left: 6px; font-size: 0.8rem;">$1</span>');
    formattedText = formattedText.replace(/(\[A:[^\]]*\])/gi, '<span style="background-color: #ffedd5; color: #c2410c; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #fdba74; margin-left: 6px; font-size: 0.8rem;">$1</span>');
    formattedText = formattedText.replace(/(\[LO:[^\]]*\])/gi, '<span style="background-color: #f5f3ff; color: #6d28d9; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #c4b5fd; margin-left: 6px; font-size: 0.8rem;">$1</span>');

    const htmlContent = `
      <html>
        <head>
          <title>Cetak Laporan Semakan JSU - ${courseCode}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 30px; color: #1e293b; line-height: 1.6; }
            h2 { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; }
            .header-info { margin-bottom: 30px; }
            .content-box { font-family: monospace; font-size: 10pt; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; white-space: pre-wrap; }
            @media print {
              body { padding: 0; }
              .content-box { border: none; background-color: transparent; padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>Laporan Semakan Aras Soalan (JSU)</h2>
          <div class="header-info">
            <p><strong>Kursus:</strong> ${courseName} (${courseCode})<br><strong>Peperiksaan:</strong> ${examPeriod}</p>
          </div>
          ${tableHtml}
          <h3>Paparan Kertas Soalan Beserta Tag Aras & Domain:</h3>
          <div class="content-box">${formattedText}</div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      alert('Gagal menyalin teks.');
    }
    document.body.removeChild(textArea);
  };

  const handleCopy = () => {
    const fullText = (generatedQuestions || '') + '\n\n\n' + (generatedScheme || '');
    if (!fullText.trim()) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }).catch(() => fallbackCopy(fullText));
    } else fallbackCopy(fullText);
  };

  const handleDownloadQuestionWord = async () => {
    if (!generatedQuestions) return;
    try {
      const finalSections = {
        A: { ...sections.A, enabled: sections.A.enabled && sections.A.count > 0 },
        B: { ...sections.B, enabled: sections.B.enabled && sections.B.count > 0 },
        C: { ...sections.C, enabled: sections.C.enabled && sections.C.count > 0 }
      };

      const isA_Active = finalSections.A.enabled;
      const isB_Active = finalSections.B.enabled;
      const isC_Active = finalSections.C.enabled;
      const activeCount = [isA_Active, isB_Active, isC_Active].filter(Boolean).length;
      const countText = activeCount === 3 ? 'TIGA' : activeCount === 2 ? 'DUA' : 'SATU';

      let templateFileName = 'Template_Soalan_3.docx'; 
      if (activeCount === 1) templateFileName = 'Template_Soalan_1.docx';
      else if (activeCount === 2) templateFileName = 'Template_Soalan_2.docx';

      const response = await fetch(`/${templateFileName}`);
      if (!response.ok) throw new Error(`Templat ${templateFileName} tidak dijumpai.`);
      const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
      const zip = new PizZip(arrayBuffer); const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      
      doc.render({
        "SUBJEK SUMBER": courseName, "KOD KURSUS": courseCode, "PEPERIKSAAN": examPeriod, "MASA PEPERIKSAAN": duration,
        "TETAPAN_BAHAGIAN": countText, "JUMLAH": activeCount,
        "bil_a": finalSections.A.count, "markah_a": finalSections.A.marks,
        "bil_b": finalSections.B.count, "markah_b": finalSections.B.marks,
        "bil_c": finalSections.C.count, "markah_c": finalSections.C.marks,
        "kertas_soalan": formatTextToOOXML(generatedQuestions) 
      });
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(out, `${courseCode}_Kertas_Soalan_Format_UiTM.docx`);
    } catch (error) { alert(`Gagal menjana Word. Pastikan fail (Template_Soalan_1.docx, _2.docx, _3.docx) wujud di dalam folder public.`); }
  };

  const handleDownloadSchemeWord = async () => {
    if (!generatedScheme) return;
    try {
      const response = await fetch('/Template_Skema.docx');
      if (!response.ok) throw new Error('Templat Skema tidak dijumpai.');
      const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
      const zip = new PizZip(arrayBuffer); const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({ "SUBJEK SUMBER": courseName, "KOD KURSUS": courseCode, "PEPERIKSAAN": examPeriod, "SKEMA": formatTextToOOXML(generatedScheme) });
      const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(out, `${courseCode}_Skema_Jawapan_Format_UiTM.docx`);
    } catch (error) { alert('Gagal menjana Word: Pastikan tag {@SKEMA} wujud.'); }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return alert('Sila pilih subjek terlebih dahulu.');
    
    const activeTopics = topicDistribution.filter(t => t.name.trim() !== '' || t.percentage !== '');
    if (activeTopics.length > 0) {
      const isAnyFieldMissing = activeTopics.some(t => t.name.trim() === '' || t.percentage === '');
      if (isAnyFieldMissing) return alert('Sila pastikan nama topik dan peratusannya diisi dengan lengkap bagi ruangan yang tidak kosong.');
      
      const totalPct = activeTopics.reduce((sum, t) => sum + Number(t.percentage), 0);
      if (totalPct !== 100) return alert(`Gagal: Jumlah keseluruhan peratusan topik mestilah tepat 100%. (Jumlah dikesan: ${totalPct}%)`);
    }

    const finalSections = {
      A: { ...sections.A, enabled: sections.A.enabled && sections.A.count > 0 },
      B: { ...sections.B, enabled: sections.B.enabled && sections.B.count > 0 },
      C: { ...sections.C, enabled: sections.C.enabled && sections.C.count > 0 }
    };

    setIsGenerating(true); setGeneratedQuestions(null); setGeneratedScheme(null); setProgress(0);
    setProgressText("Menganalisis profil pemetaan subjek anda...");

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 3) + 1;
      if (currentProgress > 95) currentProgress = 95;
      setProgress(currentProgress);
      if (currentProgress < 25) setProgressText("Membaca nota dan memadankan peratusan topik...");
      else if (currentProgress < 50) setProgressText("Menyusun pemetaan Taksonomi Bloom, Domain (C/P/A), dan LO...");
      else if (currentProgress < 75) setProgressText(`Merangka SET ${setSoalan} berserta skema jawapan...`);
      else setProgressText("Hampir siap... Mengemas kini format UiTM...");
    }, 1000);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           subjectId: selectedSubject, courseName, courseCode, examPeriod, duration, theme, sections: finalSections, bloomCounts, setSoalan,
           co: subjectCOs, lo: subjectLOs, topicDistribution: activeTopics,
           subQuestions: { enabled: enableSubQuestions, count: enableSubQuestions ? subQuestionCount : 0 }
        }),
      });
      const json = await response.json();
      clearInterval(progressInterval); setProgress(100); setProgressText("Selesai!");
      setTimeout(() => {
        if (response.ok && json.success) {
           const fullText = json.data;
           const splitIndex = fullText.indexOf('[PENJANAAN SKEMA JAWAPAN]');
           if (splitIndex !== -1) {
               setGeneratedQuestions(fullText.substring(0, splitIndex).trim());
               setGeneratedScheme(fullText.substring(splitIndex).replace('[PENJANAAN SKEMA JAWAPAN]', '').trim());
           } else {
              setGeneratedQuestions(fullText); setGeneratedScheme("Sila salin skema secara manual.");
           }
        } else setGeneratedQuestions(`Ralat: ${json.error}`);
        setIsGenerating(false);
      }, 800);
    } catch (error) { clearInterval(progressInterval); setIsGenerating(false); }
  };

  const generatedCounts = getGeneratedCounts();
  const currentTotalPct = topicDistribution.reduce((sum, t) => sum + Number(t.percentage || 0), 0);

  // GAYA CSS INLINE UTAMA
  const styles = {
    card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '25px', position: 'relative' as 'relative', zIndex: 1 },
    sectionTitle: { marginTop: 0, color: '#0f172a', fontSize: '1.15rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px', fontWeight: 'bold' as 'bold' },
    label: { fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#f8fafc', transition: 'all 0.2s', outlineColor: '#3b82f6' },
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', position: 'relative' }}>
      
      {/* 1. LATAR BELAKANG UNGU & CORAK BINTANG LAPAN PENJURU */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '340px',
        background: 'linear-gradient(135deg, #3b0764, #4a154b)', 
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-opacity='0.07'%3E%3Cg transform='translate(30,30)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,0)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(0,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3Cg transform='translate(60,60)'%3E%3Crect x='-15' y='-15' width='30' height='30' /%3E%3Crect x='-15' y='-15' width='30' height='30' transform='rotate(45)' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, #3b0764, #4a154b)`,
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        zIndex: 0
      }} />

      {/* KANDUNGAN UTAMA */}
      <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
      
        {/* MODAL SEMAKAN & EDIT */}
        {showLevelModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '16px', width: '90%', maxWidth: '950px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem' }}>🔍 Semakan & Edit Aras Bloom</h2>
                <button onClick={() => setShowLevelModal(false)} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
              </div>
              
              <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '0.9rem', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '12px', textAlign: 'left', color: '#475569' }}>Aras Bloom</th><th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Sasaran (Diminta)</th><th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Jumlah Dikesan</th><th style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>Status</th></tr></thead>
                  <tbody>
                    {BLOOM_TAXONOMY.map(b => {
                      const req = bloomCounts[b.level as keyof typeof bloomCounts];
                      const gen = generatedCounts[b.level as keyof typeof generatedCounts];
                      return (
                        <tr key={b.level} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: '600', color: '#334155' }}>{b.level} - {b.name}</td><td style={{ padding: '12px', textAlign: 'center' }}>{req}</td><td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{gen}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: req === gen ? '#dcfce7' : '#fef3c7', color: req === gen ? '#166534' : '#b45309' }}>
                              {req === gen ? '✅ Tepat' : '⚠️ Berbeza'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#334155', fontSize: '1.1rem' }}>Paparan Kertas Soalan:</h4>
                  {!isEditingMode ? (
                      <button onClick={() => setIsEditingMode(true)} style={{ padding: '8px 16px', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(234, 179, 8, 0.3)' }}>✏️ Edit Soalan</button>
                  ) : (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setIsEditingMode(false)} style={{ padding: '8px 16px', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Batal</button>
                        <button onClick={handleSaveChanges} style={{ padding: '8px 16px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)' }}>💾 Simpan Perubahan</button>
                      </div>
                  )}
                </div>
                
                {isEditingMode ? (
                  <textarea value={tempEditedQuestions} onChange={(e) => setTempEditedQuestions(e.target.value)} style={{ width: '100%', minHeight: '350px', padding: '20px', fontFamily: 'monospace', fontSize: '0.9rem', border: '2px solid #3b82f6', borderRadius: '8px', outline: 'none' }} />
                ) : (
                  <>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px', marginTop: 0 }}>*Peringatan: Kesemua tag pewarnaan [Aras, C, P, A, LO] ini secara automatik <strong>tidak dipaparkan</strong> dalam fail MS Word muat turun.</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', color: '#1e293b', backgroundColor: '#ffffff', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: 0, maxHeight: '400px', overflowY: 'auto', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                      {generatedQuestions ? renderHighlightedText(generatedQuestions) : 'Tiada soalan dijana.'}
                    </pre>
                  </>
                )}
              </div>
              
              <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={handlePrintSemakan} style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>🖨️ Cetak Semakan</button>
                <button onClick={() => setShowLevelModal(false)} style={{ padding: '12px 24px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '45px', paddingTop: '10px', position: 'relative', zIndex: 1 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#3b0764', backgroundColor: '#fde047', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', marginTop: '8px' }}>
            ← Kembali ke Papan Pemuka
          </Link>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.2rem', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '-1px' }}>
              <span style={{ color: '#fde047', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>ABQARI</span>
            </h1>
            <p style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '700', letterSpacing: '1px', margin: '0 0 15px 0' }}>
              ADVANCED BLUEPRINT & QUESTION ASSESSMENT RESOURCE INTEGRATOR
            </p>
            <p style={{ color: '#cbd5e1', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto', fontWeight: '400' }}>
              Sistem pintar penggubalan kertas ujian UiTM mengikut spesifikasi JSU 100%.
            </p>
          </div>

          {/* NAIF: PENJURA ATAS NAMA PENGGUNA DINAMIK */}
          <div style={{ color: 'white', textAlign: 'right', fontSize: '0.85rem', marginTop: '8px' }}>
            <strong style={{ fontSize: '0.95rem', display: 'block' }}>{userProfile.name}</strong>
            <span style={{ color: '#cbd5e1' }}>{userProfile.faculty}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          {/* PANEL KIRI (KAWALAN PARAMETER) */}
          <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column' }}>
            
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>1. Maklumat Peperiksaan</h3>
              <label style={styles.label}>Subjek Sumber</label>
              <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={{...styles.input, marginBottom: '15px'}}>
                <option value="">-- Sila Pilih Subjek --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSubjectDisplay(s.course_code, s.name)}
                  </option>
                ))}
              </select>

              {selectedSubject && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6', fontSize: '0.85rem' }}>
                  <span style={{ color: '#475569', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Pemetaan Subjek:</span>
                  <span style={{ color: '#0369a1' }}>• Domain (C/P/A):</span> {subjectCOs.length > 0 ? subjectCOs.join(', ') : 'Tiada'}<br/>
                  <span style={{ color: '#6d28d9' }}>• LO:</span> {subjectLOs.length > 0 ? subjectLOs.join(', ') : 'Tiada'}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                 <div>
                   <label style={{...styles.label, color: '#16a34a'}}>Tema Soalan</label>
                   <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{...styles.input, borderColor: '#86efac', backgroundColor: '#f0fdf4'}}>
                     <option value="Semua Tema">Semua Tema</option>
                     <option value="Agama">Agama</option><option value="Falsafah">Falsafah</option><option value="Saintifik">Saintifik</option>
                   </select>
                 </div>
                 <div>
                   <label style={{...styles.label, color: '#0284c7'}}>Set Soalan</label>
                   <select value={setSoalan} onChange={(e) => setSetSoalan(e.target.value)} style={{...styles.input, borderColor: '#bae6fd', backgroundColor: '#f0f9ff'}}>
                     {[1,2,3,4,5].map(n => <option key={n} value={n}>Set {n}</option>)}
                   </select>
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div><label style={styles.label}>Kod Kursus</label><input type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Sesi Peperiksaan</label><input type="text" value={examPeriod} onChange={e => setExamPeriod(e.target.value)} style={styles.input} /></div>
              </div>
              <div style={{ marginBottom: '15px' }}><label style={styles.label}>Nama Kursus</label><input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} style={styles.input} /></div>
              <div><label style={styles.label}>Masa Peperiksaan</label><input type="text" value={duration} onChange={e => setDuration(e.target.value)} style={styles.input} /></div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>2. Tetapan Bahagian Soalan</h3>
              {(['A', 'B', 'C'] as const).map(part => (
                <div key={part} style={{ marginBottom: '15px', padding: '15px', backgroundColor: sections[part].enabled ? '#ffffff' : '#f8fafc', borderRadius: '10px', border: sections[part].enabled ? '1px solid #cbd5e1' : '1px dashed #cbd5e1', transition: 'all 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sections[part].enabled ? '12px' : '0' }}>
                    <label style={{ fontWeight: 'bold', color: sections[part].enabled ? '#0f172a' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <input type="checkbox" checked={sections[part].enabled} onChange={e => updateSection(part, 'enabled', e.target.checked)} style={{ marginRight: '10px', width: '18px', height: '18px' }} />
                      BAHAGIAN {part}
                    </label>
                  </div>
                  {sections[part].enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                      <div><span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>Format</span><select value={sections[part].type} onChange={e => updateSection(part, 'type', e.target.value)} style={styles.input}><option value="objektif">Objektif (A,B,C,D)</option><option value="true_false">Benar / Salah</option><option value="essay">Subjektif / Esei</option></select></div>
                      <div><span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>Bil. Soalan</span><input type="number" min="0" value={sections[part].count} onChange={e => updateSection(part, 'count', Number(e.target.value))} style={styles.input} /></div>
                      <div><span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>Markah</span><input type="number" min="0" value={sections[part].marks} onChange={e => updateSection(part, 'marks', Number(e.target.value))} style={styles.input} /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* SEKSYEN KAWALAN BERTINGKAT - DISEMBUNYIKAN SEPERTI DIMINTA (display: none) */}
            <div style={{ ...styles.card, display: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: enableSubQuestions ? '15px' : '0' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 'bold' }}>
                  Format Soalan Bertingkat (Sub-Soalan)
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={enableSubQuestions} 
                    onChange={(e) => setEnableSubQuestions(e.target.checked)} 
                    style={{ marginRight: '8px', width: '18px', height: '18px' }} 
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: enableSubQuestions ? '#0f172a' : '#94a3b8' }}>Aktifkan</span>
                </label>
              </div>
              
              {enableSubQuestions && (
                <div style={{ padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '15px' }}>
                   <div style={{ flex: 1 }}>
                     <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#0369a1', fontWeight: 'bold' }}>Jumlah Soalan Beranak (Cth: 1a, 1b, 1c)</p>
                     <p style={{ margin: 0, fontSize: '0.75rem', color: '#0ea5e9' }}>AI akan memecahkan soalan subjektif/esei kepada sub-soalan untuk set ini.</p>
                   </div>
                   <div>
                     <input 
                       type="number" 
                       min="1" 
                       max="20"
                       value={subQuestionCount} 
                       onChange={(e) => setSubQuestionCount(Number(e.target.value))} 
                       style={{ ...styles.input, width: '80px', textAlign: 'center', borderColor: '#7dd3fc', fontWeight: 'bold', backgroundColor: '#ffffff' }} 
                     />
                   </div>
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 'bold' }}>3. Taburan Topik <span style={{fontSize:'0.8rem', color:'#64748b', fontWeight:'normal'}}>(Pilihan)</span></h3>
                <span style={{ fontSize: '0.85rem', padding: '4px 10px', borderRadius: '20px', backgroundColor: currentTotalPct === 100 ? '#dcfce7' : currentTotalPct > 0 ? '#fee2e2' : '#f1f5f9', color: currentTotalPct === 100 ? '#166534' : currentTotalPct > 0 ? '#b91c1c' : '#475569', fontWeight: 'bold' }}>
                  Jumlah: {currentTotalPct}%
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '-5px', marginBottom: '15px', lineHeight: '1.5' }}>
                Biarkan kosong jika tiada sasaran khusus. Jika diisi, AI akan mematuhi peratusan ini dan <strong>jumlahnya mesti tepat 100%</strong>.
              </p>
              
              {topicDistribution.map((topic, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
                  <input type="text" placeholder="Cth: Bab 1 Pengenalan" value={topic.name} onChange={e => updateTopic(index, 'name', e.target.value)} style={{...styles.input, flex: 1}} />
                  <input type="number" placeholder="%" value={topic.percentage} min="1" max="100" onChange={e => updateTopic(index, 'percentage', e.target.value)} style={{...styles.input, width: '80px', textAlign: 'center'}} />
                  <button onClick={() => removeTopic(index)} style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>✕</button>
                </div>
              ))}
              <button onClick={addTopic} style={{ padding: '12px 15px', backgroundColor: '#f8fafc', color: '#3b82f6', border: '1px dashed #93c5fd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', marginTop: '5px', transition: '0.2s' }}>
                + Tambah Topik Spesifik
              </button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>4. Pemetaan Aras Bloom</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {BLOOM_TAXONOMY.map(b => (
                  <div key={b.level} style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', display: 'block', textAlign: 'center', marginBottom: '8px' }}>{b.level}</label>
                    <input type="number" min="0" value={bloomCounts[b.level as keyof typeof bloomCounts]} onChange={e => setBloomCounts({ ...bloomCounts, [b.level]: Number(e.target.value) })} style={{...styles.input, textAlign: 'center', backgroundColor: '#ffffff', padding: '8px'}} />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={isGenerating} style={{ position: 'relative', zIndex: 1, width: '100%', padding: '18px', backgroundColor: isGenerating ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isGenerating ? 'not-allowed' : 'pointer', transition: 'all 0.3s', boxShadow: isGenerating ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.3)', marginBottom: '30px' }}>
              {isGenerating ? '⚙️ AI Sedang Berfikir & Menjana...' : '✨ Jana Kertas Soalan & Skema'}
            </button>
          </div>

          {/* PANEL KANAN (PRATONTON DOKUMEN) */}
          <div style={{ flex: '1 1 550px', backgroundColor: '#ffffff', padding: '30px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', minHeight: '800px', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem', fontWeight: '800' }}>Pratonton Kertas Ujian</h3>
              {generatedQuestions && !isGenerating && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleOpenModal} style={{ padding: '8px 14px', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🔍 Semak Aras</button>
                  <button onClick={handleCopy} style={{ padding: '8px 14px', backgroundColor: isCopied ? '#dcfce7' : '#f1f5f9', color: isCopied ? '#166534' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>{isCopied ? '✓ Disalin!' : 'Salin'}</button>
                  <button onClick={handleDownloadQuestionWord} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>📄 MS Word</button>
                  {generatedScheme && (
                     <button onClick={handleDownloadSchemeWord} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>✅ Skema</button>
                  )}
                </div>
              )}
            </div>

            {isGenerating ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '60px', height: '60px', border: '5px solid #f1f5f9', borderTop: '5px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '15px', textAlign: 'center' }}>{progressText}</p>
                
                <div style={{ width: '85%', backgroundColor: '#f1f5f9', borderRadius: '20px', height: '28px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#3b82f6', height: '100%', transition: 'width 0.5s ease-out, background-color 0.5s', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem', backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}>
                    {progress > 5 ? `${progress}%` : ''}
                  </div>
                </div>

                <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', maxWidth: '90%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                   <p style={{ margin: 0, color: '#166534', fontSize: '0.95rem', textAlign: 'center', fontStyle: 'italic', fontWeight: '500', lineHeight: '1.6' }}>
                     "Terima kasih kerana sudi menunggu sebentar. Dedikasi dan titik peluh anda mendidik anak bangsa amatlah dihargai! Senyum selalu, AI sedang menyusun soalan peperiksaan yang terbaik khas untuk anda... 🌸✨"
                   </p>
                </div>
              </div>
            ) : generatedQuestions ? (
              <div style={{ flex: 1, whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.1rem', color: '#000000', backgroundColor: '#ffffff', padding: '40px 50px', borderRadius: '4px', border: '1px solid #cbd5e1', overflowY: 'auto', boxShadow: '0 0 15px rgba(0,0,0,0.05) inset', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '50px'}}>{generatedQuestions}</div>
                  {generatedScheme && (
                      <div style={{ borderTop: '2px dashed #94a3b8', paddingTop: '30px' }}>
                          <h4 style={{ color: '#166534', margin: '0 0 15px 0', fontFamily: '"Inter", sans-serif' }}>--- PEMISAH: SKEMA JAWAPAN ---</h4>
                          <div>{generatedScheme}</div>
                      </div>
                  )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '40px' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', color: '#cbd5e1' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>Ruangan Kertas Ujian Kosong</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>Lengkapkan parameter di sebelah kiri dan klik jana.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}