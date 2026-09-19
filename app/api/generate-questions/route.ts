import { NextResponse } from "next/server"; 
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300; 
export const dynamic = 'force-dynamic'; 

// Sambungan ke Supabase Client
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =========================================================================
// FUNGSI LAZY RESET & PEMOTONGAN KREDIT HARIAN BERGANTUNG PADA KOS (COST)
// =========================================================================
async function checkAndDeductCredit(userId: string, cost: number) {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Ambil rekod profil pengguna
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('credits_remaining, daily_limit, bonus_credits, last_reset_date')
    .eq('id', userId)
    .single();

  // Jika profil belum wujud, cipta profil asas baharu
  if (error || !profile) {
    const initialCredits = 15;
    await supabase
      .from('profiles')
      .insert([{ id: userId, credits_remaining: initialCredits - cost, daily_limit: 15, last_reset_date: todayStr }]);
    return { success: true, remaining: initialCredits - cost };
  }

  let currentCredits = profile.credits_remaining ?? 15;
  let bonusCredits = profile.bonus_credits || 0;
  const dailyLimit = profile.daily_limit || 15;

  // 2. LAZY RESET: Jika tarikh hari ini berbeza dari last_reset_date, reset ke kredit harian penuh
  if (profile.last_reset_date !== todayStr) {
    currentCredits = dailyLimit;
  }

  // 3. Semak jika gabungan baki harian + bonus masih tidak cukup untuk menampung kos AI
  if ((currentCredits + bonusCredits) < cost) {
    return { 
      success: false, 
      message: `Baki tidak mencukupi untuk enjin ini. Anda perlukan ${cost} kredit, tetapi baki anda hanya ${currentCredits + bonusCredits}. Kredit harian akan diperbaharui esok.` 
    };
  }

  // 4. Potong Kredit secara dinamik (Utamakan Harian, bakinya tolak Bonus)
  if (currentCredits >= cost) {
    currentCredits -= cost;
  } else {
    const remainingCost = cost - currentCredits;
    currentCredits = 0;
    bonusCredits -= remainingCost;
  }

  // Kemas kini pangkalan data
  await supabase
    .from('profiles')
    .update({ 
      credits_remaining: currentCredits, 
      bonus_credits: bonusCredits,
      last_reset_date: todayStr 
    })
    .eq('id', userId);

  return { success: true, remaining: currentCredits + bonusCredits };
}

