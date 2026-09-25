/**
 * scripts/_bersih.ts — menghapus SEMUA data uji Warungku.
 *
 * Kapan dipakai: sebelum serah terima / sebelum push, supaya yang diting
 * gal di database hanya data contoh dari isi-contoh.ts, bukan pesanan
 * percobaan.
 *
 * Urutan penghapusannya mengikuti ketergantungan (anak dulu, induk
 * kemudian). Penghitung nomor sengaja TIDAK direset — nomor pesanan
 * tidak boleh dipakai dua kali, bahkan nomor yang pesanannya sudah
 * dihapus: riwayat "WR-2026-0009 pernah ada" lebih baik daripada dua
 * pesanan berbeda berbagi satu nomor.
 */
import { prisma } from "../lib/prisma";

async function main() {
  const hapusPenghitung = false; // lihat komentar di atas

  const sebelum = await prisma.pesanan.count();
  console.log(`Pesanan sebelum: ${sebelum}`);

  await prisma.peristiwaWebhook.deleteMany();
  await prisma.peristiwaPesanan.deleteMany();
  await prisma.pembayaran.deleteMany();
  await prisma.itemPesanan.deleteMany();
  await prisma.pesanan.deleteMany();

  if (hapusPenghitung) await prisma.penghitung.deleteMany();

  console.log("Dihapus: peristiwa webhook, peristiwa pesanan, pembayaran, item, pesanan.");
  console.log("Menu, kategori, dan petugas TIDAK dihapus (itu data contoh, bukan data uji).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
