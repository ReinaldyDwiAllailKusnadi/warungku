import { prisma } from "./prisma";
import { keTanggalJakarta } from "./format";

/**
 * lib/data.ts — semua pembacaan katalog untuk halaman.
 *
 * Dipisahkan dari halaman supaya bentuk datanya sama di mana pun ia
 * dipakai. Kalau tiap halaman menulis sendiri querynya, cepat atau
 * lambat ada satu halaman yang lupa menyaring menu yang tidak tersedia —
 * dan menu kosong tetap bisa dipesan dari halaman itu.
 */

export type MenuTampil = {
  id: string;
  nama: string;
  slug: string;
  keterangan: string | null;
  harga: number;
  pedas: number;
  tersedia: boolean;
};

export type KategoriTampil = {
  id: string;
  nama: string;
  menu: MenuTampil[];
};

/** Seluruh menu, dikelompokkan per kategori, terurut untuk ditampilkan. */
export async function katalog(): Promise<KategoriTampil[]> {
  const kategori = await prisma.kategori.findMany({
    orderBy: { urutan: "asc" },
    include: {
      menu: {
        orderBy: [{ urutan: "asc" }, { nama: "asc" }],
        select: {
          id: true,
          nama: true,
          slug: true,
          keterangan: true,
          harga: true,
          pedas: true,
          tersedia: true,
        },
      },
    },
  });

  // Kategori yang seluruh menunya kosong tidak perlu ditampilkan —
  // judul kategori tanpa isi hanya menambah tinggi halaman tanpa guna.
  return kategori
    .map((k) => ({ id: k.id, nama: k.nama, menu: k.menu }))
    .filter((k) => k.menu.length > 0);
}

export type PesananLengkap = Awaited<ReturnType<typeof pesananByNomor>>;

/** Satu pesanan lengkap dengan barang, tagihan, dan riwayatnya. */
export async function pesananByNomor(nomor: string) {
  return prisma.pesanan.findUnique({
    where: { nomor },
    include: {
      item: true,
      pembayaran: { orderBy: { dibuat: "desc" } },
      peristiwa: { orderBy: { waktu: "asc" } },
    },
  });
}

export async function pesananById(id: string) {
  return prisma.pesanan.findUnique({
    where: { id },
    include: {
      item: true,
      pembayaran: { orderBy: { dibuat: "desc" } },
      peristiwa: { orderBy: { waktu: "asc" } },
    },
  });
}

/** Tagihan untuk halaman pembayaran tiruan. */
export async function tagihanByReferensi(referensi: string) {
  return prisma.pembayaran.findUnique({
    where: { referensi },
    include: { pesanan: { include: { item: true } } },
  });
}

/** Daftar pesanan untuk panel, terbaru di atas. */
export async function daftarPesanan(batas = 40) {
  return prisma.pesanan.findMany({
    orderBy: { dibuat: "desc" },
    take: batas,
    include: { item: true },
  });
}

/**
 * Pesanan yang masih perlu dikerjakan dapur/kasir.
 *
 * KENAPA HANYA DIBAYAR / DIMASAK / SIAP — MENUNGGU_BAYAR TIDAK IKUT:
 *   Ini daftar kerja, bukan daftar pengawasan. Pesanan yang belum
 *   dibayar belum boleh dimasak (itu inti seluruh proyek ini), jadi
 *   menaruhnya di daftar kerja hanya menambah baris yang tidak bisa
 *   dikerjakan siapa pun. Yang belum dibayar tetap terlihat di hitungan
 *   ringkasan di atas daftar.
 *
 * Urutannya TUA LEBIH DULU menurut waktu pembayaran: itu urutan yang
 * adil untuk dapur — yang membayar lebih dulu, dimasak lebih dulu.
 * Kalau diurutkan menurut waktu pesanan dibuat, pesanan yang lama
 * menggantung tanpa dibayar akan terus menempel di atas.
 */
export async function daftarPesananAktif() {
  return prisma.pesanan.findMany({
    where: { status: { in: ["DIBAYAR", "DIMASAK", "SIAP"] } },
    orderBy: { dibayarPada: "asc" },
    include: { item: true },
  });
}

/**
 * Angka ringkas untuk panel petugas, khusus hari ini (zona Jakarta).
 *
 * KENAPA BATASNYA HARI JAKARTA, BUKAN 24 JAM TERAKHIR:
 *   Warung tutup malam dan buka pagi. "Pesanan hari ini" yang dihitung
 *   sebagai 24 jam terakhir akan mencampur pesanan tadi malam ke dalam
 *   hitungan pagi ini, dan angka yang dilihat kasir pagi tidak akan
 *   pernah cocok dengan yang dihitungnya sendiri.
 */
export async function ringkasanHariIni() {
  const mulaiHariIni = keTanggalJakarta(new Date());

  const semua = await prisma.pesanan.findMany({
    where: { dibuat: { gte: mulaiHariIni } },
    select: { status: true, total: true },
  });

  const belumBayar = semua.filter(
    (p) => p.status === "MENUNGGU_BAYAR",
  ).length;
  const lunas = semua.length - belumBayar;

  // "Uang masuk" hanya dari pesanan yang statusnya sudah lewat
  // pembayaran. Pesanan yang dibatalkan TIDAK dihitung, meskipun
  // nilainya pernah tercatat.
  const uangMasuk = semua
    .filter((p) => p.status !== "MENUNGGU_BAYAR" && p.status !== "DIBATALKAN")
    .reduce((a, p) => a + p.total, 0);

  return { jumlah: semua.length, lunas, belumBayar, uangMasuk };
}
