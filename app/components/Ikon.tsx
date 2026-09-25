/**
 * Ikon.tsx — satu set ikon garis, satu gaya, khusus Warungku.
 *
 * Dipangkas dari set proyek sebelumnya: ikon khas wisata (pesawat,
 * pantai, tiket, peta) dibuang karena tidak dipakai di sini. Set ikon
 * yang menyimpan gambar yang tidak pernah muncul bukan sekadar tidak
 * rapi — komentarnya menyebut hal yang tidak ada hubungannya, dan
 * orang yang membacanya menyangka bagian itu masih terpakai.
 *
 * KENAPA TIDAK EMOJI:
 *   Emoji digambar oleh font sistem, jadi tampilannya beda-beda di tiap
 *   perangkat (Windows, Android, iOS, Linux semuanya beda), ukurannya tidak
 *   bisa disejajarkan dengan teks, dan warnanya tidak bisa diwarisi.
 *   Akibatnya baris menu terlihat berantakan tanpa alasan yang jelas.
 *
 *   Ikon di bawah ini semuanya:
 *     - viewBox 24x24, ketebalan garis 1.75, ujung membulat
 *     - memakai `currentColor`, jadi otomatis ikut warna teks di sekitarnya
 *     - `aria-hidden` karena teks di sebelahnya sudah menjelaskan maksudnya;
 *       pembaca layar tidak perlu mendengar "gambar ikon tiket".
 *
 * Komponen ini server component: tidak ada state, tidak perlu "use client".
 */

type Props = {
  nama: NamaIkon;
  ukuran?: number;
  className?: string;
};

export type NamaIkon =
  | "kalender"
  | "orang"
  | "centang"
  | "jam"
  | "panah"
  | "kiri"
  | "masuk"
  | "keluar"
  | "info"
  | "daftar"
  | "uang"
  | "telepon"
  | "cari"
  | "meja"
  | "dokumen"
  | "silang"
  // --- Ikon khusus Warungku ---
  | "mangkuk"
  | "gelas"
  | "kotak"
  | "nota";

const JALUR: Record<NamaIkon, React.ReactNode> = {
  // Kalender — tanggal
  kalender: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  orang: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  centang: <path d="m5 13 4.5 4.5L19 7" />,
  jam: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  panah: <path d="M5 12h14m-6-6 6 6-6 6" />,
  // Kiri — arah mundur, dipakai tombol "Sebelumnya" di paginasi.
  // Digambar sebagai panah utuh, bukan panah "panah" yang dicerminkan
  // dengan CSS: transformasi cermin juga membalik bayangan fokus dan
  // arah animasi, dan itu jenis kejutan yang tidak perlu.
  kiri: <path d="M19 12H5m6-6-6 6 6 6" />,
  masuk: (
    <>
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  keluar: (
    <>
      <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  daftar: (
    <>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  // Uang kertas — pembayaran
  uang: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  telepon: (
    <path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  cari: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  // Meja — panel petugas
  meja: (
    <>
      <path d="M3 10h18" />
      <path d="M4 10v9M20 10v9" />
      <path d="M12 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path d="M7.5 10a4.5 4.5 0 0 1 9 0" />
    </>
  ),
  dokumen: (
    <>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  silang: <path d="M6 6l12 12M18 6 6 18" />,

  // ---------------------------------------------------------------
  // Ikon khusus Warungku. Semuanya viewBox 24x24 dan ketebalan 1.75,
  // sama seperti yang lain — set ikon dengan ketebalan garis yang
  // berbeda-beda terlihat seperti gabungan dua set, bukan satu.
  // ---------------------------------------------------------------

  // Mangkuk mengepul — kategori makanan
  mangkuk: (
    <>
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" />
      <path d="M2.5 11.5h19" />
      <path d="M9.5 8c0-1.3 1.3-1.7 1.3-3M14 8.2c0-1.3 1.3-1.7 1.3-3" />
    </>
  ),
  // Gelas tinggi — kategori minuman
  gelas: (
    <>
      <path d="M7 3h10l-1.1 17.2a1 1 0 0 1-1 .8h-5.8a1 1 0 0 1-1-.8L7 3Z" />
      <path d="M7.5 9h9" />
    </>
  ),
  // Kotak berisi — paket hemat
  kotak: (
    <>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
    </>
  ),
  // Nota berobek — daftar pesanan
  nota: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
};

export function Ikon({ nama, ukuran = 20, className }: Props) {
  return (
    <svg
      className={className}
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {JALUR[nama]}
    </svg>
  );
}
