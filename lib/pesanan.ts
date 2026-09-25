import { prisma } from "./prisma";
import {
  type BarisKeranjang,
  type BarisLengkap,
  type Hasil,
  type TipePesan,
  batasBayar,
  hitungSemua,
  periksaKeranjang,
  periksaPemesan,
} from "./menu";

/**
 * lib/pesanan.ts — mengubah keranjang menjadi pesanan.
 *
 * ATURAN YANG DITEGAKKAN DI SINI, dan kenapa:
 *
 *   HARGA TIDAK PERNAH DATANG DARI PERAMBAAN.
 *     Peramban hanya mengirim "menu apa" dan "berapa porsi". Harga
 *     diambil dari tabel menu oleh server. Kalau harga ikut dikirim,
 *     siapa pun bisa memesan nasi goreng seharga Rp1 lewat alat
 *     pengembang peramban.
 *
 *   NAMA DAN HARGA DISALIN ke baris pesanan.
 *     Kalau harga dibaca dari tabel menu saat menampilkan nota, nota
 *     lama ikut berubah ketika harga naik. Pelanggan yang menyimpan
 *     notanya akan melihat angka yang berbeda dari yang dia bayar.
 *
 *   MENU YANG SEDANG TIDAK TERSEDIA DITOLAK, bukan diam-diam dibuang.
 *     Membuangnya diam-diam berarti pelanggan menerima pesanan yang
 *     kurang tanpa tahu, dan uangnya sudah dibayar.
 *
 *   NOMOR PESANAN DIBUAT DI DALAM TRANSAKSI DENGAN PENGUNCIAN BARIS.
 *     Dua pesanan bersamaan bisa membaca penghitung yang sama dan
 *     mendapat nomor kembar — dan nomor itu yang dipakai pelanggan
 *     untuk menyebut pesanannya, jadi kembar berarti tidak bisa
 *     dibedakan.
 */

export type MasukanPesanan = {
  nama: string;
  telepon: string;
  tipe: TipePesan;
  alamat?: string | null;
  catatan?: string | null;
  keranjang: BarisKeranjang[];
};

export type PesananDibuat = {
  id: string;
  nomor: string;
  total: number;
  kedaluwarsa: Date;
};

/** Ambil harga dan nama menu dari database, lalu lengkapi barisnya. */
async function lengkapiBaris(
  keranjang: BarisKeranjang[],
): Promise<Hasil<BarisLengkap[]>> {
  const ids = keranjang.map((b) => b.menuId);
  const menu = await prisma.menu.findMany({
    where: { id: { in: ids } },
    select: { id: true, nama: true, harga: true, tersedia: true },
  });
  const peta = new Map(menu.map((m) => [m.id, m]));

  const hasil: BarisLengkap[] = [];
  for (const b of keranjang) {
    const m = peta.get(b.menuId);
    if (!m) {
      return { ok: false, galat: "Ada menu yang tidak ada di daftar." };
    }
    if (!m.tersedia) {
      return {
        ok: false,
        galat: `"${m.nama}" sedang tidak tersedia. Hapus dari keranjang dulu.`,
      };
    }
    hasil.push({
      menuId: m.id,
      jumlah: b.jumlah,
      catatan: b.catatan,
      namaSaatItu: m.nama,
      // Harga diambil dari database, BUKAN dari yang dikirim peramban.
      hargaSaatItu: m.harga,
    });
  }
  return { ok: true, data: hasil };
}

/**
 * Membuat pesanan.
 *
 * Perhatikan: seluruhnya di dalam SATU transaksi. Kalau penulisan baris
 * pesanan gagal di tengah jalan, pesanannya tidak boleh ada sama sekali
 * — pesanan tanpa baris berarti tagihan yang tidak bisa dijelaskan
 * isinya.
 */
export async function buatPesanan(
  masukan: MasukanPesanan,
): Promise<Hasil<PesananDibuat>> {
  const keranjang = periksaKeranjang(masukan.keranjang);
  if (!keranjang.ok) return keranjang;

  const pemesan = periksaPemesan({
    nama: masukan.nama,
    telepon: masukan.telepon,
    tipe: masukan.tipe,
    alamat: masukan.alamat,
  });
  if (!pemesan.ok) return pemesan;

  const baris = await lengkapiBaris(keranjang.data);
  if (!baris.ok) return baris;

  const { subtotal, biayaAntar, total } = hitungSemua(baris.data, masukan.tipe);
  if (total <= 0) {
    return { ok: false, galat: "Total pesanan tidak masuk akal." };
  }

  const catatan = (masukan.catatan ?? "").trim().slice(0, 300);
  const waktu = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      // Nomor pesanan: satu baris penghitung dikunci, lalu dinaikkan.
      // FOR UPDATE membuat pesanan lain menunggu sampai transaksi ini
      // selesai, sehingga tidak ada dua pesanan membaca angka yang sama.
      const barisPenghitung = await tx.$queryRaw<{ terakhir: number }[]>`
        INSERT INTO penghitung (id, nama, terakhir) VALUES (gen_random_uuid()::text, 'pesanan', 1)
        ON CONFLICT (nama) DO UPDATE SET terakhir = penghitung.terakhir + 1
        RETURNING terakhir
      `;
      const urut = barisPenghitung[0].terakhir;
      const tahun = waktu.getFullYear();
      const nomor = `WR-${tahun}-${String(urut).padStart(4, "0")}`;

      const pesanan = await tx.pesanan.create({
        data: {
          nomor,
          nama: pemesan.data.nama,
          telepon: pemesan.data.telepon,
          tipe: masukan.tipe,
          alamat: pemesan.data.alamat,
          catatan: catatan || null,
          subtotal,
          biayaAntar,
          total,
          kedaluwarsa: batasBayar(waktu),
          item: {
            create: baris.data.map((b) => ({
              menuId: b.menuId,
              namaSaatItu: b.namaSaatItu,
              hargaSaatItu: b.hargaSaatItu,
              jumlah: b.jumlah,
            })),
          },
          peristiwa: {
            create: {
              dari: null,
              ke: "MENUNGGU_BAYAR",
              sebab: "dibuat",
              oleh: null,
            },
          },
        },
        select: { id: true, nomor: true, total: true, kedaluwarsa: true },
      });

      return { ok: true, data: pesanan };
    });
  } catch (e) {
    return {
      ok: false,
      galat: `Pesanan gagal dibuat: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Membatalkan pesanan yang belum dibayar atas permintaan petugas.
 * Dipisahkan supaya pemanggilnya jelas: ini tindakan manusia, bukan
 * kedaluwarsa otomatis.
 */
export async function batalkanPesanan(
  pesananId: string,
  oleh: string,
): Promise<Hasil<true>> {
  const { pindahkanStatus } = await import("./pembayaran");
  const hasil = await pindahkanStatus(pesananId, "DIBATALKAN", "kasir", oleh);
  if (!hasil.ok) return hasil;
  return { ok: true, data: true };
}
