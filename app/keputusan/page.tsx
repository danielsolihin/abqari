'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function parseQuestions(rawText: string) {
  if (!rawText) return [];
  const rawBlocks = rawText.split(/(?=(?:^|\n)\s*(?:BAHAGIAN|PART|الجزء)?\s*[A-Z]?:?\s*\n*\s*\d+[\.\)]\s*)/gi);
  const questionsList: any[] = [];
  const jsuRegex = /\\?\[\s*(?:Aras|Level|Aras Bloom|CO\d*|CLO\d*|LO\d*|PO\d*|PLO\d*|C[1-6]|P[1-5]|A[1-5]|Rujukan|Topik)[^\]]*\\?\]/gi;

  rawBlocks.forEach((block) => {
    const cleanBlock = block.replace(/^(?:BAHAGIAN|PART|الجزء)\s+[A-Z]:?\s*/gi, '').trim();
    if (/^\d+[\.\)]/i.test(cleanBlock)) {
      let textWithoutTag = cleanBlock.replace(jsuRegex, '').trim();
      const optionsMatch = textWithoutTag.split(/\n\s*([A-D][\.\)])\s*/);
      let questionMainText = textWithoutTag;
      const options = [];

      if (optionsMatch.length > 1) {
        questionMainText = optionsMatch[0].trim();
        for (let i = 1; i < optionsMatch.length; i += 2) {
          const optLabel = optionsMatch[i].trim();
          let optText = optionsMatch[i+1] ? optionsMatch[i+1].trim() : '';
          options.push({ label: optLabel, text: optText });
        }
      }
      questionMainText = questionMainText.replace(/(\s*\[.*?\])+\s*$/g, '').trim();
      questionsList.push({ fullText: cleanBlock, stem: questionMainText, options: options });
    }
  });
  return questionsList;
}

function parseSchemeAnswers(rawScheme: string) {
  const schemeMap: Record<number, string> = {};
  if (!rawScheme) return schemeMap;
  const regex = /(\d+)\s*[\.\)]\s*([A-D])/gi;
  let match;
  while ((match = regex.exec(rawScheme)) !== null) {
    const qIndex = parseInt(match[1]) - 1; 
    const ans = match[2].toUpperCase();
    schemeMap[qIndex] = ans;
  }
  return schemeMap;
}

function formatDate(dateString: string) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
}

