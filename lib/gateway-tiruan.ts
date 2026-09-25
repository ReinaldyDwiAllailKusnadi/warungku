import { randomUUID } from "node:crypto";
import { tandaTanganWebhook } from "./pembayaran";

/**
 * lib/gateway-tiruan.ts — PENYEDIA PEMBAYARAN TIRUAN.
 *
 * ============================================================
 * INI BUKAN PENYEDIA PEMBAYARAN SUNGGUHAN.
 * ============================================================
 *
 * Tidak ada uang yang berpindah di sini. Yang ditiru adalah BENTUK
 * KERJASAMANYA, dan bentuk itulah yang paling penting untuk dipelajari:
 *
 *   1. Aplikasi kita minta tagihan ke penyedia, dan menerima sebuah
 *      referensi. Penyedia yang memegang halaman pembayarannya sendiri
 *      — pelanggan tidak pernah mengetik data kartu di aplikasi kita.
 *   2. Pelanggan membayar di halaman penyedia. Aplikasi kita TIDAK TAHU
 *      apa-apa sampai penyedia memberi tahu.
 *   3. Penyedia memanggil alamat webhook kita, dengan tanda tangan.
 *
 * YANG BERUBAH KALAU NANTI MEMAKAI PENYEDIA SUNGGUHAN (Midtrans,
 * Xendit, dan sejenisnya):
 *
 *   - Fungsi `buatTagihan()` di lib/pembayaran.ts diganti panggilan HTTP
 *     ke API mereka, dan `tautanBayar` diisi URL yang mereka kembalikan.
 *   - Rahasia tanda tangan diambil dari dasbor mereka, bukan dibuat
 *     sendiri seperti sekarang.
 *   - Nama header tanda tangannya berbeda-beda (X-Callback-Token,
 *     X-Signature, dan seterusnya) — bagian pembacaan header di route.ts
 *     sudah menerima dua nama yang paling umum, tinggal disesuaikan.
 *   - Bentuk muatan webhook mereka biasanya bersarang (ada objek
 *     "transaction" di dalamnya), jadi pemetaan ke MuatanWebhook perlu
 *     ditulis.
 *
 * YANG TIDAK PERLU BERUBAH: seluruh isi lib/pembayaran.ts yang menyangkut
 * verifikasi tanda tangan, idempotensi, kecocokan nominal, dan mesin
 * status. Itu justru bagian yang paling mudah salah, dan sudah diuji
 * terpisah dari penyedianya.
 */

export type HasilBayar = {
  ok: boolean;
  pesan: string;
  /**
   * Apakah PESANANNYA yang jadi lunas.
   *
   * Dibaca dari balasan webhook, bukan disimpulkan dari kode HTTP.
   * Balasan 200 hanya berarti "pemberitahuannya diterima dan dicatat" —
   * nominal yang tidak cocok juga dijawab 200, tapi pesanannya tetap
   * belum lunas.
   */
  lunas: boolean;
  /** Apa yang dijawab alamat webhook kita sendiri. */
  balasan?: unknown;
};

/**
 * Menirukan pelanggan menekan "bayar" di halaman penyedia.
 *
 * Yang dilakukan: menyusun muatan webhook, menandatanganinya dengan
 * kunci rahasia, lalu MEMANGGIL ALAMAT WEBHOOK KITA SENDIRI lewat HTTP.
 *
 * KENAPA LEWAT HTTP, BUKAN MEMANGGIL FUNGSINYA LANGSUNG:
 *   Kalau halaman bayar memanggil terapkanWebhook() secara langsung,
 *   yang teruji hanyalah fungsinya. Yang TIDAK teruji justru bagian yang
 *   paling sering salah di dunia nyata: pembacaan isi mentah, nama
 *   header tanda tangan, dan kode balasan HTTP — yak, bagian yang
 *   membuat penyedia mengirim ulang atau tidak. Lewat HTTP, seluruh
 *   jalur itu benar-benar dilewati.
 */
export async function bayarDiPenyediaTiruan(opsi: {
  basisUrl: string;
  referensi: string;
  jumlah: number;
  /** Untuk menguji jalur penolakan: kirim nominal yang berbeda. */
  jumlahDibayar?: number;
  /** Jenis peristiwa yang dilaporkan. */
  jenis?: string;
}): Promise<HasilBayar> {
  const rahasia = process.env.WEBHOOK_SECRET;
  if (!rahasia) {
    return { ok: false, lunas: false, pesan: "WEBHOOK_SECRET belum diisi di .env" };
  }

  const muatan = {
    eventId: `evt_${randomUUID()}`,
    jenis: opsi.jenis ?? "pembayaran.berhasil",
    referensi: opsi.referensi,
    jumlah: opsi.jumlahDibayar ?? opsi.jumlah,
    waktuBayar: new Date().toISOString(),
  };

  // Yang ditandatangani adalah teks yang benar-benar akan dikirim.
  const isi = JSON.stringify(muatan);
  const tandaTangan = tandaTanganWebhook(isi, rahasia);

  try {
    const balasan = await fetch(`${opsi.basisUrl}/api/webhook/pembayaran`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tanda-tangan": tandaTangan,
      },
      body: isi,
      cache: "no-store",
    });

    const teks = await balasan.text();
    let diurai: unknown = teks;
    try {
      diurai = JSON.parse(teks);
    } catch {
      // Biarkan apa adanya — balasan yang bukan JSON justru perlu
      // terlihat, bukan disembunyikan.
    }

    const lunas =
      typeof diurai === "object" &&
      diurai !== null &&
      (diurai as { lunas?: unknown }).lunas === true;

    return {
      ok: balasan.ok,
      pesan: `penyedia tiruan menerima balasan HTTP ${balasan.status}`,
      lunas,
      balasan: diurai,
    };
  } catch (e) {
    return {
      ok: false,
      lunas: false,
      pesan: `tidak bisa menghubungi alamat webhook: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
}

/**
 * Membangun alamat dasar aplikasi ini dari header permintaan.
 *
 * Dipakai supaya alamat webhook yang dipanggil benar-benar mengarah ke
 * aplikasi ini, apa pun port dan nama host yang sedang dipakai —
 * tanpa perlu menuliskan alamatnya di .env dan lupa memperbaruinya.
 */
export function basisUrlDari(header: Headers): string {
  const host = header.get("x-forwarded-host") ?? header.get("host") ?? "127.0.0.1:3005";
  const protokol = header.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";
  return `${protokol}://${host}`;
}
