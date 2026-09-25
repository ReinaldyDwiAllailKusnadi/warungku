/**
 * lib/menu.ts — SELURUH aturan yang menyangkut UANG pada pesanan.
 *
 * KENAPA SEMUANYA DI SATU BERKAS, DAN KENAPA FUNGSINYA MURNI:
 *   Berkas ini tidak menyentuh database sama sekali. Semua fungsinya
 *   hanya menerima angka dan mengembalikan angka. Dua akibatnya:
 *
 *   1. Aturannya bisa diuji dalam sekejap tanpa menyalakan database dan
 *      tanpa membuka peramban (lihat scripts/uji-uang.ts).
 *   2. Fungsi yang sama bisa dipakai peramban untuk menampilkan
 *      perkiraan DAN dipakai server saat menyimpan. Kalau keduanya
 *      memakai rumus sendiri-sendiri, cepat atau lambat angkanya berbeda
 *      — dan pelanggan melihat angka yang berbeda dari yang ditagih.
 *
 *   Yang TIDAK boleh dilakukan peramban: mengirim harga. Keranjang yang
 *   dikirim peramban hanya berisi "menu apa" dan "berapa banyak". Harga
 *   selalu diambil server dari tabel menu.
 */

/** Batas jumlah porsi untuk satu jenis menu dalam satu pesanan. */
export const MAKS_PER_ITEM = 20;

/** Batas jumlah jenis menu berbeda dalam satu pesanan. */
export const MAKS_JENIS = 20;

/** Batas total porsi dalam satu pesanan. */
export const MAKS_TOTAL_PORSI = 50;

/** Ongkos kirim tetap untuk pesanan ANTAR. */
export const BIAYA_ANTAR = 8_000;

/**
 * Di atas nilai ini ongkos kirimnya gratis.
 *
 * KENAPA AMBANGNYA DI ANGKA SUBTOTAL, BUKAN TOTAL:
 *   Kalau dihitung dari total, nilainya bergantung pada biaya antar —
 *   dan biaya antar bergantung pada subtotal. Lingkaran seperti itu
 *   mudah sekali jadi perhitungan yang berputar tanpa henti atau
 *   menghasilkan angka yang berubah-ubah. Ambang dari subtotal memutus
 *   lingkaran itu: subtotal ditentukan lebih dulu, biaya menyusul.
 */
export const GRATIS_ANTAR_DI_ATAS = 100_000;

/** Lama pesanan menunggu pembayaran sebelum dibatalkan sendiri (menit). */
export const MENIT_KEDALUWARSA = 30;

export type TipePesan = "DIAMBIL" | "ANTAR";

/** Satu baris keranjang seperti yang dikirim peramban. TANPA HARGA. */
export type BarisKeranjang = {
  menuId: string;
  jumlah: number;
  catatan?: string;
};

/** Satu baris keranjang yang sudah dilengkapi harga oleh server. */
export type BarisLengkap = BarisKeranjang & {
  namaSaatItu: string;
  hargaSaatItu: number;
};

export type Hasil<T> =
  | { ok: true; data: T }
  | { ok: false; galat: string };

// ------------------------------------------------------------------ angka

/**
 * Membulatkan ke rupiah penuh.
 *
 * Rupiah tidak punya pecahan di bawah 1, dan setiap pembulatan adalah
 * tempat selisih bersembunyi. Karena itu pembulatan dilakukan di SATU
 * fungsi ini saja, bukan tersebar di beberapa tempat.
 */
export function bulatkanRupiah(n: number): number {
  return Math.round(n);
}

/** Jumlahkan harga baris menjadi subtotal. */
export function hitungSubtotal(baris: BarisLengkap[]): number {
  return bulatkanRupiah(
    baris.reduce((a, b) => a + b.hargaSaatItu * b.jumlah, 0),
  );
}

/**
 * Ongkos kirim.
 *
 * Pesanan DIAMBIL selalu 0 — pelanggan datang sendiri. Pesanan ANTAR
 * dikenakan tarif tetap, kecuali subtotalnya sudah melewati ambang.
 */
export function hitungBiayaAntar(tipe: TipePesan, subtotal: number): number {
  if (tipe === "DIAMBIL") return 0;
  if (subtotal >= GRATIS_ANTAR_DI_ATAS) return 0;
  return BIAYA_ANTAR;
}

/**
 * Total yang ditagih.
 *
 * Dihitung dari subtotal + biaya antar, dan TIDAK PERNAH dari angka yang
 * dikirim siapa pun. Inilah angka yang diserahkan ke penyedia pembayaran
 * dan yang nanti harus cocok dengan nominal di webhook.
 */
export function hitungTotal(subtotal: number, biayaAntar: number): number {
  return bulatkanRupiah(subtotal + biayaAntar);
}

/** Susun ketiga angka sekaligus dari baris yang sudah lengkap. */
export function hitungSemua(
  baris: BarisLengkap[],
  tipe: TipePesan,
): { subtotal: number; biayaAntar: number; total: number } {
  const subtotal = hitungSubtotal(baris);
  const biayaAntar = hitungBiayaAntar(tipe, subtotal);
  return { subtotal, biayaAntar, total: hitungTotal(subtotal, biayaAntar) };
}

