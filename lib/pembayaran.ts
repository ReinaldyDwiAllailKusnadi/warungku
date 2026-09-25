import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { bolehPindah, type StatusPesanan } from "./status";
import type { Hasil } from "./menu";

/**
 * lib/pembayaran.ts — menerima dan menerapkan pemberitahuan pembayaran
 * dari penyedia pembayaran (webhook).
 *
 * INI BAGIAN YANG PALING MUDAH SALAH DI SELURUH APLIKASI, dan salahnya
 * selalu menyangkut uang. Tiga hal yang dijaga di sini:
 *
 *   1. KEAUTENTIKAN. Webhook datang dari internet; siapa pun bisa
 *      mengirim POST ke alamat itu. Tanpa verifikasi, orang bisa
 *      mengirim "pesanan WR-2026-0001 sudah dibayar" dan makanan keluar
 *      tanpa uang masuk. Tanda tangan HMAC atas ISI PERSIS yang dikirim
 *      membuktikan pesan itu dibuat oleh pemegang kunci rahasia.
 *
 *   2. IDEMPOTENSI. Penyedia mengirim ulang webhook kalau mereka tidak
 *      yakin kita menerimanya — dan "tidak yakin" itu biasa terjadi
 *      (jaringan putus setelah kita memproses tapi sebelum kita
 *      menjawab). Tanpa penjagaan, satu pembayaran tercatat berkali-kali.
 *      Kuncinya: setiap peristiwa punya ID, dan ID itu disimpan dengan
 *      batasan UNIK. Yang kedua kali gagal disimpan, dan itulah caranya
 *      kita tahu ia sudah pernah diproses.
 *
 *   3. KECOCOKAN NOMINAL. Webhook yang asli tapi nominalnya beda tetap
 *      tidak boleh menandai lunas. Bisa jadi pelanggan salah transfer,
 *      bisa jadi ada kesalahan di sisi penyedia.
 */

/** Nama penyedia. Di proyek latihan ini "tiruan", bukan penyedia sungguhan. */
export const PENYEDIA = "tiruan";

export type MuatanWebhook = {
  /** ID unik peristiwa di sisi penyedia. Kunci idempotensi. */
  eventId: string;
  /** "pembayaran.berhasil" | "pembayaran.gagal" */
  jenis: string;
  /** ID tagihan di sisi penyedia (kolom Pembayaran.referensi). */
  referensi: string;
  /** Nominal yang menurut penyedia sudah dibayar. */
  jumlah: number;
  waktuBayar: string;
};

export type HasilWebhook = {
  /** true kalau peristiwa ini sudah pernah diproses sebelumnya. */
  sudahDiproses: boolean;
  /**
   * APAKAH PESANANNYA YANG JADI LUNAS — bukan apakah panggilannya berhasil.
   *
   * Dua hal ini berbeda dan mudah tertukar: pemberitahuan bertanda tangan
   * sah yang membawa nominal kurang BERHASIL diterima (kodenya 200,
   * peristiwanya tercatat), tetapi pesanannya TIDAK lunas. Tanpa penanda
   * ini, pemanggil hanya tahu "berhasil" lalu menampilkan pesan berhasil
   * hijau di atas pesanan yang masih menunggu bayar.
   */
  lunas: boolean;
  pesananNomor?: string;
  catatan?: string;
};

// ------------------------------------------------------------- tanda tangan

/**
 * Menghitung tanda tangan HMAC-SHA256 atas isi permintaan yang PERSIS.
 *
 * KENAPA ATAS ISI MENTAH (raw body), BUKAN ATAS OBJEK YANG SUDAH
 * DIURAIKAN JSON:
 *   Dua penulisan JSON yang berbeda bisa menghasilkan objek yang sama —
 *   urutan kunci berbeda, spasi berbeda, angka 1000 vs 1e3. Kalau tanda
 *   tangan dihitung atas objek hasil uraian, tanda tangan yang sah bisa
 *   saja ditolak (atau lebih buruk: yang tidak sah diterima). Yang
 *   ditandatangani adalah deretan byte yang benar-benar dikirim.
 */
export function tandaTanganWebhook(isiMentah: string, rahasia: string): string {
  return createHmac("sha256", rahasia).update(isiMentah, "utf8").digest("hex");
}

