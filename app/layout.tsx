import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AutoLogout from "./components/AutoLogout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ABQARI - UiTM Exam Generator",
  description: "Sistem Pintar Penggubalan Kertas Peperiksaan UiTM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Komponen Pengesan Log Keluar Automatik (25 Minit) */}
        <AutoLogout />
        
        {children}
      </body>
    </html>
  );
}