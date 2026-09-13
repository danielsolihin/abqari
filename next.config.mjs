/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mengecualikan pdf-parse daripada proses bundling Next.js/Turbopack
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;