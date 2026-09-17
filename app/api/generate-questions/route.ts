import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
      courseName,
      courseCode,
      theme,
      sections,
      topicDistribution,
      aiModel,
      context,
      co,
      lo,
      setSoalan
    } = body;

    let topicsText = "Silibus standard peringkat universiti.";
    if (topicDistribution && topicDistribution.length > 0) {
      topicsText = topicDistribution
        .filter((t: any) => t.name.trim() !== '')
        .map((t: any) => `- ${t.name} (Wajaran: ${t.percentage}%)`)
        .join('\n');
    }

    // Fungsi pintar mengira markah seragam (termasuk titik perpuluhan jika ada)
    const getMarksPerQ = (marks: any, count: any) => {
       const m = Number(marks) || 0;
       const c = Number(count) || 1;
       const val = m / c;
       return Number.isInteger(val) ? val.toString() : val.toFixed(1);
    };

    const formatType = (type: string, marksPerQ: string) => {
        if (type === 'true_false') return `BENAR ATAU SALAH (Sediakan penyataan fakta. WAJIB letak (${marksPerQ} Markah) di hujung soalan)`;
        if (type === 'essay') return `ESSEI / SUBJEKTIF (Mesti bermula dengan ayat penyata/konteks. WAJIB letak nilai markah seragam iaitu (${marksPerQ} Markah) pada BARIS BAHARU di bawah setiap soalan)`;
        return `OBJEKTIF ANEKA PILIHAN (Sediakan pilihan jawapan A, B, C, D. Setiap soalan bernilai ${marksPerQ} Markah)`;
    };

    const formatBloom = (bloomObj: any) => {
        if (!bloomObj) return "Secara seimbang.";
        const parts = [];
        if (bloomObj.C1 > 0) parts.push(`${bloomObj.C1} soalan C1`);
        if (bloomObj.C2 > 0) parts.push(`${bloomObj.C2} soalan C2`);
        if (bloomObj.C3 > 0) parts.push(`${bloomObj.C3} soalan C3`);
        if (bloomObj.C4 > 0) parts.push(`${bloomObj.C4} soalan C4`);
        if (bloomObj.C5 > 0) parts.push(`${bloomObj.C5} soalan C5`);
        if (bloomObj.C6 > 0) parts.push(`${bloomObj.C6} soalan C6`);
        return parts.length > 0 ? parts.join(", ") : "Campuran rawak.";
    };

    const sectionA = sections?.A?.enabled && sections.A.count > 0 ? `1. BAHAGIAN A:
   - Jumlah: TEPAT ${sections.A.count} soalan.
   - Format: ${formatType(sections.A.type, getMarksPerQ(sections.A.marks, sections.A.count))}.
   - PECAHAN ARAS BLOOM: ${formatBloom(sections.A.bloom)}.` : "";

    const sectionB = sections?.B?.enabled && sections.B.count > 0 ? `2. BAHAGIAN B:
   - Jumlah: TEPAT ${sections.B.count} soalan.
   - Format: ${formatType(sections.B.type, getMarksPerQ(sections.B.marks, sections.B.count))}.
   - PECAHAN ARAS BLOOM: ${formatBloom(sections.B.bloom)}.` : "";

    const sectionC = sections?.C?.enabled && sections.C.count > 0 ? `3. BAHAGIAN C:
   - Jumlah: TEPAT ${sections.C.count} soalan.
   - Format: ${formatType(sections.C.type, getMarksPerQ(sections.C.marks, sections.C.count))}.
   - PECAHAN ARAS BLOOM: ${formatBloom(sections.C.bloom)}.` : "";

    const activeParts = [];
    if (sectionA) activeParts.push("Bahagian A");
    if (sectionB) activeParts.push("Bahagian B");
    if (sectionC) activeParts.push("Bahagian C");
    const activeSectionsStr = activeParts.length > 0 ? activeParts.join(", ") : "Bahagian yang ditetapkan";

    const domainMapping = co && co.length > 0 ? co.join(', ') : 'C1, C2, C3, A3, A5';
    const coMapping = co && co.length > 0 ? co.join(', ') : 'CO1';
    const loMapping = lo && lo.length > 0 ? lo.join(', ') : 'LO1';

    const systemInstruction = `Anda adalah Profesor dan Penggubal Soalan Peperiksaan Rasmi (ABQARI - UiTM).
Subjek: ${courseCode || ""} ${courseName || "Umum"}
Set Soalan: SET ${setSoalan || "1"}

KANDUNGAN NOTA / DOKUMEN RUJUKAN:
${context ? context : "Tiada nota. GUNA PANGKALAN PENGETAHUAN AKADEMIK ANDA SECARA TEPAT."}

ARAHAN WAJIB STRUKTUR SOALAN ESEI / SUBJEKTIF:
- SETIAP SOALAN ESEI WAJIB DIMULAKAN DENGAN SATU ATAU DUA AYAT PENYATA / PEMBUKA SITUASI TERLEBIH DAHULU SEBELUM SOALAN UTAMA DIAJUKAN.
- WAJIB letakkan nilai markah pada BARIS BAHARU di bawah setiap soalan esei.
- AMARAN MARKAH: JANGAN KIRA SENDIRI! Semua soalan dalam bahagian yang sama mesti mempunyai jumlah markah yang SAMA RATA TEPAT seperti yang diisytiharkan dalam format.

ARAHAN KETAT TEMA & SET:
- TEMA PILIHAN: "${theme || "Semua Tema"}"
- SET SOALAN: SET ${setSoalan || "1"}

=========================================================
!!! AMARAN KERAS: ARAHAN TAG SOALAN (WAJIB DIPATUHI) !!!
=========================================================
ANDA WAJIB MELETAKKAN KESEMUA EMPAT (4) TAG LENGKAP DI HUJUNG SETIAP SOALAN (ATAU SELEPAS PILIHAN JAWAPAN BAGI OBJEKTIF). 
JANGAN TINGGAL WALAU SATU TAG PUN! JANGAN LETAK TAG DI BARIS MARKAH!

Format Wajib (4 Kurungan): [Aras: CX] [COx] [LOx] [Kod Domain]
*Untuk tag Domain, tulis KOD SAHAJA. Contoh: [C1] atau [A3]. JANGAN guna perkataan "Domain:".

CONTOH SOALAN OBJEKTIF YANG BETUL (WAJIB ADA 4 TAG!):
1. Manakah antara berikut merupakan rukun iman yang pertama?
   A. Percaya kepada Rasul
   B. Percaya kepada Allah
   C. Percaya kepada Kitab
   D. Percaya kepada Qada dan Qadar
   [Aras: C1] [CO1] [LO1] [C1]

CONTOH SOALAN ESEI YANG BETUL (WAJIB ADA 4 TAG!):
1. Perpaduan nasional merupakan teras utama dalam mengekalkan keharmonian masyarakat majmuk. Bincangkan sejauh mana prinsip Rukun Negara memupuk semangat ini. [Aras: C4] [CO2] [LO3] [C3]
(20 Markah)
=========================================================

PERATURAN SOALAN OBJEKTIF & SKEMA:
1. SOALAN OBJEKTIF: DILARANG guna kata kerja esei (Jelaskan, Senaraikan).
2. SKEMA OBJEKTIF: Hanya tulis nombor dan huruf jawapan sahaja (cth: 1. A, 2. B).

BLUEPRINT SOALAN (HANYA JANA BAHAGIAN YANG DINYATAKAN DI BAWAH SAHAJA. JANGAN JANA BAHAGIAN LAIN!):
${sectionA}
${sectionB}
${sectionC}

CAKUPAN TOPIK:
${topicsText}

FORMAT OUTPUT MANDATORI:
Keluarkan hasil dalam DUA bahagian yang dipisahkan secara TEPAT oleh tag [PENJANAAN SKEMA JAWAPAN]:

# BAHAGIAN 1: KERTAS SOALAN PEPERIKSAAN
(Tulis HANYA soalan untuk ${activeSectionsStr} di sini. TIADA JAWAPAN DI SINI)

[PENJANAAN SKEMA JAWAPAN]

# BAHAGIAN 2: SKEMA JAWAPAN DAN AGIHAN MARKAH
(Tulis skema jawapan rasmi mengikut format ketat di sini)`;

    console.log(`[OpenAI API] Menjana soalan (SET ${setSoalan})...`);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o',
        temperature: 0.5,
        max_tokens: 12000,
        messages: [
          {
            role: "system",
            content: "Anda adalah enjin ABQARI. WAJIB pastikan kesemua empat (4) tag [Aras: CX] [COx] [LOx] [Kod Domain] sentiasa ditulis lengkap di hujung setiap soalan. Bagi esei, letak nilai markah (contoh: (5 Markah)) di baris baharu berasingan.",
          },
          {
            role: "user",
            content: systemInstruction,
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Ralat Pelayan: ${res.status}`);
    }

    const generatedText = data.choices?.[0]?.message?.content;

    return NextResponse.json({
      success: true,
      text: generatedText,
      data: generatedText,
    });
  } catch (error: any) {
    console.error("❌ Ralat API:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menjana soalan." },
      { status: 500 }
    );
  }
}