export default function KeputusanPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // STATE: SARINGAN (FILTER)
  const [filterProgram, setFilterProgram] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [parsedScheme, setParsedScheme] = useState<Record<number, string>>({});
  
  const [totalScore, setTotalScore] = useState<number>(0);
  const [objScore, setObjScore] = useState<number>(0);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [showSchemePanel, setShowSchemePanel] = useState(false); 
  const [viewMode, setViewMode] = useState<'objektif' | 'esei'>('objektif');

  const [rubricScores, setRubricScores] = useState<Record<number, { isi: number, dalil: number, perbincangan: number, rumusan: number }>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, string>>({});
  const [isAiMarking, setIsAiMarking] = useState<Record<number, boolean>>({});
  const [hasAiMarked, setHasAiMarked] = useState<Record<number, boolean>>({});
  
  const [highlightedAnswers, setHighlightedAnswers] = useState<Record<number, string>>({});
  
  const [popupPos, setPopupPos] = useState<{ x: number, y: number } | null>(null);
  const [activeQIndex, setActiveQIndex] = useState<number | null>(null);
  const [highlightMark, setHighlightMark] = useState<number>(1);
  
  const [activeEditHighlight, setActiveEditHighlight] = useState<{ id: string, type: string, mark: number, qIndex: number, x: number, y: number } | null>(null);
  const [editHighlightMark, setEditHighlightMark] = useState<number>(0);

  // 1. KEMAS KINI: Tangkap testId dari URL selepas ujian dimuatkan
  useEffect(() => {
    const fetchTests = async () => {
      const { data } = await supabase.from('online_tests').select('*');
      if (data) {
        setTests(data.reverse());
        
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const urlTestId = params.get('testId');
          if (urlTestId) {
            setSelectedTestId(urlTestId);
          }
        }
      }
    };
    fetchTests();
  }, []);

  const fetchSessionsData = async (testId: string) => {
    setIsLoading(true);
    setSelectedSessions([]);
    try {
      const testObj = tests.find(t => t.id === testId);
      setSelectedTest(testObj);

      let pQuestions: any[] = [];
      let pScheme: Record<number, string> = {};

      if (testObj) {
        pQuestions = parseQuestions(testObj.questions_data?.rawText || '');
        setParsedQuestions(pQuestions);
        pScheme = parseSchemeAnswers(testObj.scheme_data?.rawText || '');
        setParsedScheme(pScheme);
      }

      const { data: sessionsData } = await supabase.from('test_sessions').select('*').eq('test_id', testId);
      
      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map(s => s.id);
        const { data: allAnswers } = await supabase.from('test_answers').select('*').in('session_id', sessionIds);

        const enhancedSessions = sessionsData.map(session => {
          let autoMark = 0;
          if (allAnswers) {
            const sAnsList = allAnswers.filter(a => a.session_id === session.id);
            pQuestions.forEach((q, idx) => {
              if (q.options.length > 0) { 
                const rawS = sAnsList.find(a => a.question_index === idx)?.answer_text || '';
                const rawC = pScheme[idx] || '';
                const s = rawS.replace(/[\.\)]/g, '').trim().toUpperCase();
                const c = rawC.replace(/[\.\)]/g, '').trim().toUpperCase();
                if (s && c && s === c) autoMark += 1;
              }
            });
          }
          return { ...session, calculated_score: autoMark };
        });
        setSessions(enhancedSessions.reverse());
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTestId) { setSessions([]); setSelectedTest(null); return; }
    fetchSessionsData(selectedTestId);
  }, [selectedTestId]);

  // AUTO EXTRACT UNTUK DROPDOWN
  const uniquePrograms = Array.from(new Set(tests.map(t => t.faculty || t.program_name || t.test_name).filter(Boolean)));
  const uniqueCourses = Array.from(new Set(tests.map(t => t.course_code).filter(Boolean)));
  const uniqueGroups = Array.from(new Set(tests.map(t => t.group_name).filter(Boolean)));

  const filteredTests = tests.filter(t => {
    const progVal = t.faculty || t.program_name || t.test_name;
    const matchProgram = filterProgram ? progVal === filterProgram : true;
    const matchCourse = filterCourse ? t.course_code === filterCourse : true;
    const matchGroup = filterGroup ? t.group_name === filterGroup : true;
    return matchProgram && matchCourse && matchGroup;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSessions(sessions.map(s => s.id));
    } else {
      setSelectedSessions([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedSessions([...selectedSessions, id]);
    } else {
      setSelectedSessions(selectedSessions.filter(sid => sid !== id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.length === 0) return;
    if (!window.confirm(`Adakah anda pasti mahu memadam ${selectedSessions.length} rekod pelajar? Tindakan ini tidak boleh dipulihkan.`)) return;

    try {
      setIsLoading(true);
      const { error } = await supabase.from('test_sessions').delete().in('id', selectedSessions);
      if (error) throw error;
      
      setSessions(sessions.filter(s => !selectedSessions.includes(s.id)));
      setSelectedSessions([]);
      alert(`✅ Berjaya memadam ${selectedSessions.length} rekod.`);
    } catch (err: any) {
      alert("Gagal memadam rekod: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAnswers = async (session: any) => {
    setActiveSession(session);
    setShowModal(true);
    setShowSchemePanel(false); 
    setViewMode('objektif'); 
    setStudentAnswers({}); 
    setRubricScores({}); 
    setAiEvaluations({});
    setHighlightedAnswers({});
    setHasAiMarked({});
    setPopupPos(null);
    setActiveEditHighlight(null);
    
    try {
      const { data } = await supabase.from('test_answers').select('question_index, answer_text').eq('session_id', session.id);
      if (data) {
        const ansMap: Record<number, string> = {};
        const htmlMap: Record<number, string> = {};
        const loadedRubrics: Record<number, any> = {};
        const aiStatus: Record<number, boolean> = {};
        let loadedObjScore = 0;

        data.forEach(a => { 
          ansMap[a.question_index] = a.answer_text; 
          htmlMap[a.question_index] = a.answer_text; 
          
          if (a.answer_text.includes('ai-generated-marks')) {
            aiStatus[a.question_index] = true;
          }
          
          const q = parsedQuestions[a.question_index];
          if (q && q.options.length > 0) {
            const cAns = parsedScheme[a.question_index] || '';
            const cleanSAns = a.answer_text.replace(/[\.\)]/g, '').trim().toUpperCase();
            const cleanCAns = cAns.replace(/[\.\)]/g, '').trim().toUpperCase();
            if (cleanSAns && cleanCAns && cleanSAns === cleanCAns) { loadedObjScore += 1; }
          } else {
            loadedRubrics[a.question_index] = { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };
            const regex = /data-type="([^"]+)"\s+data-mark="([^"]+)"/g;
            let match;
            while ((match = regex.exec(a.answer_text)) !== null) {
              const type = match[1];
              const mark = parseInt(match[2], 10);
              if (loadedRubrics[a.question_index][type] !== undefined) {
                loadedRubrics[a.question_index][type] += mark;
              }
            }
          }
        });
        
        setStudentAnswers(ansMap);
        setHighlightedAnswers(htmlMap);
        setRubricScores(loadedRubrics);
        setHasAiMarked(aiStatus);
        setObjScore(loadedObjScore);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let eseiTotal = 0;
    Object.values(rubricScores).forEach(rubric => {
      eseiTotal += (Number(rubric.isi) || 0) + (Number(rubric.dalil) || 0) + (Number(rubric.perbincangan) || 0) + (Number(rubric.rumusan) || 0);
    });
    setTotalScore(objScore + eseiTotal);
  }, [rubricScores, objScore]);

  const handleAutoMarkObjektif = () => {
    let calculatedScore = 0;
    parsedQuestions.forEach((q, idx) => {
      if (q.options.length > 0) {
        const sAns = studentAnswers[idx] || '';
        const cAns = parsedScheme[idx] || '';
        const cleanSAns = sAns.replace(/[\.\)]/g, '').trim().toUpperCase();
        const cleanCAns = cAns.replace(/[\.\)]/g, '').trim().toUpperCase();
        if (cleanSAns && cleanCAns && cleanSAns === cleanCAns) { calculatedScore += 1; }
      }
    });
    setObjScore(calculatedScore);
  };

  const handleAIEssayMark = async (qIndex: number) => {
    setIsAiMarking(prev => ({ ...prev, [qIndex]: true }));
    const studentAns = studentAnswers[qIndex] || '';
    
    if (!studentAns || studentAns.trim() === '') {
      await new Promise(resolve => setTimeout(resolve, 800)); 
      const emptyUlasan = `❌ AI Mengesan Ralat:\nPelajar tidak memberikan sebarang jawapan. ABQARItidak dapat menjalankan penilaian.`;
      setAiEvaluations(prev => ({ ...prev, [qIndex]: emptyUlasan }));
      setIsAiMarking(prev => ({ ...prev, [qIndex]: false }));
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const fullScheme = selectedTest?.scheme_data?.rawText || '';
    const qNum = qIndex + 1;
    const schemeRegex = new RegExp(`(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*([\\s\\S]*?)(?=(?:\\n\\s*\\d+\\s*[\\.\\)]|$))`, 'i');
    const match = fullScheme.match(schemeRegex);
    const specificScheme = match ? match[1].trim() : fullScheme;

    const studentWords = studentAns.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const schemeWords = specificScheme.toLowerCase().split(/\W+/).filter(w => w.length > 3);

    let matchCount = 0;
    studentWords.forEach(w => { if (schemeWords.includes(w)) matchCount++; });

    let isiMark = 0, dalilMark = 0, bincangMark = 0, rumusMark = 0;

    if (matchCount > 0) isiMark = Math.min(4, Math.ceil(matchCount / 2));
    if (/(kerana|sebab|kesannya|membawa kepada|hal ini|oleh itu|menyebabkan|dengan ini)/i.test(studentAns)) bincangMark = 1;
    if (matchCount > 4) bincangMark = Math.min(3, bincangMark + 1);
    if (/(kesimpulan|akhirnya|rumusan|tuntasnya|konklusinya)/i.test(studentAns)) rumusMark = 1;
    if (/(surah|ayat|riwayat|sabda|akta|seksyen|firman|menurut|kajian)/i.test(studentAns)) dalilMark = 1;

    let ulasan = `Penilaian AI (Rujukan Silang Skema Soalan ${qNum}):\n`;
    ulasan += isiMark > 0 ? `✓ Menemui ${matchCount} padanan kata kunci/sinonim dari skema jawapan. ("Isi": +${isiMark})\n` : `❌ Tiada fakta tersurat/tersirat yang bertepatan dengan skema.\n`;
    ulasan += dalilMark > 0 ? `✓ Terdapat sandaran dalil/fakta rujukan yang valid. ("Dalil": +${dalilMark})\n` : `❌ Tiada sandaran dalil / rujukan fakta ditemui.\n`;
    ulasan += bincangMark > 0 ? `✓ Huraian dan perbincangan dikembangkan dengan baik. ("Bincang": +${bincangMark})\n` : `❌ Huraian terlalu ringkas, tiada perbincangan kukuh.\n`;
    ulasan += rumusMark > 0 ? `✓ Terdapat rumusan/kesimpulan yang jelas. ("Rumusan": +${rumusMark})` : `❌ Tiada rumusan pada hujung jawapan.`;

    setAiEvaluations(prev => ({ ...prev, [qIndex]: ulasan }));

    const ts = Date.now();
    let aiHtml = `<div class="ai-generated-marks" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display:flex; gap:8px; flex-wrap: wrap;">`;
    
    if(isiMark > 0) aiHtml += `<mark id="ai-isi-${ts}" class="essay-highlight" data-type="isi" data-mark="${isiMark}" style="background-color: #bfdbfe; border-radius: 4px; padding: 4px 8px; border-bottom: 2px solid #93c5fd; cursor: pointer; display: inline-block;">💡 Cadangan AI: Isi <sup class="mark-badge" style="background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;">+${isiMark}</sup></mark>`;
    if(dalilMark > 0) aiHtml += `<mark id="ai-dalil-${ts}" class="essay-highlight" data-type="dalil" data-mark="${dalilMark}" style="background-color: #e9d5ff; border-radius: 4px; padding: 4px 8px; border-bottom: 2px solid #d8b4fe; cursor: pointer; display: inline-block;">📖 Cadangan AI: Dalil <sup class="mark-badge" style="background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;">+${dalilMark}</sup></mark>`;
    if(bincangMark > 0) aiHtml += `<mark id="ai-bin-${ts}" class="essay-highlight" data-type="perbincangan" data-mark="${bincangMark}" style="background-color: #fed7aa; border-radius: 4px; padding: 4px 8px; border-bottom: 2px solid #fdba74; cursor: pointer; display: inline-block;">💬 Cadangan AI: Bincang <sup class="mark-badge" style="background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;">+${bincangMark}</sup></mark>`;
    if(rumusMark > 0) aiHtml += `<mark id="ai-rum-${ts}" class="essay-highlight" data-type="rumusan" data-mark="${rumusMark}" style="background-color: #ccfbf1; border-radius: 4px; padding: 4px 8px; border-bottom: 2px solid #5eead4; cursor: pointer; display: inline-block;">📝 Cadangan AI: Rumus <sup class="mark-badge" style="background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;">+${rumusMark}</sup></mark>`;
    
    if (isiMark===0 && dalilMark===0 && bincangMark===0 && rumusMark===0) {
       aiHtml += `<span style="color:#ef4444; font-size:0.85rem; font-weight:bold;">Sifar (0) Markah: Jawapan terpesong jauh daripada skema soalan.</span>`;
    }
    aiHtml += `</div>`;

    let currentHtml = highlightedAnswers[qIndex] || studentAns;
    currentHtml = currentHtml.replace(/<div class="ai-generated-marks"[\s\S]*?<\/div>/, '');

    setHighlightedAnswers(prev => ({ ...prev, [qIndex]: currentHtml + aiHtml }));

    setRubricScores(prev => {
      const cur = prev[qIndex] || { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };
      return { ...prev, [qIndex]: {
         isi: cur.isi + isiMark,
         dalil: cur.dalil + dalilMark,
         perbincangan: cur.perbincangan + bincangMark,
         rumusan: cur.rumusan + rumusMark
      }};
    });

    setHasAiMarked(prev => ({ ...prev, [qIndex]: true }));
    setIsAiMarking(prev => ({ ...prev, [qIndex]: false }));
  };

  const handleEseiInteract = (e: React.MouseEvent, qIndex: number) => {
    const target = e.target as HTMLElement;
    const markNode = target.closest('mark.essay-highlight') as HTMLElement;
    
    if (markNode) {
      const id = markNode.id;
      const type = markNode.dataset.type || 'isi';
      const mark = parseInt(markNode.dataset.mark || '0', 10);
      const rect = markNode.getBoundingClientRect();
      
      setActiveEditHighlight({
        id, type, mark, qIndex,
        x: rect.left + window.scrollX + (rect.width / 2),
        y: rect.top + window.scrollY - 50
      });
      setEditHighlightMark(mark);
      setPopupPos(null);
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopupPos({ x: rect.left + window.scrollX + (rect.width / 2), y: rect.top + window.scrollY - 50 });
      setActiveQIndex(qIndex);
      setHighlightMark(1);
      setActiveEditHighlight(null);
    } else {
      setPopupPos(null);
      setActiveEditHighlight(null);
    }
  };

  const applyHighlightToGrade = (type: 'isi' | 'dalil' | 'perbincangan' | 'rumusan') => {
    if (activeQIndex === null) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const markToAdd = Number(highlightMark) || 0;
    const id = 'hl-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    let color = '';
    if (type === 'isi') color = '#bfdbfe';          
    else if (type === 'dalil') color = '#e9d5ff';   
    else if (type === 'perbincangan') color = '#fed7aa'; 
    else if (type === 'rumusan') color = '#ccfbf1'; 

    const range = selection.getRangeAt(0);
    const fragment = range.extractContents();
    
    const markNode = document.createElement('mark');
    markNode.id = id;
    markNode.className = 'essay-highlight';
    markNode.dataset.type = type;
    markNode.dataset.mark = markToAdd.toString();
    markNode.style.cssText = `background-color: ${color}; border-radius: 4px; padding: 2px 4px; border-bottom: 2px solid ${color.replace('fe', 'f0')}; cursor: pointer; transition: all 0.2s;`;
    
    markNode.appendChild(fragment);

    const supNode = document.createElement('sup');
    supNode.className = 'mark-badge'; 
    supNode.style.cssText = `background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: inherit;`;
    supNode.textContent = `+${markToAdd}`;
    
    markNode.appendChild(supNode);
    range.insertNode(markNode);

    const container = document.getElementById(`esei-box-${activeQIndex}`);
    if (container) {
      setHighlightedAnswers(prev => ({ ...prev, [activeQIndex]: container.innerHTML }));
    }

    setRubricScores(prev => {
      const currentQScore = prev[activeQIndex] || { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };
      return { ...prev, [activeQIndex]: { ...currentQScore, [type]: currentQScore[type] + markToAdd } };
    });

    setPopupPos(null);
    selection.removeAllRanges();
  };

  const updateHighlightMark = () => {
    if (!activeEditHighlight) return;
    const { id, type, mark: oldMark, qIndex } = activeEditHighlight;
    const newMark = editHighlightMark;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedAnswers[qIndex];
    
    const markNode = tempDiv.querySelector(`#${id}`) as HTMLElement;
    if (markNode) {
      markNode.dataset.mark = newMark.toString();
      const supNode = markNode.querySelector('sup.mark-badge');
      if (supNode) {
         if (id.includes('hl-ai')) {
           const labelType = type.charAt(0).toUpperCase() + type.slice(1);
           markNode.innerHTML = `💡 Disemak Semula: ${labelType} <sup class="mark-badge" style="background: #0f172a; color: white; border-radius: 8px; padding: 2px 6px; font-size: 0.65rem; margin-left: 4px;">+${newMark}</sup>`;
         } else {
           supNode.textContent = `+${newMark}`;
         }
      }
      
      setHighlightedAnswers(prev => ({ ...prev, [qIndex]: tempDiv.innerHTML }));

      const diff = newMark - oldMark;
      setRubricScores(prev => {
        const currentQScore = prev[qIndex] || { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };
        return { ...prev, [qIndex]: { ...currentQScore, [type]: Math.max(0, currentQScore[type] + diff) } };
      });
    }
    setActiveEditHighlight(null);
  };

  const deleteHighlight = () => {
    if (!activeEditHighlight) return;
    const { id, type, mark, qIndex } = activeEditHighlight;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedAnswers[qIndex];
    
    const markNode = tempDiv.querySelector(`#${id}`);
    if (markNode) {
      if (id.includes('hl-ai')) {
         markNode.parentNode?.removeChild(markNode);
      } else {
         const supNode = markNode.querySelector('sup.mark-badge');
         if (supNode) markNode.removeChild(supNode);
         
         const fragment = document.createDocumentFragment();
         while (markNode.firstChild) { fragment.appendChild(markNode.firstChild); }
         markNode.parentNode?.replaceChild(fragment, markNode);
      }
      
      setHighlightedAnswers(prev => ({ ...prev, [qIndex]: tempDiv.innerHTML }));

      setRubricScores(prev => {
        const currentQScore = prev[qIndex] || { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };
        return { ...prev, [qIndex]: { ...currentQScore, [type]: Math.max(0, currentQScore[type] - mark) } };
      });
    }
    setActiveEditHighlight(null);
  };

  const handleSaveScore = async () => {
    setIsSavingScore(true);
    try {
      const markahBaru = Number(totalScore);
      const { error } = await supabase.from('test_sessions').update({ score: markahBaru }).eq('id', activeSession.id);
      if (error) throw error;

      const updatePromises = Object.keys(highlightedAnswers).map(async (qIndexStr) => {
        const qIdx = parseInt(qIndexStr, 10);
        const q = parsedQuestions[qIdx];
        if (q && q.options.length === 0) { 
           const htmlContent = highlightedAnswers[qIdx];
           return supabase.from('test_answers').update({ answer_text: htmlContent }).match({ session_id: activeSession.id, question_index: qIdx });
        }
      });
      await Promise.all(updatePromises);

      setSessions(prevSessions => prevSessions.map(s => s.id === activeSession.id ? { ...s, score: markahBaru } : s));
      setShowModal(false); 
      alert('✅ Markah dan Semua Semakan Esei berjaya disimpan secara kekal!');
    } catch (err: any) {
      alert('Ralat Menyimpan: ' + err.message);
    } finally {
      setIsSavingScore(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Selesai</span>;
      case 'ongoing': return <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Sedang Menjawab</span>;
      case 'terminated': return <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Dibatalkan (Menipu)</span>;
      default: return <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>{status}</span>;
    }
  };

  const styles = {
    card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '25px' },
    th: { padding: '15px', textAlign: 'left' as 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 'bold', fontSize: '0.9rem' },
    td: { padding: '15px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontSize: '0.95rem' }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif' }}>
      
      <style>{`
        @media screen {
          .hide-on-screen { display: none !important; }
          .print-only { display: none !important; }
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }

          .modal-overlay, .modal-overlay * { 
            visibility: visible !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .modal-overlay { 
            position: absolute !important; 
            left: 0 !important; top: 0 !important; 
            width: 100% !important; 
            background: white !important; 
            padding: 0 !important; 
          }
          .modal-content { 
            box-shadow: none !important; 
            width: 100% !important; 
            max-width: 100% !important; 
            border: none !important; 
          }
          
          .print-report-container { 
            position: static !important; 
            width: 100% !important; 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            display: block !important;
          }
          .print-table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            margin-top: 15px !important; 
          }
          .print-table th, .print-table td { 
            border: 1px solid #cbd5e1 !important; 
            padding: 8px 10px !important; 
            font-size: 0.85rem !important; 
            text-align: left !important; 
          }
          .print-table th { 
            background-color: #f1f5f9 !important; 
            font-weight: bold !important; 
          }

          .scroll-area { overflow: visible !important; height: auto !important; }
          .hide-on-screen { display: block !important; }
          .print-only { display: block !important; }
        }
        
        .esei-text-box::selection { background: #cbd5e1; }
        mark.essay-highlight:hover { filter: brightness(0.95); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      `}</style>

      {popupPos && (
        <div style={{ position: 'absolute', left: popupPos.x, top: popupPos.y, transform: 'translateX(-50%)', backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', display: 'flex', gap: '8px', zIndex: 9999, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '6px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold' }}>Markah:</span>
            <input type="number" value={highlightMark} onChange={(e) => setHighlightMark(Number(e.target.value))} style={{ width: '45px', padding: '2px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', textAlign: 'center' }} />
          </div>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569', margin: '0 2px' }}></div>
          <button onClick={() => applyHighlightToGrade('isi')} style={{ padding: '6px 10px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>💡 Isi (+{highlightMark})</button>
          <button onClick={() => applyHighlightToGrade('dalil')} style={{ padding: '6px 10px', backgroundColor: '#6b21a8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>📖 Dalil (+{highlightMark})</button>
          <button onClick={() => applyHighlightToGrade('perbincangan')} style={{ padding: '6px 10px', backgroundColor: '#c2410c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>💬 Bincang (+{highlightMark})</button>
          <button onClick={() => applyHighlightToGrade('rumusan')} style={{ padding: '6px 10px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>📝 Rumus (+{highlightMark})</button>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569', margin: '0 2px' }}></div>
          <button onClick={() => setPopupPos(null)} style={{ background: 'none', color: '#cbd5e1', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {activeEditHighlight && (
        <div style={{ position: 'absolute', left: activeEditHighlight.x, top: activeEditHighlight.y, transform: 'translateX(-50%)', backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', display: 'flex', gap: '8px', zIndex: 9999, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '6px' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold' }}>Ubah:</span>
            <input type="number" value={editHighlightMark} onChange={(e) => setEditHighlightMark(Number(e.target.value))} style={{ width: '45px', padding: '2px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', textAlign: 'center' }} />
          </div>
          <button onClick={updateHighlightMark} style={{ padding: '6px 10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>💾 Simpan</button>
          <button onClick={deleteHighlight} style={{ padding: '6px 10px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>🗑️ Padam</button>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569', margin: '0 2px' }}></div>
          <button onClick={() => setActiveEditHighlight(null)} style={{ background: 'none', color: '#cbd5e1', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      <div className="no-print" style={{ backgroundColor: '#3b0764', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#fde047', margin: 0, fontSize: '1.8rem', fontWeight: '900', letterSpacing: '1px' }}>ABQARI <span style={{color: 'white', fontWeight: '300'}}>| Papan Pemuka Keputusan</span></h1>
        <Link href="/tetapan" style={{ color: 'white', textDecoration: 'none', backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px', fontSize: '0.9rem' }}>← Kembali</Link>
      </div>

      <div style={{ maxWidth: '1400px', margin: '40px auto', padding: '0 20px' }}>
        
        <div className="no-print" style={styles.card}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Saringan & Pemilihan Ujian</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Program / Fakulti:</label>
              
              <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'normal', backgroundColor: 'white' }}>
                <option value="">Semua Program / Fakulti</option>
                {uniquePrograms.map(prog => <option key={prog as string} value={prog as string}>{prog as string}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Saring Kod Subjek:</label>
              <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'normal' }}>
                <option value="">Semua Subjek</option>
                {uniqueCourses.map(course => <option key={course as string} value={course as string}>{course as string}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Saring Kumpulan:</label>
              <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'normal' }}>
                <option value="">Semua Kumpulan</option>
                {uniqueGroups.map(group => <option key={group as string} value={group as string}>{group as string}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '5px' }}>Pilih Ujian Untuk Disemak:</label>
            <select value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #3b82f6', fontSize: '0.95rem', fontWeight: 'normal', color: '#1e3a8a', backgroundColor: '#eff6ff' }}>
              <option value="">-- Sila Klik & Pilih Ujian --</option>
              {filteredTests.map(t => <option key={t.id} value={t.id}>{t.course_code} {t.test_name} ({t.group_name || 'Tiada Kumpulan'})</option>)}
            </select>
          </div>
        </div>

        {selectedTest && (
          <div className={`print-report-container ${showModal ? 'no-print' : ''}`} style={{ ...styles.card, position: 'relative' }}>
            
            <div className="print-only" style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2>Laporan Markah Rasmi Peperiksaan</h2>
              <p><strong>Subjek:</strong> {selectedTest.course_code} {selectedTest.test_name} | <strong>Kumpulan:</strong> {selectedTest.group_name || 'N/A'}</p>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Senarai Calon Peperiksaan</h3>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedSessions.length > 0 && (
                  <button onClick={handleDeleteSelected} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    🗑️ Padam Terpilih ({selectedSessions.length})
                  </button>
                )}
                <button onClick={() => { setShowModal(false); setTimeout(() => window.print(), 300); }} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖨️ Cetak Laporan Markah
                </button>
                <button onClick={() => fetchSessionsData(selectedTestId)} style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🔄 Muat Semula
                </button>
              </div>
            </div>

            {isLoading ? <p style={{ textAlign: 'center' }}>Memuatkan data pelajar...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="no-print" style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedSessions.length === sessions.length && sessions.length > 0} onChange={handleSelectAll} style={{ transform: 'scale(1.2)' }} />
                      </th>
                      <th style={{ ...styles.th, width: '50px' }}>No.</th>
                      <th style={styles.th}>No. Matrik</th>
                      <th style={styles.th}>Nama Calon</th>
                      <th style={styles.th}>Tarikh Ambil</th>
                      <th style={styles.th}>Status Serahan</th>
                      <th style={styles.th}>Status Semakan</th>
                      <th style={styles.th}>Markah Keseluruhan</th>
                      <th className="no-print" style={styles.th}>Amaran</th>
                      <th className="no-print" style={styles.th}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session, index) => {
                      const isDisemak = session.score !== null && session.score !== undefined;
                      return (
                        <tr key={session.id} style={{ backgroundColor: selectedSessions.includes(session.id) ? '#f0fdf4' : 'transparent' }}>
                          <td className="no-print" style={{ ...styles.td, textAlign: 'center' }}>
                            <input type="checkbox" checked={selectedSessions.includes(session.id)} onChange={(e) => handleSelectOne(session.id, e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                          </td>
                          <td style={{ ...styles.td, color: '#64748b' }}>{index + 1}.</td>
                          <td style={{ ...styles.td, fontWeight: 'normal', color: '#3b82f6', fontSize: '0.85rem' }}>{session.student_matric}</td>
                          <td style={{ ...styles.td, fontSize: '0.85rem' }}>{session.student_name}</td>
                          <td style={{ ...styles.td, fontSize: '0.85rem', color: '#475569' }}>{formatDate(session.created_at || session.start_time)}</td>
                          <td style={styles.td}>{getStatusBadge(session.status)}</td>
                          <td style={styles.td}>
                            {isDisemak ? (
                               <span style={{ color: '#166534', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Disemak</span>
                            ) : (
                               <span style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>Belum Semak</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            {isDisemak ? (
                              <strong style={{ color: '#166534', backgroundColor: '#dcfce7', padding: '6px 12px', borderRadius: '6px' }}>{session.score}</strong>
                            ) : (
                              <strong style={{ color: '#1e3a8a', backgroundColor: '#eff6ff', padding: '6px 12px', borderRadius: '6px', border: '1px dashed #3b82f6' }}>{session.calculated_score} (Auto)</strong>
                            )}
                          </td>
                          <td className="no-print" style={{ ...styles.td, color: session.warning_count > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{session.warning_count > 0 ? `⚠️ ${session.warning_count}` : '0'}</td>
                          <td className="no-print" style={styles.td}>
                            <button onClick={() => handleViewAnswers(session)} style={{ padding: '5px 12px', fontSize: '0.85rem', backgroundColor: isDisemak ? '#3b82f6' : '#be185d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                              {isDisemak ? 'Semak Semula' : 'Semak Kertas'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {sessions.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Tiada rekod pelajar ditemui untuk ujian ini.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && activeSession && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          
          <div className="modal-content" style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: showSchemePanel ? '1300px' : '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', transition: 'max-width 0.3s' }}>
            
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '500' }}>Nama Pelajar: <span style={{ fontWeight: '600' }}>{activeSession.student_name}</span></h2>
                  <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '0.9rem', fontWeight: '400' }}>Matrik: <span style={{ color: '#0f172a', fontWeight: '500' }}>{activeSession.student_matric}</span> &nbsp;|&nbsp; Kumpulan: <span style={{ color: '#0f172a', fontWeight: '500' }}>{selectedTest?.group_name || 'Tiada Kumpulan'}</span></p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button onClick={() => setShowModal(false)} className="no-print" style={{ padding: '6px 14px', backgroundColor: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '0.9rem' }}>Tutup ✕</button>
                  <div style={{ padding: '6px 12px', border: '2px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent' }}>
                    <span style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>MARKAH KESELURUHAN:</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{totalScore}</span>
                  </div>
                </div>
              </div>
              
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setViewMode('objektif')} style={{ padding: '6px 12px', backgroundColor: viewMode === 'objektif' ? '#3b0764' : '#f1f5f9', color: viewMode === 'objektif' ? 'white' : '#475569', border: viewMode === 'objektif' ? 'none' : '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.825rem' }}>🔘 Soalan Objektif</button>
                  <button onClick={() => setViewMode('esei')} style={{ padding: '6px 12px', backgroundColor: viewMode === 'esei' ? '#3b0764' : '#f1f5f9', color: viewMode === 'esei' ? 'white' : '#475569', border: viewMode === 'esei' ? 'none' : '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.825rem' }}>✍️ Soalan Esei / Subjektif</button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowSchemePanel(!showSchemePanel)} style={{ padding: '6px 12px', backgroundColor: showSchemePanel ? '#e2e8f0' : '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.825rem' }}>{showSchemePanel ? 'Tutup Skema' : '📜 Skema Soalan'}</button>
                  <button onClick={() => window.print()} style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.825rem' }}>🖨️ Cetak PDF</button>
                  <div style={{ height: '20px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 2px' }}></div>
                  {viewMode === 'objektif' && (
                    <button onClick={handleAutoMarkObjektif} style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.825rem' }}>🤖 Kira Objektif (Auto)</button>
                  )}
                  <button onClick={handleSaveScore} disabled={isSavingScore} style={{ padding: '6px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSavingScore ? 'not-allowed' : 'pointer', fontSize: '0.825rem' }}>{isSavingScore ? 'Menyimpan...' : '💾 Simpan Markah'}</button>
                </div>
              </div>
            </div>

            <div className="scroll-area" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              <div className="scroll-area" style={{ flex: showSchemePanel ? '1 1 60%' : '1 1 100%', padding: '20px', overflowY: 'auto', backgroundColor: '#f1f5f9', transition: 'all 0.3s' }}>
                <h3 className="no-print" style={{ margin: '0 0 15px 0', color: '#1e3a8a', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>
                  {viewMode === 'objektif' ? 'Semakan Soalan Objektif' : 'Semakan Soalan Esei (Highlight-to-Grade / AI)'}
                </h3>
                
                <h3 className="print-only" style={{ margin: '0 0 15px 0', color: '#1e3a8a', fontSize: '1.2rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>
                  Laporan Semakan Kertas Jawapan (Keseluruhan)
                </h3>
                
                {parsedQuestions.map((q, index) => {
                  const studentAns = studentAnswers[index];
                  const correctAns = parsedScheme[index]; 
                  const isObj = q.options.length > 0;

                  const isHiddenOnScreen = (viewMode === 'objektif' && !isObj) || (viewMode === 'esei' && isObj);
                  const qRubric = rubricScores[index] || { isi: 0, dalil: 0, perbincangan: 0, rumusan: 0 };

                  return (
                    <div key={index} className={isHiddenOnScreen ? 'hide-on-screen' : ''} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #cbd5e1', breakInside: 'avoid' }}>
                      
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', marginBottom: '15px', color: '#0f172a', lineHeight: '1.6' }}>{q.stem}</div>
                      
                      {isObj ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {q.options.map((opt: any, optIdx: number) => {
                            const optLabel = opt.label.replace(/[\.\)]/g, '').trim();
                            const isChosen = studentAns === optLabel;
                            const isCorrectScheme = correctAns === optLabel;

                            let borderColor = '#e2e8f0'; let bgColor = 'transparent'; let textColor = '#475569'; let badge = null;

                            if (isChosen && isCorrectScheme) {
                              bgColor = '#f0fdf4'; textColor = '#166534';
                              badge = <span style={{ marginLeft: '10px', backgroundColor: '#22c55e', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pilihan Pelajar ✅ Betul</span>;
                            } else if (isChosen && !isCorrectScheme) {
                              bgColor = '#fef2f2'; textColor = '#991b1b';
                              badge = <span style={{ marginLeft: '10px', backgroundColor: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pilihan Pelajar ❌ Salah</span>;
                            } else if (!isChosen && isCorrectScheme) {
                              bgColor = 'transparent'; textColor = '#166534';
                              badge = <span style={{ marginLeft: '10px', border: '1px solid #22c55e', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Jawapan Sebenar</span>;
                            } else if (isChosen) {
                              bgColor = '#eff6ff'; textColor = '#1e3a8a';
                              badge = <span style={{ marginLeft: '10px', backgroundColor: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pilihan Pelajar</span>;
                            }

                            return (
                              <div key={optIdx} style={{ padding: '12px', borderRadius: '8px', border: `2px solid ${borderColor}`, backgroundColor: bgColor }}>
                                <span style={{ fontFamily: 'inherit', fontWeight: isChosen || isCorrectScheme ? 'bold' : 'normal', color: textColor, fontSize: '0.95rem' }}>
                                  <strong>{opt.label}</strong> {opt.text} {badge}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div>
                          <div 
                            id={`esei-box-${index}`}
                            className="esei-text-box"
                            onMouseUp={(e) => handleEseiInteract(e, index)}
                            style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '120px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', color: '#1e293b', cursor: 'text', lineHeight: '1.8' }}
                            dangerouslySetInnerHTML={{ __html: highlightedAnswers[index] || studentAns || '<span style="color:#94a3b8; font-style:italic;">Tiada jawapan direkodkan.</span>' }}
                          />
                          <p className="no-print" style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>*Highlight teks untuk letak markah. Klik pada highlight sedia ada untuk ubah/padam markah.</p>

                          <div className="no-print" style={{ marginTop: '15px' }}>
                            <button 
                              onClick={() => handleAIEssayMark(index)} 
                              disabled={isAiMarking[index] || hasAiMarked[index]}
                              style={{ padding: '8px 16px', backgroundColor: hasAiMarked[index] ? '#94a3b8' : '#0d9488', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isAiMarking[index] || hasAiMarked[index] ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                            >
                              {isAiMarking[index] ? '🤖 AI Sedang Menilai...' : hasAiMarked[index] ? '✅ Disemak oleh AI' : '🤖 Semak Esei dengan AI (Auto-Marking)'}
                            </button>
                          </div>

                          {aiEvaluations[index] && (
                            <div className="no-print" style={{ marginTop: '15px', padding: '12px', backgroundColor: aiEvaluations[index].includes('❌ AI Mengesan Ralat') ? '#fef2f2' : '#f0fdfa', border: `1px solid ${aiEvaluations[index].includes('❌ AI Mengesan Ralat') ? '#f87171' : '#14b8a6'}`, borderRadius: '8px' }}>
                              <strong style={{ color: aiEvaluations[index].includes('❌ AI Mengesan Ralat') ? '#991b1b' : '#0f766e', fontSize: '0.9rem' }}>Laporan AI:</strong>
                              <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: aiEvaluations[index].includes('❌ AI Mengesan Ralat') ? '#7f1d1d' : '#115e59' }}>{aiEvaluations[index]}</p>
                            </div>
                          )}
                          
                          <div style={{ marginTop: '20px', padding: '12px', borderTop: '2px dashed #e2e8f0' }}>
                            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>JUMLAH MARKAH PECAHAN TERKUMPUL (Automatik):</p>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '6px 14px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💡 Isi: <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>{qRubric.isi}</span>
                              </div>
                              <div style={{ backgroundColor: '#faf5ff', color: '#6b21a8', padding: '6px 14px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📖 Dalil: <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>{qRubric.dalil}</span>
                              </div>
                              <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '6px 14px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💬 Bincang: <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>{qRubric.perbincangan}</span>
                              </div>
                              <div style={{ backgroundColor: '#f0fdfa', color: '#0f766e', padding: '6px 14px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #ccfbf1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                📝 Rumusan: <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>{qRubric.rumusan}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}

                {viewMode === 'objektif' && !parsedQuestions.some(q => q.options.length > 0) && (
                  <p className="no-print" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Tiada soalan objektif.</p>
                )}
                {viewMode === 'esei' && !parsedQuestions.some(q => q.options.length === 0) && (
                  <p className="no-print" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Tiada soalan esei.</p>
                )}
              </div>

              {showSchemePanel && (
                <div className="scroll-area no-print" style={{ flex: '1 1 40%', padding: '20px', overflowY: 'auto', backgroundColor: '#ffffff', borderLeft: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#166534', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>Rujukan Skema (Asal)</h3>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', color: '#0f172a', lineHeight: '1.6' }}>
                    {selectedTest?.scheme_data?.rawText || <span style={{ color: '#94a3b8' }}>Tiada skema jawapan ditemui.</span>}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}