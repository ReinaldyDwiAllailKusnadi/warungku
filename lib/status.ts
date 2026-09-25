/**
 * lib/status.ts — mesin status pesanan.
 *
 * Fungsi murni, tanpa database, tanpa Prisma. Dua sebabnya:
 *   1. Bisa diuji tanpa menyalakan apa pun (scripts/uji-webhook.ts).
 *   2. Komponen klien boleh mengimpornya untuk menampilkan langkah mana
 *      yang sudah lewat — sedangkan berkas yang menyentuh Prisma tidak
 *      boleh diimpor komponen klien, karena Prisma ikut terbawa ke
 *      peramban.
 *
 * KENAPA PERPINDAHANNYA DIBATASI, BUKAN "SIAPA SAJA BOLEH MENGUBAH
 * SELAMA DIA PETUGAS":
 *   Kalau status boleh diubah bebas, cepat atau lambat ada pesanan yang
 *   melompat dari "menunggu bayar" langsung ke "siap" — dan dapurnya
 *   memasak makanan yang belum dibayar. Membatasi perpindahan yang sah
 *   berarti kesalahan itu tidak bisa terjadi lewat antarmuka, bukan
 *   sekadar "sebaiknya jangan".
 */

export type StatusPesanan =
  | "MENUNGGU_BAYAR"
  | "DIBAYAR"
  | "DIMASAK"
  | "SIAP"
  | "SELESAI"
  | "DIBATALKAN";

/** Urutan tampilan di panel, bukan urutan perpindahan yang sah. */
export const URUTAN_STATUS: StatusPesanan[] = [
  "MENUNGGU_BAYAR",
  "DIBAYAR",
  "DIMASAK",
  "SIAP",
  "SELESAI",
];

export const LABEL_STATUS: Record<StatusPesanan, string> = {
  MENUNGGU_BAYAR: "Menunggu bayar",
  DIBAYAR: "Sudah dibayar",
  DIMASAK: "Sedang dimasak",
  SIAP: "Siap",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

/**
 * Peta perpindahan yang SAH.
 *
 * Perhatikan dua hal yang sengaja TIDAK ada di sini:
 *
 *   MENUNGGU_BAYAR tidak bisa langsung ke DIMASAK/SIAP.
 *     Uang harus masuk lebih dulu. Ini satu-satunya alasan seluruh
 *     proyek ini ada.
 *
 *   DIBAYAR tidak bisa ke DIBATALKAN.
 *     Membatalkan pesanan yang sudah dibayar berarti kita berutang
 *     pengembalian uang — dan proyek ini belum punya cara mengembalikan
 *     uang. Membiarkannya ada berarti menyediakan tombol yang ujungnya
 *     membuat catatan keuangan tidak seimbang. Yang belum bisa
 *     ditangani sebaiknya tidak disediakan tombolnya.
 */
const PINDAH_SAH: Record<StatusPesanan, StatusPesanan[]> = {
  MENUNGGU_BAYAR: ["DIBAYAR", "DIBATALKAN"],
  DIBAYAR: ["DIMASAK"],
  DIMASAK: ["SIAP"],
  SIAP: ["SELESAI"],
  SELESAI: [],
  DIBATALKAN: [],
};

/** Boleh pindah dari `dari` ke `ke`? */
export function bolehPindah(dari: StatusPesanan, ke: StatusPesanan): boolean {
  return PINDAH_SAH[dari]?.includes(ke) ?? false;
}

/** Daftar perpindahan yang mungkin dari sebuah status. */
export function langkahBerikutnya(dari: StatusPesanan): StatusPesanan[] {
  return PINDAH_SAH[dari] ?? [];
}

/** Status akhir — tidak bisa berpindah lagi. */
export function sudahBerakhir(s: StatusPesanan): boolean {
  return s === "SELESAI" || s === "DIBATALKAN";
}

/**
 * Pesanan ini sedang berjalan (belum selesai dan belum batal).
 * Dipakai dapur untuk memutuskan apa yang masih perlu dikerjakan.
 */
export function sedangBerjalan(s: StatusPesanan): boolean {
  return s === "DIBAYAR" || s === "DIMASAK" || s === "SIAP";
}

/** Lencana warna di panel, memakai kelas yang sudah ada di globals.css. */
export function kelasStatus(s: StatusPesanan): string {
  switch (s) {
    case "MENUNGGU_BAYAR":
      return "lencana lencana--menunggu";
    case "DIBAYAR":
      return "lencana lencana--dilayani";
    case "DIMASAK":
      return "lencana lencana--dipanggil";
    case "SIAP":
      return "lencana lencana--prioritas";
    case "SELESAI":
      return "lencana lencana--selesai";
    case "DIBATALKAN":
      return "lencana lencana--batal";
  }
}

/* ==================================================================
   Peran petugas
   ================================================================== */

export type PeranPetugas = "KASIR" | "DAPUR";

/**
 * Perpindahan mana yang boleh dijalankan peran mana.
 *
 * Kunci "DARI>KE" dan nilainya daftar peran yang boleh.
 *
 * DUA BARIS YANG PALING PENTING DI SINI:
 *
 *   "MENUNGGU_BAYAR>DIBAYAR": []
 *     KOSONG, dan itu disengaja. Status "sudah dibayar" hanya boleh
 *     lahir dari pemberitahuan penyedia pembayaran yang tanda tangannya
 *     sah — tidak dari tombol siapa pun, termasuk pemilik warung.
 *     Kalau ada satu saja tombol yang bisa menandai pesanan lunas tanpa
 *     uang masuk, seluruh pencatatan uang di sini tidak lagi bisa
 *     dipercaya. Melunasi pesanan secara manual adalah hal yang nyata
 *     dibutuhkan di warung sungguhan, tapi tempatnya adalah fitur
 *     tersendiri yang tercatat — bukan perpindahan status biasa.
 *
 *   "SIAP>SELESAI": hanya KASIR
 *     Dapur menandai makanannya siap; menyerahkan ke pelanggan dan
 *     menutup pesanannya adalah urusan kasir, karena di situlah uang
 *     dan sisa pesanan dicocokkan.
 */
const PERAN_BOLEH: Record<string, PeranPetugas[]> = {
  "DIBAYAR>DIMASAK": ["KASIR", "DAPUR"],
  "DIMASAK>SIAP": ["KASIR", "DAPUR"],
  "SIAP>SELESAI": ["KASIR"],
  "MENUNGGU_BAYAR>DIBATALKAN": ["KASIR"],
  "MENUNGGU_BAYAR>DIBAYAR": [],
};

/** Boleh tidak peran ini menjalankan perpindahan `dari` → `ke`? */
export function bolehJalankan(
  peran: string,
  dari: StatusPesanan,
  ke: StatusPesanan,
): boolean {
  // Perpindahan yang tidak sah ditolak lebih dulu, apa pun perannya.
  if (!bolehPindah(dari, ke)) return false;
  const diizinkan = PERAN_BOLEH[`${dari}>${ke}`];
  // Perpindahan sah yang tidak terdaftar di atas = tidak ada yang boleh
  // menjalankannya lewat antarmuka (mis. MENUNGGU_BAYAR → DIBAYAR).
  if (!diizinkan) return false;
  return diizinkan.includes(peran as PeranPetugas);
}

