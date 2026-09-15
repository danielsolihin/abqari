'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import styles from './UploadForm.module.css';

interface UploadFormValues { subjectId: string; file: FileList; }

export default function UploadForm() {
  const { register, handleSubmit, reset } = useForm<UploadFormValues>();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (data: UploadFormValues) => {
    try {
      setIsUploading(true);
      setMessage('Sedang memuat naik dan memproses dokumen (Embedding)...');
      const formData = new FormData();
      formData.append('file', data.file[0]);
      formData.append('subjectId', data.subjectId);

      const response = await fetch('/api/upload-document', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Gagal memproses fail');

      setMessage(`Berjaya! ${result.message}`);
      reset();
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Ralat: ${error.message}`);
      } else {
        setMessage('Berlaku ralat yang tidak diketahui.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Muat Naik Bahan Kursus</h2>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.formGroup}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Pilih Subjek</label>
          <select {...register('subjectId', { required: true })} className={styles.select}>
            <option value="">-- Sila Pilih --</option>
            <option value="4bab6b16-aca1-43c9-91a1-a1ddeeffe907">Subjek Ujian RAG</option>
          </select>
        </div>
        <div className={styles.fileArea}>
          <label className={styles.label}>Fail PDF</label>
          <input type="file" accept="application/pdf" {...register('file', { required: true })} className={styles.input} style={{ marginTop: '10px' }} />
        </div>
        <button type="submit" disabled={isUploading} className={styles.submitBtn}>
          {isUploading ? 'Memproses Vektor...' : 'Muat Naik & Analisis'}
        </button>
        {message && <p style={{ textAlign: 'center', marginTop: '10px', color: '#0f172a' }}>{message}</p>}
      </form>
    </div>
  );
}