/** @type {import('next').NextConfig} */
const nextConfig = {
  //buang
  // output: 'export',
  
  // Memaksa Vercel untuk memuatkan modul backend/Node.js yang berat seperti pdf-parse
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;