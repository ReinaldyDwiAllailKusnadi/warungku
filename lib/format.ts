// Format tampilan: uang dan tanggal.
//
// KENAPA DIPISAH KE SINI, BUKAN DITULIS LANGSUNG DI KOMPONEN:
//   Angka uang muncul di banyak tempat (daftar paket, rincian pesanan,
//   kwitansi, laporan). Kalau tiap tempat menulis formatnya sendiri,
//   cepat atau lambat ada satu yang menulis "Rp1500000" sementara yang
//   lain "Rp 1.500.000" — dan itu terlihat seperti dua data berbeda.
//
//   Satu fungsi, satu hasil, di semua tempat.

const UANG = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  // Tanpa desimal: rupiah tidak memakai sen, dan ".00" hanya menambah
  // lebar tanpa memberi informasi.
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 1500000 -> "Rp 1.500.000" */
export function rupiah(nilai: number): string {
  return UANG.format(nilai);
}

const TANGGAL_PANJANG = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  // timeZone WAJIB disebut. Tanpa ini, tanggal disimpan sebagai tengah
  // malam UTC lalu ditampilkan di zona server — dan di server yang
  // zona waktunya UTC, tanggal 12 Oktober bisa tampil sebagai 11 Oktober.
  timeZone: "Asia/Jakarta",
});

const TANGGAL_PENDEK = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** "Senin, 12 Oktober 2026" */
export function tanggalPanjang(d: Date): string {
  return TANGGAL_PANJANG.format(d);
}

/** "12 Okt 2026" */
export function tanggalPendek(d: Date): string {
  return TANGGAL_PENDEK.format(d);
}

/**
 * Tanggal keberangkatan disimpan sebagai tengah malam UTC oleh Prisma
 * (tipe kolomnya timestamp tanpa zona). Fungsi ini mengubahnya jadi
 * tengah malam Jakarta supaya tanggalnya tidak bergeser sehari saat
 * ditampilkan.
 */
export function keTanggalJakarta(d: Date): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return new Date(`${s}T00:00:00+07:00`);
}
