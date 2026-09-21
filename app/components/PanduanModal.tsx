'use client';

import React, { useState } from 'react';

export default function PanduanModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'tutorial' | 'faq'>('tutorial');

  if (!isOpen) return null;

  const styles = {
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modal: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' },
    header: { padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' },
    title: { margin: 0, color: '#3b0764', fontSize: '1.4rem', fontWeight: '900' },
    closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' },
    tabContainer: { display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
    tab: (isActive: boolean) => ({ flex: 1, padding: '15px', textAlign: 'center' as const, fontWeight: '700', cursor: 'pointer', backgroundColor: isActive ? 'white' : 'transparent', color: isActive ? '#3b82f6' : '#64748b', borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent', transition: 'all 0.2s' }),
    contentArea: { padding: '30px', overflowY: 'auto' as const, flex: 1, color: '#334155', lineHeight: '1.6' },
    h3: { color: '#4a154b', marginTop: '0', marginBottom: '15px', fontSize: '1.3rem', fontWeight: '800', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' },
    h4: { color: '#0f172a', marginTop: '25px', marginBottom: '10px', fontSize: '1.1rem', fontWeight: '700' },
    p: { margin: '0 0 15px 0', fontSize: '0.95rem' },
    ul: { margin: '0 0 15px 0', paddingLeft: '20px', fontSize: '0.95rem' },
    li: { marginBottom: '8px' },
    table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px', fontSize: '0.9rem' },
    th: { padding: '12px', backgroundColor: '#f1f5f9', textAlign: 'left' as const, fontWeight: 'bold', color: '#3b0764', border: '1px solid #e2e8f0' },
    td: { padding: '12px', border: '1px solid #e2e8f0', verticalAlign: 'top' as const },
    faqQ: { fontWeight: '700', color: '#0f172a', marginTop: '20px', marginBottom: '8px', fontSize: '1rem' },
    faqA: { color: '#475569', fontSize: '0.95rem', margin: '0 0 15px 0', lineHeight: '1.6' }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        <div style={styles.header}>
          <h2 style={styles.title}>Maklumat Sistem ABQARI</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.tabContainer}>
          <div style={styles.tab(activeTab === 'tutorial')} onClick={() => setActiveTab('tutorial')}>
            📖 Panduan Penggunaan
          </div>
          <div style={styles.tab(activeTab === 'faq')} onClick={() => setActiveTab('faq')}>
            ❓ Soalan Lazim (FAQ)
          </div>
        </div>

        <div style={styles.contentArea}>
          {activeTab === 'tutorial' && (
            <div>
              <h3 style={styles.h3}>1. Pengenalan kepada ABQARI</h3>
              <p style={styles.p}><strong>ABQARI</strong> (Advanced Blueprint & Question Assessment Resource Integrator) adalah ekosistem AI khusus untuk warga akademik merevolusikan pengurusan bahan pengajaran, analisis rujukan, dan penjanaan instrumen penilaian pelajar.</p>
              
              <h4 style={styles.h4}>Konsep AI Sebagai Pemudah Cara (Co-Pilot) & Kredit</h4>
              <p style={styles.p}>ABQARI direka sebagai pemudah cara (co-pilot) yang menjana deraf awal berstruktur tinggi. Pensyarah bertindak sebagai penentu akhir (Subject Matter Expert) untuk menyemak dan mengesahkan soalan. Untuk memastikan kelestarian pelayan, penggunaan sistem ini akan menolak <strong>Kredit Penggunaan</strong> dari akaun anda berdasarkan enjin AI yang dipilih.</p>

              <h3 style={styles.h3}>2. Aliran Kerja Utama (Langkah demi Langkah)</h3>
              
              <h4 style={styles.h4}>Langkah 1: Mendaftar Subjek di 'Pengurusan Kursus'</h4>
              <ul style={styles.ul}>
                <li>Anda <strong>DIWAJIBKAN</strong> mendaftar subjek terlebih dahulu. Ini untuk memastikan rujukan dan soalan mempunyai pemetaan yang betul.</li>
                <li>Klik <strong>+ Daftar Subjek Baharu</strong>, masukkan kod dan nama kursus.</li>
                <li>Tandakan (tick) pemetaan untuk Domain Taksonomi Bloom (Kognitif, Psikomotor, Afektif) dan MQF 2.0 (LO) yang bersesuaian, kemudian klik Simpan.</li>
              </ul>

              <h4 style={styles.h4}>Langkah 2: Memuat Naik Rujukan di 'Pusat Sumber (Nota AI)'</h4>
              <ul style={styles.ul}>
                <li>Klik butang <strong>+ Tambah Dokumen Baru</strong>.</li>
                <li>Pilih Subjek yang telah didaftarkan dari senarai juntai bawah.</li>
                <li>Muat naik fail rujukan rasmi (PDF). Tunggu sehingga sistem selesai mengekstrak vektor dokumen ke dalam memori AI.</li>
              </ul>

              <h4 style={styles.h4}>Langkah 3: Menguji Modul di 'Pembantu AI (RAG)'</h4>
              <ul style={styles.ul}>
                <li>Buka modul Pembantu AI dan pilih Subjek Rujukan yang ingin disoal.</li>
                <li>Taip soalan (cth: "Senaraikan 3 cabaran isu semasa"). AI akan membalas dengan jawapan yang diekstrak semata-mata daripada PDF anda berserta petikan rujukan.</li>
              </ul>

              <h4 style={styles.h4}>Langkah 4: Penyimpanan di 'Bank Soalan Kursus' (Pilihan)</h4>
              <ul style={styles.ul}>
                <li>Anda boleh memasukkan soalan-soalan lepas (Past Year Questions) secara manual. Labelkan mengikut Subjek, Aras Bloom, dan CO/LO agar mudah dicari.</li>
              </ul>

              <h4 style={styles.h4}>Langkah 5: Menjana Soalan di 'Penjana Soalan & JSU'</h4>
              <p style={styles.p}>Di modul utama ini, sistem membina soalan peperiksaan dan skema pemarkahan serentak bersama JSU.</p>
              <ul style={styles.ul}>
                <li>Pilih Subjek dan tetapkan spesifikasi peperiksaan (jumlah soalan, aras, jenis format, topik).</li>
                <li>Pilih jenis <strong>Enjin Penjana AI</strong>. Klik Jana dan tunggu proses siap.</li>
              </ul>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kriteria</th>
                    <th style={styles.th}>Enjin Standard (Ringan)</th>
                    <th style={styles.th}>Enjin Premium (Prestasi Tinggi)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{...styles.td, fontWeight: 'bold'}}>Model AI</td>
                    <td style={styles.td}>GPT-4o-Mini</td>
                    <td style={styles.td}>GPT-4o / GPT-4-Turbo</td>
                  </tr>
                  <tr>
                    <td style={{...styles.td, fontWeight: 'bold'}}>Caj Kredit</td>
                    <td style={{...styles.td, color: '#16a34a', fontWeight: 'bold'}}>1 Kredit</td>
                    <td style={{...styles.td, color: '#dc2626', fontWeight: 'bold'}}>3 Kredit</td>
                  </tr>
                  <tr>
                    <td style={{...styles.td, fontWeight: 'bold'}}>Kesesuaian</td>
                    <td style={styles.td}>Soalan ringkas, ujian sumatif pendek, soalan aneka pilihan (MCQ), struktur tahap rendah (C1-C3).</td>
                    <td style={styles.td}>Esei kompleks, kajian kes, analisis tahap tinggi KBAT (C4-C6), dan skema terperinci.</td>
                  </tr>
                  <tr>
                    <td style={{...styles.td, fontWeight: 'bold'}}>Analisis RAG</td>
                    <td style={styles.td}>Ekstraksi maklumat terus daripada fakta nota.</td>
                    <td style={styles.td}>Penaakulan mendalam, hubung kait topik, dan olahan kritis.</td>
                  </tr>
                </tbody>
              </table>

              <h4 style={styles.h4}>Langkah 6: Mengurus Hasil di 'Arkib & Laporan'</h4>
              <ul style={styles.ul}>
                <li>Di sini anda boleh melihat sejarah penjanaan kertas soalan.</li>
                <li>Tekan butang <strong>Eksport ke MS Word</strong> atau <strong>Muat Turun PDF</strong> untuk menyunting soalan di komputer anda secara rasmi.</li>
              </ul>
            </div>
          )}

          {activeTab === 'faq' && (
            <div>
              <h3 style={styles.h3}>Soalan Lazim (FAQ) Sistem ABQARI</h3>
              
              <div style={styles.faqQ}>1. Apakah sebenarnya fungsi utama ABQARI?</div>
              <div style={styles.faqA}>ABQARI berfungsi sebagai pembantu kecerdasan buatan (AI) peribadi untuk pensyarah. Ia memudahkan proses pembacaan bahan rujukan (melalui fail PDF) dan mengautomasikan penjanaan kertas soalan peperiksaan berserta Jadual Spesifikasi Ujian (JSU) yang selari dengan piawaian akademik fakulti.</div>

              <div style={styles.faqQ}>2. Adakah soalan yang dijana oleh ABQARI boleh terus digunakan untuk peperiksaan?</div>
              <div style={styles.faqA}>ABQARI bertindak sebagai pemudah cara (co-pilot), bukan pengganti pensyarah. Sistem ini akan membina deraf soalan berstruktur tinggi, namun pensyarah sebagai Pakar Bidang (Subject Matter Expert) wajib menyemak, menyunting, dan menentusahkan ketepatan soalan tersebut sebelum ia dijadikan dokumen peperiksaan rasmi.</div>

              <div style={styles.faqQ}>3. Mengapa saya tidak boleh memuat naik nota PDF secara terus di Pusat Sumber?</div>
              <div style={styles.faqA}>Anda diwajibkan mendaftar profil subjek di modul Pengurusan Kursus terlebih dahulu. Pendaftaran ini penting bagi membolehkan sistem menetapkan pemetaan CO, LO, dan domain Taksonomi Bloom. Selepas subjek wujud, barulah dokumen PDF dapat dikaitkan dengan tepat.</div>

              <div style={styles.faqQ}>4. Apakah perbezaan antara Enjin Penjana Standard dan Premium?</div>
              <div style={styles.faqA}>
                <strong>Enjin Standard (1 Kredit):</strong> Untuk soalan aneka pilihan (MCQ), struktur aras rendah (C1-C3), atau ujian ringkas.<br/>
                <strong>Enjin Premium (3 Kredit):</strong> Untuk soalan esei kompleks, kajian kes, soalan KBAT (C4-C6), dan skema jawapan yang terperinci.
              </div>

              <div style={styles.faqQ}>5. Adakah sistem akan menolak kredit jika saya tersilap menjana soalan?</div>
              <div style={styles.faqA}>Ya, setiap penjanaan yang berjaya diproses akan menolak kredit (1 atau 3 kredit). Pastikan tetapan soalan dan topik adalah tepat sebelum menekan butang jana. Jika kredit kehabisan, hubungi Pentadbir Sistem (Admin).</div>

              <div style={styles.faqQ}>6. Bolehkah saya memadam dokumen nota atau soalan lama?</div>
              <div style={styles.faqA}>Boleh. Dokumen PDF boleh dipadam melalui modul Pusat Sumber (Nota), dan memori vektor AI berkaitan dengannya akan dihapuskan sepenuhnya. Kertas soalan lama boleh diuruskan di modul Arkib & Laporan.</div>

              <div style={styles.faqQ}>7. Bagaimanakah cara untuk saya menyunting soalan yang telah dijana?</div>
              <div style={styles.faqA}>Semua soalan dan JSU yang siap dijana disimpan automatik. Pergi ke modul Arkib & Laporan, klik butang Eksport ke MS Word, muat turun, dan sunting di komputer anda.</div>

              <div style={styles.faqQ}>8. Adakah AI ini menggunakan maklumat dari internet atau semata-mata nota saya?</div>
              <div style={styles.faqA}>ABQARI menggunakan teknologi RAG. Apabila anda menyoal di Pembantu AI, enjin diwajibkan mencari jawapan daripada teks PDF anda dahulu. Jika maklumat tiada, ia menggunakan pengetahuan am AI berserta nota penafian.</div>

              <div style={styles.faqQ}>9. Apakah format fail yang disokong untuk dimuat naik ke Pusat Sumber?</div>
              <div style={styles.faqA}>Hanya fail berformat <strong>PDF</strong> disokong. Pastikan dokumen mengandungi teks yang boleh dibaca (searchable text) dan bukan sekadar gambar yang diimbas (scanned images) untuk ekstraksi tepat.</div>

              <div style={styles.faqQ}>10. Bolehkah pensyarah lain melihat nota, subjek, atau soalan yang saya jana?</div>
              <div style={styles.faqA}>Tidak. Sistem dilengkapi privasi ketat. Setiap pensyarah hanya boleh melihat subjek, rujukan, dan arkib soalan milik sendiri. Hanya Admin mempunyai akses menyeluruh.</div>

              <div style={styles.faqQ}>11. Saya berjaya daftar akaun baharu, mengapa saya dihalang mengakses papan pemuka?</div>
              <div style={styles.faqA}>Setiap pendaftaran baharu berada dalam status 'Pending'. Anda perlu menunggu Admin menyemak dan meluluskan akaun anda sebelum dibenarkan menggunakan modul.</div>

              <div style={styles.faqQ}>12. Apakah perbezaan 'Bank Soalan Kursus' dan 'Arkib & Laporan'?</div>
              <div style={styles.faqA}>
                <strong>Bank Soalan Kursus:</strong> Repositori peribadi untuk menaip, menyimpan, dan melabel soalan sedia ada secara berasingan.<br/>
                <strong>Arkib & Laporan:</strong> Halaman penyimpanan automatik sejarah kertas peperiksaan penuh yang telah dijana oleh AI.
              </div>

              <div style={styles.faqQ}>13. Apa perlu saya lakukan jika proses penjanaan ralat atau pelayan timeout?</div>
              <div style={styles.faqA}>Buka modul Arkib & Laporan dahulu untuk melihat jika soalan berjaya dijana di latar belakang. Jika tiada, cuba semula atau tukar kepada Enjin Standard untuk proses yang lebih pantas.</div>

              <div style={styles.faqQ}>14. Bolehkah saya menukar gambar profil dan butiran peribadi?</div>
              <div style={styles.faqA}>Boleh. Di Papan Pemuka utama, klik butang "Kemaskini Profil" atau ikon gambar profil untuk menukar nama, fakulti, telefon, memuat naik gambar (had 5MB), dan menetapkan kata laluan baharu.</div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}