export async function POST(req: Request) { 
  try { 
    const apiKey = process.env.OPENAI_API_KEY; 

    if (!apiKey) { 
      return NextResponse.json( 
        { error: "Kunci API OpenAI tidak ditemui dalam .env.local." }, 
        { status: 500 } 
      ); 
    } 

    const body = await req.json(); 
    const { 
      mode, // 'A' | 'B' | 'C' | 'SCHEMA' 
      courseName, 
      courseCode, 
      theme, 
      sectionData, 
      topicDistribution, 
      aiModel, 
      co, 
      lo, 
      domain, 
      setSoalan, 
      language 
    } = body; 

    // Tentukan model AI dan kos kreditnya (GPT-4o = 3 Kredit, Mini = 1 Kredit)
    const isArab = language === 'Bahasa Arab'; 
    let selectedModel = aiModel === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini'; 
    if (isArab) { 
      selectedModel = 'gpt-4o'; // Bahasa Arab wajib pakai GPT-4o untuk kualiti Hijaiah
    } 
    
    // Tetapkan kos operasi AI
    const creditCost = selectedModel === 'gpt-4o' ? 3 : 1;

    // =========================================================================
    // KAWALAN KREDIT PENGGUNA (SUPABASE AUTH & LAZY RESET)
    // =========================================================================
    const authHeader = req.headers.get('authorization');
    let userId = body.userId;
    let isAdmin = false;

    // Dapatkan User ID daripada Token Pengesahan Sesi (Bearer Token)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        userId = user.id;

        // =========================================================
        // TETAPAN ADMIN: Masukkan e-mel pentadbir di sini
        // =========================================================
        const adminEmails = [
          'admin@uitm.edu.my', 
          'syahiran@uitm.edu.my'  // <-- GANTIKAN DENGAN E-MEL SEBENAR PROF
        ]; 
        
        if (user.email && adminEmails.includes(user.email)) {
          isAdmin = true; // Jika e-mel sepadan, set pengguna sebagai Admin
        }
        
        // Pilihan tambahan jika menggunakan tetapan 'role' di Supabase
        if (user.user_metadata?.role === 'admin') {
          isAdmin = true;
        }
      }
    }

    // Hanya potong kredit jika pengguna BUKAN Admin dan BUKAN sedang menjana Skema
    if (userId && mode !== 'SCHEMA' && !isAdmin) {
      const creditResult = await checkAndDeductCredit(userId, creditCost);
      if (!creditResult.success) {
        return NextResponse.json(
          { error: creditResult.message },
          { status: 429 } // 429: Too Many Requests / Credit Exceeded
        );
      }
    }
    // =========================================================================

    const count = Number(sectionData?.count) || 0; 
    
    let topicsText = "Silibus standard peringkat universiti."; 
    let hasTopics = false;  

    if (topicDistribution && topicDistribution.length > 0 && mode !== 'SCHEMA') { 
      const activeTopics = topicDistribution.filter((t: any) => t.name.trim() !== '' && Number(t.percentage) > 0); 
      if (activeTopics.length > 0) { 
        hasTopics = true;  
        let totalAssigned = 0; 
        const topicQuotas = activeTopics.map((t: any, index: number) => { 
          let qCount = Math.round((Number(t.percentage) / 100) * count); 
          if (index === activeTopics.length - 1) { 
            qCount = count - totalAssigned;  
          } else { 
            totalAssigned += qCount; 
          } 
          return `- TEPAT ${qCount} Soalan dari topik: ${t.name}`; 
        }); 
         
        topicsText = `KUOTA TOPIK YANG SANGAT KETAT (WAJIB PATUH):\n${topicQuotas.join('\n')}\n(DILARANG MENCAMPURADUKKAN ATAU MELANGGAR KUOTA INI)`; 
      } 
    } else if (topicDistribution && topicDistribution.length > 0) { 
        const activeTopics = topicDistribution.filter((t: any) => t.name.trim() !== '' && Number(t.percentage) > 0); 
        if (activeTopics.length > 0) { 
            hasTopics = true; 
            topicsText = activeTopics.map((t: any) => `- ${t.name}`).join('\n'); 
        } 
    } 

    // Ekstrak CO, LO, dan Domain untuk dimasukkan ke dalam Prompt AI 
    const coText = (co && co.length > 0) ? co.join(', ') : 'CO1'; 
    const loText = (lo && lo.length > 0) ? lo.join(', ') : 'LO1'; 
    const domainText = (domain && domain.length > 0) ? domain.join(', ') : 'C1, C2, C3, C4, C5, C6'; 

    const isEng = language === 'English'; 
    const markText = isEng ? 'Marks' : (isArab ? 'درجات' : 'Markah'); 

    let systemInstruction = ""; 
    let systemRole = "Anda adalah Penggubal Soalan Peperiksaan Rasmi Akademik UiTM (ABQARI)."; 

    // Tag JSU & Aturan Anti-Halusinasi Referensi 
    const globalRules = ` 
AMARAN KERAS TAG JSU, FORMAT & BUKTI RUJUKAN${hasTopics ? ' & TOPIK' : ''}: 
1. DILARANG menggunakan simbol pagar (#). Anda WAJIB menjana 4 Tag JSU menggunakan kurungan siku [ ] berdasarkan pilihan sah ini: 
   - Pilih satu CO: [${coText}] 
   - Pilih satu LO: [${loText}] 
   - Pilih satu Domain: [${domainText}] 
   Format wajib: [Aras: CX] [COX] [LOX] [CX] (Contoh: [Aras: C3] [CO1] [LO1] [C3]) 
2. TAG RUJUKAN ${hasTopics ? '& TOPIK ' : ''}ADALAH WAJIB (ANTI-HALUSINASI): 
   - JANGAN mengarang (halusinasi) nombor Bab atau Muka Surat palsu seperti Bab 3 atau 4 jika tiada dalam silibus! 
   - Anda WAJIB merujuk kepada Nama Topik sebenar dari senarai di atas. (Contoh Rujukan yang betul: [Rujukan: Topik Falsafah Islam]${hasTopics ? ' [Topik: Falsafah Islam]' : ''}) 
3. DILARANG meletakkan sebarang tajuk (heading) pemisah. Terus mula menjana nombor soalan. 
4. DILARANG memberi ayat mukadimah. 
${isArab ? '5. AMARAN BAHASA: Anda WAJIB menjana KESELURUHAN soalan dan jawapan menggunakan TULISAN ARAB SEBENAR (HURUF HIJAIAH). HARAM SAMA SEKALI menggunakan tulisan Rumi!' : ''} 
`; 

    if (mode === 'A' || mode === 'B' || mode === 'C') { 
      const type = sectionData?.type; 
      const marks = Number(sectionData?.marks) || 0; 
      const beranakCount = Number(sectionData?.beranakCount) || 0; 
      const markPerQ = count > 0 ? (marks / count) : 0; 

      if (type === 'objektif') { 
        systemInstruction = ` 
ANDA DITUGASKAN MENJANA SOALAN OBJEKTIF BAHAGIAN ${mode}. 
Subjek: ${courseCode || ""} ${courseName || "Umum"} | Set: SET ${setSoalan || "1"} | Bahasa: ${language || 'Bahasa Melayu'} 
Jumlah Soalan Wajib: TEPAT ${count} Soalan (${markPerQ} ${markText} Setiap Soalan). 
Topik & Silibus: 
${topicsText} 

${globalRules} 

PENGASINGAN FORMAT OBJEKTIF: 
- TEPAT ${beranakCount} Soalan WAJIB dibina dalam FORMAT OBJEKTIF BERANAK (ROMAN). 
- BAKI ${count - beranakCount} Soalan WAJIB dibina dalam FORMAT OBJEKTIF LANGSUNG (BIASA). 

ATURAN OBJEKTIF BERANAK (ROMAN): 
Anda WAJIB meniru struktur template di bawah ini tepat 100%. AMARAN KERAS: JANGAN SKIP senarai nombor Roman (i, ii, iii, iv)! 

TEMPLATE WAJIB DITIRU (Patuhi jarak baris kosong ini): 
[Nombor Soalan]. [Ayat Penyata/Senario yang lengkap, minimum 1-2 ayat] 

[Ayat Tanya - contoh: Apakah elemen tersebut?] 

i. [Fakta 1] 
ii. [Fakta 2] 
iii. [Fakta 3] 
iv. [Fakta 4] 

A. [Kombinasi Roman, contoh: i dan ii] 
B. [Kombinasi Roman, contoh: ii dan iii] 
C. [Kombinasi Roman, contoh: i dan iii] 
D. Semua di atas 
[Aras: CX] [COX] [LOX] [CX] [Rujukan: Nama Topik]${hasTopics ? ' [Topik: Nama Topik]' : ''} 

ATURAN OBJEKTIF LANGSUNG (BIASA): 
1. Penyata dan Soalan WAJIB BERCAMPUR terus di dalam SATU perenggan yang sama. 
2. HARAM menggunakan frasa "Berdasarkan pernyataan di atas...". 
3. TINGGALKAN TEPAT 1 BARIS KOSONG (ENTER) selepas perenggan soalan. 
4. Senaraikan terus pilihan A, B, C, dan D rapat ke bawah tanpa baris kosong. (AMARAN: Pilihan D WAJIB fakta spesifik. HARAM menggunakan "Semua di atas"). 
5. WAJIB letak 4 Tag JSU, 1 Tag Rujukan${hasTopics ? ', dan 1 Tag Topik' : ''} di baris baharu selepas pilihan D. 

SYARAT DISTRAKTOR: 
- Pilihan A, B, C, D maksimum 9 patah perkataan. Distraktor WAJIB homogen dan sangat munasabah. 
        `; 
      } else if (type === 'true_false') { 
        systemInstruction = ` 
ANDA DITUGASKAN MENJANA SOALAN BENAR / SALAH BAHAGIAN ${mode}. 
Subjek: ${courseCode || ""} ${courseName || "Umum"} | Set: SET ${setSoalan || "1"} | Bahasa: ${language || 'Bahasa Melayu'} 
Jumlah Soalan Wajib: TEPAT ${count} Soalan (${markPerQ} ${markText} Setiap Soalan). 
Topik & Silibus: 
${topicsText} 

${globalRules} 

ATURAN KETAT SOALAN BENAR / SALAH: 
1. Setiap soalan MESTI mengandungi SATU pernyataan fakta akademik yang tegas dan berfokus. 
2. Nisbah jawapan BENAR dan SALAH hendaklah seimbang. Penyata SALAH mesti dibina berdasarkan kesilapan konsep lazim. 
3. Di hujung setiap penyata, TINGGALKAN TEPAT SATU BARIS KOSONG (ENTER) dan letakkan pilihan ini supaya pelajar boleh memilih: [ BENAR ]   [ SALAH ] 
4. Setiap soalan MESTI diakhiri dengan 4 Tag JSU, 1 Tag Rujukan${hasTopics ? ', dan 1 Tag Topik' : ''} di baris baharu bawah pilihan tersebut. 
        `; 
      } else if (type === 'essay') { 
        const halfMark = (markPerQ / 2).toFixed(1); 
        const quarterMark = (markPerQ / 4).toFixed(1); 

        let splitInstruction = ""; 
        if (markPerQ >= 10) { 
          splitInstruction = `Wajib 4 pecahan anak soalan menggunakan abjad a), b), c), d) TANPA titik. Agihan markah [${quarterMark} ${markText}] di baris baharu di bawah setiap anak soalan.`; 
        } else if (markPerQ >= 3) { 
          splitInstruction = `Wajib 2 pecahan anak soalan menggunakan abjad a) dan b) TANPA titik. Agihan markah [${halfMark} ${markText}] di baris baharu di bawah setiap anak soalan.`; 
        } else { 
          splitInstruction = `DILARANG buat pecahan (tiada a, b, c). Bina 1 soalan terus bernilai [${markPerQ} ${markText}].`; 
        } 

        systemInstruction = ` 
ANDA DITUGASKAN MENJANA SOALAN ESEI / SUBJEKTIF BAHAGIAN ${mode}. 
Subjek: ${courseCode || ""} ${courseName || "Umum"} | Set: SET ${setSoalan || "1"} | Bahasa: ${language || 'Bahasa Melayu'} 
Jumlah Soalan Utama: TEPAT ${count} Soalan (Jumlah Markah Bahagian: ${marks} ${markText}). 
Topik & Silibus: 
${topicsText} 

${globalRules} 

ATURAN KETAT ESEI / SUBJEKTIF: 
1. Mulakan setiap soalan utama dengan AYAT PENYATA / SENARIO KES. 
2. Ayat Penyata WAJIB dipanjangkan (2 hingga 4 ayat) bagi menimbulkan situasi semasa yang 'live'. 
3. Ayat Penyata WAJIB BERPISAH daripada pecahan anak soalan di bawahnya (Tinggalkan 1 baris kosong). 
4. ${splitInstruction} 
5. Letak 4 Tag JSU, 1 Tag Rujukan${hasTopics ? ', dan 1 Tag Topik' : ''} di baris markah atau di hujung setiap pecahan soalan. 
        `; 
      } 
    } else if (mode === 'SCHEMA') { 
      const fullQuestions = body.fullQuestions; 
      systemInstruction = ` 
ANDA DITUGASKAN MENYEDIAKAN SKEMA JAWAPAN LENGKAP. 
Subjek: ${courseCode || ""} ${courseName || "Umum"} | Bahasa: ${language || 'Bahasa Melayu'} 

KERTAS SOALAN LENGKAP: 
${fullQuestions} 

${globalRules} 

ATURAN SKEMA JAWAPAN (WAJIB PATUH): 
- DILARANG meletakkan tajuk pemisah seperti '## BAHAGIAN' atau '# SKEMA'. Terus mula dengan nombor soalan mengikut susunan. 
1. Untuk Soalan Objektif: Tulis Jawapan MENEGAK SATU BARIS SATU JAWAPAN (Contoh: 1. A \n 2. B). 
2. Untuk Soalan Benar/Salah: HANYA tulis Nombor Soalan dan pilihan jawapannya sahaja sama ada [BENAR] atau [SALAH]. 
3. Untuk Soalan Esei: Salin semula soalan penuh (Penyata dan Anak Soalan) dan berikan poin jawapan analitikal yang tepat berserta pecahan markah. 
      `; 
    } 

    const res = await fetch("https://api.openai.com/v1/chat/completions", { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}`, 
      }, 
      body: JSON.stringify({ 
        model: selectedModel, 
        temperature: 0.2,  
        max_tokens: 8000,  
        messages: [ 
          { role: "system", content: systemRole }, 
          { role: "user", content: systemInstruction }, 
        ], 
      }), 
    }); 

    const data = await res.json(); 
    if (!res.ok || data.error) throw new Error(data.error?.message || `Ralat: ${res.status}`); 

    return NextResponse.json({ success: true, data: data.choices?.[0]?.message?.content }); 
  } catch (error: any) { 
    return NextResponse.json({ error: error.message || "Gagal menjana soalan." }, { status: 500 }); 
  } 
}