"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { bayarDiPenyediaTiruan, basisUrlDari } from "@/lib/gateway-tiruan";
import { prisma } from "@/lib/prisma";

/**
 * app/actions/bayar.ts — menekan tombol bayar di halaman penyedia tiruan.
 *
 * KENAPA INI ADA DI DALAM APLIKASI YANG SAMA, PADAHAL SEHARUSNYA DI SISI
 * PENYEDIA:
 *   Karena penyedianya tiruan. Supaya tetap jujur, perhatikan apa yang
 *   TIDAK dilakukan fungsi ini: ia tidak menyentuh tabel pesanan sama
 *   sekali. Ia hanya mengirim pemberitahuan bertanda tangan, persis
 *   seperti yang akan dilakukan penyedia sungguhan dari servernya
 *   sendiri. Status pesanan berubah HANYA lewat alamat webhook.
 *
 *   Itu penting: kalau fungsi ini menandai pesanannya lunas secara
 *   langsung, seluruh mesin webhook yang sudah dibangun jadi tidak
 *   pernah terpakai — dan justru itulah bagian yang paling mudah salah.
 */

export type HasilBayar = {
  ok: boolean;
  /** Apakah PESANANNYA yang jadi lunas — bukan apakah panggilannya berhasil. */
  lunas: boolean;
  pesan: string;
  balasan?: string;
};

export async function bayarAction(
  _sebelumnya: HasilBayar | undefined,
  data: FormData,
): Promise<HasilBayar> {
  const referensi = String(data.get("referensi") ?? "");
  // Dua jalur yang sengaja disediakan supaya bisa dibuktikan bahwa
  // penjagaan nominalnya benar-benar bekerja.
  const mode = String(data.get("mode") ?? "tepat");

  const tagihan = await prisma.pembayaran.findUnique({
    where: { referensi },
    select: { referensi: true, jumlah: true, status: true },
  });
  if (!tagihan) return { ok: false, lunas: false, pesan: "Tagihan tidak ditemukan." };
  if (tagihan.status === "BERHASIL") {
    return {
      ok: true,
      lunas: true,
      pesan: "Tagihan ini sudah dibayar sebelumnya.",
    };
  }

  const jumlahDibayar =
    mode === "kurang" ? tagihan.jumlah - 1_000 : mode === "lebih" ? tagihan.jumlah + 1_000 : undefined;

  const h = await headers();
  const hasil = await bayarDiPenyediaTiruan({
    basisUrl: basisUrlDari(h),
    referensi: tagihan.referensi,
    jumlah: tagihan.jumlah,
    jumlahDibayar,
  });

  return {
    ok: hasil.ok,
    lunas: hasil.lunas,
    pesan: hasil.pesan,
    balasan:
      typeof hasil.balasan === "string"
        ? hasil.balasan
        : JSON.stringify(hasil.balasan),
  };
}

/** Mengembalikan pelanggan ke halaman status pesanannya. */
export async function kembaliKePesananAction(data: FormData): Promise<void> {
  const nomor = String(data.get("nomor") ?? "");
  redirect(`/pesanan/${nomor}`);
}
