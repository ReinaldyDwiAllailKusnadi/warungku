import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Batas ukuran untuk server action.
  //
  // Yang dikirim formulir di sini hanya nama, nomor telepon, alamat, dan
  // daftar { menuId, jumlah } — TIDAK ada harga dan tidak ada berkas.
  // Batasnya sengaja kecil supaya permintaan raksasa ditolak lebih awal,
  // bukan setelah diuraikan.
  experimental: {
    serverActions: {
      bodySizeLimit: "256kb",
    },
    // VPS ini 1 vCPU dan 961 MB, dan sudah menjalankan beberapa aplikasi.
    // Tanpa dua setelan ini `next build` menjalankan beberapa pekerja
    // sekaligus dan pernah MATI karena kehabisan memori (SIGABRT) —
    // galatnya tidak menyebut memori sama sekali, hanya "build worker
    // exited with code: null and signal: SIGABRT". Satu pekerja membuat
    // build lebih lambat tapi selesai.
    cpus: 1,
    workerThreads: false,
  },
  // Jangan tampilkan "X-Powered-By: Next.js" — mengurangi informasi
  // yang bisa dipakai penyerang untuk menebak versi.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