/** Berapa yang masih harus dibayar — dipakai halaman status. */
export function sisaTagihan(total: number, sudahDibayar: number): number {
  return Math.max(0, bulatkanRupiah(total - sudahDibayar));
}

// ------------------------------------------------------------------ periksa

/**
 * Memeriksa keranjang yang datang dari peramban.
 *
 * Yang diperiksa di sini hanya BENTUKNYA (jumlah porsi, jumlah jenis,
 * menu ganda). Apakah menunya benar-benar ada dan harganya berapa
 * diperiksa server saat mengambil data dari database — dan itu memang
 * harus begitu, karena peramban tidak boleh dipercaya soal harga.
 */
export function periksaKeranjang(
  mentah: BarisKeranjang[],
): Hasil<BarisKeranjang[]> {
  if (!Array.isArray(mentah) || mentah.length === 0) {
    return { ok: false, galat: "Keranjang masih kosong." };
  }
  if (mentah.length > MAKS_JENIS) {
    return {
      ok: false,
      galat: `Satu pesanan paling banyak ${MAKS_JENIS} jenis menu.`,
    };
  }

  const terlihat = new Set<string>();
  let totalPorSi = 0;

  for (const b of mentah) {
    if (!b || typeof b.menuId !== "string" || b.menuId.trim() === "") {
      return { ok: false, galat: "Ada baris pesanan yang tidak dikenali." };
    }
    // Menu yang sama dikirim dua kali akan terlihat seperti dua baris,
    // padahal maksudnya satu baris dengan jumlah dua kali lipat. Kalau
    // dibiarkan, batas MAKS_PER_ITEM bisa dilewati hanya dengan memecah
    // satu pesanan besar menjadi beberapa baris kecil.
    if (terlihat.has(b.menuId)) {
      return { ok: false, galat: "Ada menu yang tercatat dua kali." };
    }
    terlihat.add(b.menuId);

    if (!Number.isInteger(b.jumlah) || b.jumlah < 1) {
      return { ok: false, galat: "Jumlah porsi harus bilangan bulat minimal 1." };
    }
    if (b.jumlah > MAKS_PER_ITEM) {
      return {
        ok: false,
        galat: `Satu menu paling banyak ${MAKS_PER_ITEM} porsi.`,
      };
    }
    totalPorSi += b.jumlah;
  }

  if (totalPorSi > MAKS_TOTAL_PORSI) {
    return {
      ok: false,
      galat: `Satu pesanan paling banyak ${MAKS_TOTAL_PORSI} porsi.`,
    };
  }

  return { ok: true, data: mentah };
}

/**
 * Memeriksa isian pemesan.
 *
 * Alamat WAJIB untuk pesanan ANTAR dan TIDAK BERLAKU untuk pesanan
 * DIAMBIL. Kalau alamat hanya "disarankan", cepat atau lambat akan ada
 * pesanan antar tanpa alamat — dan kurirnya hanya bisa menebak.
 */
export function periksaPemesan(m: {
  nama: string;
  telepon: string;
  tipe: TipePesan;
  alamat?: string | null;
}): Hasil<{ nama: string; telepon: string; alamat: string | null }> {
  const nama = (m.nama ?? "").trim();
  const telepon = (m.telepon ?? "").trim();
  const alamat = (m.alamat ?? "").trim();

  if (nama.length < 2) return { ok: false, galat: "Nama pemesan belum diisi." };
  if (nama.length > 60) return { ok: false, galat: "Nama pemesan terlalu panjang." };

  // Nomor Indonesia: 10-15 angka setelah tanda + dibuang. Ditulis
  // permisif terhadap spasi, tanda hubung, dan awalan +62.
  const angka = telepon.replace(/[\s-]/g, "").replace(/^\+?62/, "0");
  if (!/^0\d{9,13}$/.test(angka)) {
    return { ok: false, galat: "Nomor WhatsApp belum benar." };
  }

  if (m.tipe === "ANTAR") {
    if (alamat.length < 10) {
      return {
        ok: false,
        galat: "Alamat pengantaran belum lengkap — tulis minimal jalan dan nomor.",
      };
    }
    if (alamat.length > 300) {
      return { ok: false, galat: "Alamat pengantaran terlalu panjang." };
    }
  }

  return {
    ok: true,
    data: { nama, telepon: angka, alamat: m.tipe === "ANTAR" ? alamat : null },
  };
}

/** Batas waktu pembayaran dihitung dari waktu pesanan dibuat. */
export function batasBayar(dibuat: Date): Date {
  return new Date(dibuat.getTime() + MENIT_KEDALUWARSA * 60_000);
}

/** Sudah lewat batas bayar? Dibandingkan sebagai waktu, bukan tanggal. */
export function sudahLewatBatas(kedaluwarsa: Date, sekarang: Date): boolean {
  return sekarang.getTime() > kedaluwarsa.getTime();
}
