/**
 * scripts/uji-uang.ts — menguji SELURUH aturan uang.
 *
 * Tanpa database, tanpa peramban, tanpa server. lib/menu.ts adalah
 * fungsi murni, jadi ujinya berjalan dalam sekejap dan bisa dijalankan
 * sesering apa pun.
 *
 * Yang paling penting di sini bukan pemeriksaan yang lulus, melainkan
 * yang HARUS DITOLAK: porsi nol, porsi pecahan, menu kembar, alamat
 * kosong untuk pesanan antar. Aturan yang tidak pernah menolak apa pun
 * sebenarnya bukan aturan.
 */
import {
  BIAYA_ANTAR,
  GRATIS_ANTAR_DI_ATAS,
  MAKS_JENIS,
  MAKS_PER_ITEM,
  MAKS_TOTAL_PORSI,
  MENIT_KEDALUWARSA,
  batasBayar,
  hitungBiayaAntar,
  hitungSemua,
  hitungSubtotal,
  hitungTotal,
  periksaKeranjang,
  periksaPemesan,
  sisaTagihan,
  sudahLewatBatas,
  type BarisLengkap,
  type Hasil,
} from "../lib/menu";

let lulus = 0;
let gagal = 0;

function sama(judul: string, dapat: unknown, harus: unknown) {
  const a = JSON.stringify(dapat);
  const b = JSON.stringify(harus);
  if (a === b) {
    lulus++;
    console.log(`  ok   ${judul}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${judul}\n         dapat: ${a}\n         harus: ${b}`);
  }
}

function baris(harga: number, jumlah: number): BarisLengkap {
  return { menuId: "m" + harga, jumlah, namaSaatItu: "Menu", hargaSaatItu: harga };
}

// --------------------------------------------------------------- subtotal
console.log("\n== Subtotal ==");
sama("keranjang kosong = 0", hitungSubtotal([]), 0);
sama(
  "harga x jumlah",
  hitungSubtotal([baris(15_000, 2), baris(8_000, 3)]),
  15_000 * 2 + 8_000 * 3,
);
sama(
  "harga besar tidak kehilangan presisi",
  hitungSubtotal([baris(1_234_567, 3)]),
  3_703_701,
);
sama("harga pecahan dibulatkan", hitungSubtotal([baris(2_500.4, 2)]), 5_001);

// ------------------------------------------------------------- ongkos antar
console.log("\n== Ongkos kirim ==");
sama("diambil sendiri = tidak ada ongkos", hitungBiayaAntar("DIAMBIL", 5_000), 0);
sama("diambil sendiri, belanja besar = tetap 0", hitungBiayaAntar("DIAMBIL", 500_000), 0);
sama("antar di bawah ambang = tarif tetap", hitungBiayaAntar("ANTAR", 20_000), BIAYA_ANTAR);
sama(
  "antar TEPAT di ambang = gratis",
  hitungBiayaAntar("ANTAR", GRATIS_ANTAR_DI_ATAS),
  0,
);
sama(
  "antar di atas ambang = gratis",
  hitungBiayaAntar("ANTAR", GRATIS_ANTAR_DI_ATAS + 1),
  0,
);
sama(
  "antar 1 rupiah di bawah ambang = tetap bayar",
  hitungBiayaAntar("ANTAR", GRATIS_ANTAR_DI_ATAS - 1),
  BIAYA_ANTAR,
);

// ------------------------------------------------------------------ total
console.log("\n== Total ==");
sama("total = subtotal + ongkos", hitungTotal(50_000, BIAYA_ANTAR), 58_000);
sama("total tanpa ongkos", hitungTotal(50_000, 0), 50_000);

const tiga = hitungSemua([baris(25_000, 4)], "ANTAR");
sama("rincian tiga angka sekaligus", tiga, {
  subtotal: 100_000,
  biayaAntar: 0,
  total: 100_000,
});

const kecil = hitungSemua([baris(10_000, 2)], "ANTAR");
sama("belanja kecil kena ongkos", kecil, {
  subtotal: 20_000,
  biayaAntar: 8_000,
  total: 28_000,
});

// -------------------------------------------------------------- sisa tagihan
console.log("\n== Sisa tagihan ==");
sama("belum dibayar", sisaTagihan(58_000, 0), 58_000);
sama("dibayar sebagian", sisaTagihan(58_000, 20_000), 38_000);
sama("dibayar penuh = 0", sisaTagihan(58_000, 58_000), 0);
// Lebih bayar tidak boleh jadi negatif: angka negatif di nota akan
// terbaca sebagai "kami berutang sekian" tanpa ada yang memutuskan begitu.
sama("lebih bayar tidak jadi negatif", sisaTagihan(58_000, 70_000), 0);

// -------------------------------------------------------- periksa keranjang
console.log("\n== Keranjang: yang HARUS DITOLAK ==");
sama("keranjang kosong", periksaKeranjang([]).ok, false);
sama("bukan larik", periksaKeranjang(null as never).ok, false);
sama("porsi 0", periksaKeranjang([{ menuId: "a", jumlah: 0 }]).ok, false);
sama("porsi negatif", periksaKeranjang([{ menuId: "a", jumlah: -3 }]).ok, false);
sama("porsi pecahan", periksaKeranjang([{ menuId: "a", jumlah: 1.5 }]).ok, false);
sama(
  `porsi di atas ${MAKS_PER_ITEM}`,
  periksaKeranjang([{ menuId: "a", jumlah: MAKS_PER_ITEM + 1 }]).ok,
  false,
);
sama(
  "menu kembar — batas per item tidak bisa dilewati dengan memecah baris",
  periksaKeranjang([
    { menuId: "a", jumlah: 20 },
    { menuId: "a", jumlah: 20 },
  ]).ok,
  false,
);
sama("menuId kosong", periksaKeranjang([{ menuId: "  ", jumlah: 1 }]).ok, false);
sama(
  `lebih dari ${MAKS_JENIS} jenis`,
  periksaKeranjang(
    Array.from({ length: MAKS_JENIS + 1 }, (_, i) => ({
      menuId: "m" + i,
      jumlah: 1,
    })),
  ).ok,
  false,
);
sama(
  `total porsi di atas ${MAKS_TOTAL_PORSI}`,
  periksaKeranjang(
    Array.from({ length: 4 }, (_, i) => ({
      menuId: "m" + i,
      jumlah: MAKS_PER_ITEM,
    })),
  ).ok,
  false,
);