/**
 * Memeriksa tanda tangan.
 *
 * KENAPA timingSafeEqual, BUKAN === :
 *   Perbandingan teks biasa berhenti pada karakter pertama yang berbeda.
 *   Selisih waktunya bisa diukur dari luar, dan dari selisih itu tanda
 *   tangan yang benar bisa ditebak karakter demi karakter. timingSafeEqual
 *   selalu membandingkan seluruh panjangnya.
 *
 * Panjang harus disamakan lebih dulu: timingSafeEqual MELEMPAR galat
 * kalau panjang kedua buffer berbeda, dan galat itu sendiri bisa
 * dipakai untuk membedakan.
 */
export function periksaTandaTangan(
  isiMentah: string,
  tandaTangan: string | undefined | null,
  rahasia: string,
): boolean {
  if (!tandaTangan) return false;
  const diharapkan = tandaTanganWebhook(isiMentah, rahasia);
  const a = Buffer.from(diharapkan, "utf8");
  const b = Buffer.from(String(tandaTangan), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ tagihan

/** Membuat referensi tagihan yang unik untuk satu pesanan. */
export function referensiTagihan(nomor: string, percobaan: number): string {
  return `TAG-${nomor}-${percobaan}`;
}

/**
 * Membuat satu percobaan pembayaran untuk sebuah pesanan.
 *
 * KENAPA PERCOBAAN PEMBAYARAN DIPISAH DARI PESANAN:
 *   Pelanggan sering membuka halaman bayar lebih dari sekali — menutup
 *   tab lalu kembali, atau tagihan pertama kedaluwarsa. Kalau referensi
 *   tagihan hanya satu dan disimpan di baris pesanan, percobaan kedua
 *   akan menimpa yang pertama, dan webhook untuk tagihan lama jadi tidak
 *   bisa dicocokkan lagi. Tabel terpisah membuat setiap tagihan tetap
 *   bisa ditelusuri.
 */
export async function buatTagihan(
  pesananId: string,
): Promise<Hasil<{ referensi: string; tautanBayar: string; kedaluwarsa: Date }>> {
  const pesanan = await prisma.pesanan.findUnique({
    where: { id: pesananId },
    include: { pembayaran: true },
  });
  if (!pesanan) return { ok: false, galat: "Pesanan tidak ditemukan." };
  if (pesanan.status !== "MENUNGGU_BAYAR") {
    return { ok: false, galat: "Pesanan ini tidak sedang menunggu pembayaran." };
  }

  // Tagihan yang masih berlaku dipakai ulang — supaya menekan "bayar"
  // dua kali tidak membuat dua tagihan berbeda untuk pesanan yang sama.
  const berlaku = pesanan.pembayaran.find(
    (p) => p.status === "MENUNGGU" && p.kedaluwarsa.getTime() > Date.now(),
  );
  if (berlaku) {
    return {
      ok: true,
      data: {
        referensi: berlaku.referensi,
        tautanBayar: berlaku.tautanBayar,
        kedaluwarsa: berlaku.kedaluwarsa,
      },
    };
  }

  const referensi = referensiTagihan(pesanan.nomor, pesanan.pembayaran.length + 1);
  const kedaluwarsa = pesanan.kedaluwarsa;
  const tautanBayar = `/bayar/${referensi}`;

  await prisma.pembayaran.create({
    data: {
      pesananId: pesanan.id,
      penyedia: PENYEDIA,
      referensi,
      jumlah: pesanan.total,
      tautanBayar,
      kedaluwarsa,
    },
  });

  return { ok: true, data: { referensi, tautanBayar, kedaluwarsa } };
}

// ------------------------------------------------------------------ webhook

/**
 * Menerapkan satu webhook.
 *
 * Urutan langkahnya penting dan sengaja seperti ini:
 *
 *   1. Catat ID peristiwa LEBIH DULU, di dalam transaksi. Kalau ID-nya
 *      sudah ada, batasan UNIK yang menolak — dan penolakan itu yang
 *      memberi tahu kita bahwa peristiwa ini sudah pernah diproses.
 *      Memeriksa dengan "SELECT dulu, INSERT kemudian" tidak cukup:
 *      dua webhook kembar yang datang bersamaan bisa sama-sama lolos
 *      pemeriksaan sebelum salah satunya sempat menyimpan.
 *
 *   2. Baru sesudah itu mencari tagihannya dan memeriksa nominalnya.
 *
 *   3. Perubahan status pesanan memakai penguncian baris, dan tetap
 *      melewati mesin status (bolehPindah). Webhook tidak boleh menjadi
 *      jalan pintas yang melewati aturan yang berlaku untuk semua orang.
 */
export async function terapkanWebhook(
  muatan: MuatanWebhook,
): Promise<Hasil<HasilWebhook>> {
  if (!muatan?.eventId || !muatan?.referensi) {
    return { ok: false, galat: "Muatan webhook tidak lengkap." };
  }
  if (!Number.isInteger(muatan.jumlah) || muatan.jumlah < 0) {
    return { ok: false, galat: "Nominal pada webhook tidak masuk akal." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // (1) Kunci idempotensi.
      try {
        await tx.peristiwaWebhook.create({
          data: {
            eventId: muatan.eventId,
            jenis: muatan.jenis,
            ringkas: `${muatan.referensi} ${muatan.jumlah}`,
          },
        });
      } catch (e) {
        // P2002 = pelanggaran batasan unik = peristiwa ini sudah pernah
        // diproses. Ini BUKAN kegagalan: jawabannya tetap "berhasil",
        // supaya penyedia berhenti mengirim ulang.
        if (kodePrisma(e) === "P2002") {
          // Peristiwanya kembar, dan kembarannya itu yang menandai lunas.
          return { ok: true, data: { sudahDiproses: true, lunas: true } };
        }
        throw e;
      }

      // (2) Cari tagihannya.
      const bayar = await tx.pembayaran.findUnique({
        where: { referensi: muatan.referensi },
        include: { pesanan: true },
      });
      if (!bayar) {
        return {
          ok: false,
          galat: `Tagihan ${muatan.referensi} tidak dikenal.`,
        };
      }

      // Sudah berhasil sebelumnya — tidak melakukan apa-apa lagi.
      if (bayar.status === "BERHASIL") {
        return {
          ok: true,
          data: {
            sudahDiproses: true,
            lunas: true,
            pesananNomor: bayar.pesanan.nomor,
          },
        };
      }

      // (3) Kecocokan nominal.
      if (muatan.jumlah !== bayar.jumlah) {
        await tx.peristiwaPesanan.create({
          data: {
            pesananId: bayar.pesananId,
            dari: bayar.pesanan.status,
            ke: bayar.pesanan.status,
            sebab: "webhook-nominal-tidak-cocok",
            oleh: null,
          },
        });
        return {
          ok: false,
          galat:
            `Nominal tidak cocok: tagihan ${bayar.jumlah}, ` +
            `dibayar ${muatan.jumlah}. Pesanan TIDAK ditandai lunas.`,
        };
      }

      const waktuBayar = new Date(muatan.waktuBayar);
      if (Number.isNaN(waktuBayar.getTime())) {
        return { ok: false, galat: "Waktu pembayaran pada webhook tidak sah." };
      }

      // (4) Perbarui tagihan.
      await tx.pembayaran.update({
        where: { id: bayar.id },
        data: {
          status: muatan.jenis === "pembayaran.gagal" ? "GAGAL" : "BERHASIL",
          dibayarPada: waktuBayar,
        },
      });

      if (muatan.jenis === "pembayaran.gagal") {
        await tx.peristiwaPesanan.create({
          data: {
            pesananId: bayar.pesananId,
            dari: bayar.pesanan.status,
            ke: bayar.pesanan.status,
            sebab: "webhook-gagal",
            oleh: null,
          },
        });
        return {
          ok: true,
          data: {
            sudahDiproses: false,
            lunas: false,
            pesananNomor: bayar.pesanan.nomor,
            catatan: "Pembayaran dilaporkan gagal; status pesanan tidak berubah.",
          },
        };
      }

      // (5) Kunci baris pesanan sebelum mengubah statusnya.
      const [baris] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status::text FROM pesanan WHERE id = ${bayar.pesananId} FOR UPDATE
      `;

      const statusSekarang = baris.status as StatusPesanan;

      // Pesanan yang sudah dibatalkan (kedaluwarsa) tapi tetap dibayar.
      // Uangnya SUDAH masuk menurut penyedia, jadi tidak boleh diabaikan
      // — tapi pesanannya juga tidak boleh dihidupkan lagi. Yang benar:
      // catat pembayarannya, biarkan pesanannya batal, dan tandai bahwa
      // ada uang yang perlu dikembalikan. Kalau ini dibiarkan senyap,
      // catatan keuangan akan tampak seimbang padahal ada uang masuk
      // untuk pesanan yang tidak pernah diserahkan.
      if (statusSekarang === "DIBATALKAN") {
        await tx.peristiwaPesanan.create({
          data: {
            pesananId: bayar.pesananId,
            dari: statusSekarang,
            ke: statusSekarang,
            sebab: "dibayar-setelah-batal-perlu-pengembalian",
            oleh: null,
          },
        });
        return {
          ok: true,
          data: {
            sudahDiproses: false,
            lunas: false,
            pesananNomor: bayar.pesanan.nomor,
            catatan:
              "Pesanan sudah dibatalkan karena kedaluwarsa, tetapi pembayaran masuk. Perlu pengembalian dana.",
          },
        };
      }

      if (statusSekarang === "DIBAYAR") {
        // Sudah lunas lewat jalur lain (misalnya tagihan lain untuk
        // pesanan yang sama). Tidak ada yang perlu diubah.
        return {
          ok: true,
          data: {
            sudahDiproses: true,
            lunas: true,
            pesananNomor: bayar.pesanan.nomor,
          },
        };
      }

      if (!bolehPindah(statusSekarang, "DIBAYAR")) {
        return {
          ok: false,
          galat: `Pesanan berstatus ${statusSekarang} tidak bisa ditandai lunas.`,
        };
      }

      await tx.pesanan.update({
        where: { id: bayar.pesananId },
        data: { status: "DIBAYAR", dibayarPada: waktuBayar },
      });
      await tx.peristiwaPesanan.create({
        data: {
          pesananId: bayar.pesananId,
          dari: statusSekarang,
          ke: "DIBAYAR",
          sebab: "webhook",
          oleh: null,
        },
      });

      return {
        ok: true,
        data: {
          sudahDiproses: false,
          lunas: true,
          pesananNomor: bayar.pesanan.nomor,
        },
      };
    });
  } catch (e) {
    return { ok: false, galat: `Webhook gagal diproses: ${pesanGalat(e)}` };
  }
}

// ------------------------------------------------------------ ubah status

/**
 * Memindahkan status pesanan menurut mesin status.
 * Dipakai panel petugas. Perpindahan yang tidak sah DITOLAK di sini,
 * bukan hanya disembunyikan tombolnya di antarmuka.
 */
export async function pindahkanStatus(
  pesananId: string,
  ke: StatusPesanan,
  sebab: string,
  oleh: string | null,
): Promise<Hasil<{ dari: StatusPesanan; ke: StatusPesanan }>> {
  try {
    return await prisma.$transaction(async (tx) => {
      const [baris] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status::text AS status FROM pesanan WHERE id = ${pesananId} FOR UPDATE
      `;
      if (!baris) return { ok: false, galat: "Pesanan tidak ditemukan." };

      const dari = baris.status as StatusPesanan;
      if (dari === ke) {
        return { ok: true, data: { dari, ke } };
      }
      if (!bolehPindah(dari, ke)) {
        return { ok: false, galat: `Tidak bisa dari ${dari} ke ${ke}.` };
      }

      await tx.pesanan.update({ where: { id: pesananId }, data: { status: ke } });
      await tx.peristiwaPesanan.create({
        data: { pesananId, dari, ke, sebab, oleh },
      });
      return { ok: true, data: { dari, ke } };
    });
  } catch (e) {
    return { ok: false, galat: `Gagal mengubah status: ${pesanGalat(e)}` };
  }
}

/**
 * Membatalkan pesanan yang sudah lewat batas bayarnya.
 *
 * KENAPA DIJALANKAN SAAT HALAMAN DIBUKA, BUKAN LEWAT PENJADWAL:
 *   Proyek ini belum punya pekerja latar (itu proyek tersendiri). Jadi
 *   pembatalan dijalankan setiap kali daftar pesanan dibuka. Akibatnya
 *   yang perlu diketahui: kalau tidak ada yang membuka panel selama
 *   berjam-jam, pembatalannya juga tertunda selama itu. Untuk warung
 *   yang selalu ada petugasnya, ini cukup — tapi bukan sesuatu yang
 *   boleh dianggap selalu tepat waktu.
 */
export async function batalkanYangKedaluwarsa(): Promise<number> {
  const lewat = await prisma.pesanan.findMany({
    where: { status: "MENUNGGU_BAYAR", kedaluwarsa: { lt: new Date() } },
    select: { id: true },
  });
  let n = 0;
  for (const p of lewat) {
    const hasil = await pindahkanStatus(p.id, "DIBATALKAN", "kedaluwarsa", null);
    if (hasil.ok) n++;
  }
  return n;
}

// ------------------------------------------------------------------ bantu

function kodePrisma(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

function pesanGalat(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
