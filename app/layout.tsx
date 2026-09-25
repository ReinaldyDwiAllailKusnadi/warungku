import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * KENAPA HURUFNYA DIPILIH, BUKAN DISERAHKAN KE PERAMBAN:
 *   Tanpa nama huruf di CSS, setiap peramban memakai huruf bawaannya
 *   masing-masing. Lebar teks, tinggi baris, dan bentuk hurufnya jadi
 *   berbeda di tiap perangkat — halaman yang sama terlihat berbeda
 *   tergantung siapa yang membukanya.
 *
 *   Ini pelajaran yang sudah dibayar di proyek sebelumnya, jadi pola
 *   yang sama dipakai di sini sejak awal, bukan diperbaiki belakangan.
 */
const hurufUtama = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-utama",
});

export const metadata: Metadata = {
  title: {
    default: "Warungku — pesan makanan, bayar daring",
    template: "%s — Warungku",
  },
  description:
    "Warung makan dengan pemesanan daring: pilih menu, bayar, lalu ambil di warung atau minta diantar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={hurufUtama.variable}>
      <body>{children}</body>
    </html>
  );
}
