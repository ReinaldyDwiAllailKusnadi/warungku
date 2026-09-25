"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SegarkanOtomatis.tsx — menyegarkan halaman status tanpa diminta.
 *
 * KENAPA PERLU:
 *   Status pesanan berubah karena kejadian yang terjadi di LUAR halaman
 *   ini — pemberitahuan dari penyedia pembayaran. Kalau pelanggan sudah
 *   membuka halaman bayar di tab lain lalu kembali ke sini, halaman ini
 *   masih menampilkan "menunggu pembayaran" sampai ia menekan muat
 *   ulang. Orang yang sudah membayar lalu masih melihat tulisan
 *   "menunggu pembayaran" akan mengira uangnya hilang, dan itu yang
 *   paling sering membuat mereka menelepon warung.
 *
 * KENAPA MENANYAKAN ULANG BERKALA, BUKAN SAMBUNGAN DUA ARAH:
 *   Sambungan dua arah (WebSocket) memang lebih hemat, tapi menambah
 *   satu lapisan yang harus dijaga hidup — dan di VPS sekecil ini
 *   lapisan itu harus diurus sendiri. Untuk satu perubahan status yang
 *   dinanti sebentar, menanyakan ulang setiap beberapa detik jauh lebih
 *   sederhana dan tidak lebih boros dari yang dibayangkan.
 *
 * Berhenti sendiri setelah batas waktu: halaman yang dibiarkan terbuka
 * semalaman tidak boleh terus-menerus menanyakan server.
 */
export function SegarkanOtomatis({
  selangDetik = 5,
  batasDetik = 600,
}: {
  selangDetik?: number;
  batasDetik?: number;
}) {
  const router = useRouter();
  const [habis, setHabis] = useState(false);

  useEffect(() => {
    const mulai = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - mulai > batasDetik * 1000) {
        clearInterval(timer);
        setHabis(true);
        return;
      }
      router.refresh();
    }, selangDetik * 1000);
    return () => clearInterval(timer);
  }, [router, selangDetik, batasDetik]);

  return (
    <p className="penyegar" aria-live="polite">
      {habis
        ? "Penyegaran otomatis berhenti. Muat ulang halaman untuk melihat status terbaru."
        : "Halaman ini menyegar sendiri setiap beberapa detik selama pembayaran belum dikonfirmasi."}
    </p>
  );
}
