"use client";

import { useState } from "react";

export default function RagDashboard() {
  const [courseCode, setCourseCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim()) {
      setMessage({ type: "error", text: "Sila masukkan Kod Subjek (Contoh: CTU556)." });
      return;
    }
    if (!file) {
      setMessage({ type: "error", text: "Sila pilih fail PDF nota untuk dimuat naik." });
      return;
    }
    if (file.type !== "application/pdf") {
      setMessage({ type: "error", text: "Hanya format fail PDF dibenarkan untuk enjin RAG." });
      return;
    }

    setIsUploading(true);
    setMessage({ type: "info", text: `Sedang mengekstrak dan memproses vektor untuk fail ${file.name}... Sila tunggu.` });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject_id", courseCode.trim().toUpperCase());

    try {
      const res = await fetch("/api/upload-rag", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ralat tidak diketahui semasa memproses RAG.");
      }

      setMessage({ type: "success", text: data.message });
      setFile(null); 
      setCourseCode("");
      
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center font-sans">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        
        <div className="bg-[#4a154b] p-6 text-white">
          <h1 className="text-2xl font-bold">Pusat Kawalan Enjin RAG</h1>
          <p className="text-sm opacity-80 mt-1">
            Modul Pengekstrakan Nota & Pemvektoran Memori AI (ABQARI)
          </p>
        </div>

        <div className="p-8">
          {message && (
            <div className={`p-4 mb-6 rounded-md border ${
              message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : 
              message.type === "error" ? "bg-red-50 border-red-200 text-red-700" : 
              "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-6">
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Taip Kod Subjek (Contoh: CTU556)</label>
              <input 
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Masukkan Kod Subjek..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4a154b] focus:border-[#4a154b] outline-none transition-all"
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-2">Nota akan dikaitkan dengan kod subjek ini di pangkalan data vektor.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Muat Naik Nota (PDF Sahaja)</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
                <input 
                  type="file" 
                  id="file-upload"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  disabled={isUploading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || !courseCode || !file}
              className={`w-full py-4 rounded-lg font-bold text-white transition-all shadow-md ${
                isUploading || !courseCode || !file
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#4a154b] hover:bg-[#3d113d] hover:shadow-lg active:scale-[0.98]"
              }`}
            >
              {isUploading ? "Memproses RAG (Sila Tunggu)..." : "Ekstrak & Simpan Vektor RAG"}
            </button>
            
          </form>
        </div>

      </div>
    </div>
  );
}