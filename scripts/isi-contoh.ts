/**
 * scripts/isi-contoh.ts — data contoh Warungku.
 *
 * Aman dijalankan berkali-kali: setiap baris ditulis dengan pola
 * "ubah kalau sudah ada, buat kalau belum" berdasarkan slug/email yang
 * unik. Tanpa itu, menjalankan skrip ini dua kali menghasilkan menu
 * kembar — dan menu kembar di layar pemesanan terlihat seperti dua
 * hidangan berbeda yang kebetulan berharga sama.
 */
import { prisma } from "../lib/prisma";
import { hashKataSandi } from "../lib/sandi";

type BarisMenu = {
  nama: string;
  slug: string;
  harga: number;
  keterangan?: string;
  pedas?: number;
  tersedia?: boolean;
};

const KATALOG: { kategori: string; urutan: number; isi: BarisMenu[] }[] = [
  {
    kategori: "Makanan",
    urutan: 1,
    isi: [
      { nama: "Nasi Goreng Spesial", slug: "nasi-goreng-spesial", harga: 25_000, keterangan: "Telur, ayam, dan kerupuk. Bisa tanpa pedas.", pedas: 1 },
      { nama: "Mie Goreng Jawa", slug: "mie-goreng-jawa", harga: 22_000, keterangan: "Bawang goreng dan telur ceplok.", pedas: 0 },
      { nama: "Ayam Bakar Madu", slug: "ayam-bakar-madu", harga: 32_000, keterangan: "Paha bawah, dibakar arang.", pedas: 1 },
      { nama: "Sate Ayam 10 Tusuk", slug: "sate-ayam", harga: 28_000, keterangan: "Bumbu kacang atau kecap.", pedas: 0 },
      { nama: "Gado-Gado", slug: "gado-gado", harga: 20_000, keterangan: "Sayur rebus, lontong, bumbu kacang.", pedas: 1 },
      { nama: "Soto Ayam Lamongan", slug: "soto-ayam-lamongan", harga: 21_000, keterangan: "Kuah kuning, koya, dan soun.", pedas: 0 },
      { nama: "Nasi Rames Komplit", slug: "nasi-rames-komplit", harga: 23_000, keterangan: "Nasi, tiga lauk, dan sayur.", pedas: 0 },
      { nama: "Ikan Nila Goreng", slug: "ikan-nila-goreng", harga: 30_000, keterangan: "Digoreng kering, sambal terpisah.", pedas: 2 },
    ],
  },
  {
    kategori: "Minuman",
    urutan: 2,
    isi: [
      { nama: "Es Teh Manis", slug: "es-teh-manis", harga: 5_000 },
      { nama: "Teh Hangat", slug: "teh-hangat", harga: 4_000 },
      { nama: "Es Jeruk Peras", slug: "es-jeruk-peras", harga: 8_000, keterangan: "Jeruk peras, bukan serbuk." },
      { nama: "Kopi Hitam", slug: "kopi-hitam", harga: 6_000 },
      { nama: "Kopi Susu Gula Aren", slug: "kopi-susu-gula-aren", harga: 12_000 },
      { nama: "Es Kelapa Muda", slug: "es-kelapa-muda", harga: 10_000 },
      { nama: "Air Mineral", slug: "air-mineral", harga: 4_000 },
    ],
  },
  {
    kategori: "Camilan",
    urutan: 3,
    isi: [
      { nama: "Tahu Isi (5 buah)", slug: "tahu-isi", harga: 10_000, pedas: 1 },
      { nama: "Pisang Goreng (5 buah)", slug: "pisang-goreng", harga: 10_000 },
      { nama: "Tempe Mendoan (5 buah)", slug: "tempe-mendoan", harga: 10_000 },
      { nama: "Kerupuk", slug: "kerupuk", harga: 3_000 },
      // Sengaja ada satu menu yang sedang tidak tersedia, supaya jalur
      // penolakannya benar-benar terpakai dan bukan cuma ada di kode.
      { nama: "Sayur Lodeh", slug: "sayur-lodeh", harga: 8_000, tersedia: false, keterangan: "Sedang kosong." },
    ],
  },
  {
    kategori: "Paket",
    urutan: 4,
    isi: [
      { nama: "Paket Hemat", slug: "paket-hemat", harga: 28_000, keterangan: "Nasi goreng spesial + es teh manis." },
      { nama: "Paket Berdua", slug: "paket-berdua", harga: 45_000, keterangan: "Ayam bakar madu, tahu isi, dan dua es teh manis." },
      { nama: "Paket Rame-rame", slug: "paket-rame-rame", harga: 95_000, keterangan: "Untuk 4 orang: nasi rames komplit, sate ayam, tempe mendoan, dan empat minuman." },
    ],
  },
];

const PETUGAS = [
  { email: "kasir@warungku.test", nama: "Kasir Warung", peran: "KASIR" as const },
  { email: "dapur@warungku.test", nama: "Petugas Dapur", peran: "DAPUR" as const },
];

// Kata sandi akun uji. Hanya untuk pengembangan — akun ini ada di dalam
// repo publik, jadi WAJIB dihapus sebelum dipakai sungguhan.
const SANDI_UJI = "rahasiauji123";

async function utama() {
  let nKategori = 0;
  let nMenu = 0;

  for (const k of KATALOG) {
    const kategori = await prisma.kategori.upsert({
      where: { id: `kat-${k.urutan}` },
      update: { nama: k.kategori, urutan: k.urutan },
      create: { id: `kat-${k.urutan}`, nama: k.kategori, urutan: k.urutan },
    });
    nKategori++;

    let urut = 0;
    for (const m of k.isi) {
      await prisma.menu.upsert({
        where: { slug: m.slug },
        update: {
          nama: m.nama,
          harga: m.harga,
          keterangan: m.keterangan ?? null,
          pedas: m.pedas ?? 0,
          tersedia: m.tersedia ?? true,
          kategoriId: kategori.id,
          urutan: urut++,
        },
        create: {
          nama: m.nama,
          slug: m.slug,
          harga: m.harga,
          keterangan: m.keterangan ?? null,
          pedas: m.pedas ?? 0,
          tersedia: m.tersedia ?? true,
          kategoriId: kategori.id,
          urutan: urut++,
        },
      });
      nMenu++;
    }
  }

  const sandiHash = await hashKataSandi(SANDI_UJI);
  for (const p of PETUGAS) {
    await prisma.pengguna.upsert({
      where: { email: p.email },
      update: { nama: p.nama, peran: p.peran, aktif: true },
      create: { email: p.email, nama: p.nama, peran: p.peran, sandiHash },
    });
  }

  const menu = await prisma.menu.groupBy({
    by: ["kategoriId"],
    _count: { _all: true },
  });
  console.log(`Kategori : ${nKategori}`);
  console.log(`Menu     : ${nMenu} (${menu.length} kategori terisi)`);
  console.log(`Petugas  : ${PETUGAS.length} — ${PETUGAS.map((p) => p.email).join(", ")}`);
  console.log(`Menu tidak tersedia: ${await prisma.menu.count({ where: { tersedia: false } })}`);
  await prisma.$disconnect();
}

utama().catch((e) => {
  console.error(e);
  process.exit(1);
});