console.log("\n== Keranjang: yang HARUS DITERIMA ==");
sama("satu baris wajar", periksaKeranjang([{ menuId: "a", jumlah: 2 }]).ok, true);
sama(
  "tepat di batas per item",
  periksaKeranjang([{ menuId: "a", jumlah: MAKS_PER_ITEM }]).ok,
  true,
);
sama(
  "tepat di batas total porsi",
  periksaKeranjang([
    { menuId: "a", jumlah: 20 },
    { menuId: "b", jumlah: 20 },
    { menuId: "c", jumlah: 10 },
  ]).ok,
  true,
);

// ----------------------------------------------------------- periksa pemesan
console.log("\n== Pemesan ==");
/**
 * Mengambil isi hasil HANYA kalau hasilnya berhasil.
 *
 * KENAPA TIDAK LANGSUNG ".data": tipe Hasil adalah gabungan
 * { ok: true, data } | { ok: false, galat }, dan cabang gagal tidak
 * punya .data. Menulis .data tanpa memeriksa lebih dulu berarti uji ini
 * sendiri yang akan meledak saat fungsinya menolak — padahal justru
 * penolakan itu yang sedang diuji.
 */
function dataDari<T>(h: Hasil<T>): T | undefined {
  return h.ok ? h.data : undefined;
}

const dasar = { tipe: "DIAMBIL" as const, alamat: null };

sama(
  "nama kosong ditolak",
  periksaPemesan({ ...dasar, nama: " ", telepon: "081234567890" }).ok,
  false,
);
sama(
  "telepon kosong ditolak",
  periksaPemesan({ ...dasar, nama: "Budi", telepon: "" }).ok,
  false,
);
sama(
  "telepon huruf ditolak",
  periksaPemesan({ ...dasar, nama: "Budi", telepon: "abcdefghij" }).ok,
  false,
);
sama(
  "telepon terlalu pendek ditolak",
  periksaPemesan({ ...dasar, nama: "Budi", telepon: "0812345" }).ok,
  false,
);
sama(
  "telepon wajar diterima",
  periksaPemesan({ ...dasar, nama: "Budi", telepon: "081234567890" }).ok,
  true,
);
sama(
  "awalan +62 diseragamkan jadi 0",
  dataDari(periksaPemesan({ ...dasar, nama: "Budi", telepon: "+6281234567890" }))
    ?.telepon,
  "081234567890",
);
sama(
  "spasi dan tanda hubung diabaikan",
  dataDari(periksaPemesan({ ...dasar, nama: "Budi", telepon: "0812-3456-7890" }))
    ?.telepon,
  "081234567890",
);

console.log("\n== Alamat: wajib untuk antar, tidak berlaku untuk diambil ==");
sama(
  "antar tanpa alamat DITOLAK",
  periksaPemesan({
    nama: "Budi",
    telepon: "081234567890",
    tipe: "ANTAR",
    alamat: "",
  }).ok,
  false,
);
sama(
  "antar dengan alamat terlalu pendek DITOLAK",
  periksaPemesan({
    nama: "Budi",
    telepon: "081234567890",
    tipe: "ANTAR",
    alamat: "Jl. A",
  }).ok,
  false,
);
sama(
  "antar dengan alamat wajar DITERIMA",
  periksaPemesan({
    nama: "Budi",
    telepon: "081234567890",
    tipe: "ANTAR",
    alamat: "Jl. Merdeka No. 12, RT 03 RW 05, Wonosobo",
  }).ok,
  true,
);
const ambilDenganAlamat = periksaPemesan({
  nama: "Budi",
  telepon: "081234567890",
  tipe: "DIAMBIL",
  alamat: "Jl. Merdeka No. 12, Wonosobo",
});
sama(
  "diambil: alamat diabaikan, tidak disimpan",
  dataDari(ambilDenganAlamat)?.alamat,
  null,
);

// -------------------------------------------------------------- kedaluwarsa
console.log("\n== Batas waktu bayar ==");
const dibuat = new Date("2026-09-25T10:00:00Z");
sama(
  `batas bayar = dibuat + ${MENIT_KEDALUWARSA} menit`,
  batasBayar(dibuat).toISOString(),
  new Date(dibuat.getTime() + MENIT_KEDALUWARSA * 60_000).toISOString(),
);
sama(
  "belum lewat",
  sudahLewatBatas(batasBayar(dibuat), new Date(dibuat.getTime() + 60_000)),
  false,
);
sama(
  "sudah lewat",
  sudahLewatBatas(batasBayar(dibuat), new Date(dibuat.getTime() + 31 * 60_000)),
  true,
);
// Tepat pada detik batas: belum dianggap lewat. Kalau ini dianggap
// lewat, pesanan yang dibayar tepat waktu bisa batal.
sama(
  "tepat pada batas = belum lewat",
  sudahLewatBatas(batasBayar(dibuat), batasBayar(dibuat)),
  false,
);

// ------------------------------------------------------------------ ringkas
console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
