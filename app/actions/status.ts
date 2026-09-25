"use server";

import { revalidatePath } from "next/cache";
import { pindahkanStatus } from "@/lib/pembayaran";
import { bolehJalankan, LABEL_STATUS, type StatusPesanan } from "@/lib/status";
import { prisma } from "@/lib/prisma";
import { sesiUntukAksi } from "./auth";

/**
 * app/actions/status.ts — petugas memindahkan status pesanan.
 *
 * WEWENANG DIPERIKSA DI SINI, BUKAN HANYA DENGAN MENYEMBUNYIKAN TOMBOL.
 *   Menyembunyikan tombol hanya mengubah tampilan. Siapa pun bisa
 *   mengirim permintaan langsung ke server tanpa melewati tampilan, jadi
 *   pemeriksaan yang sebenarnya harus ada di tempat yang memutuskan.
 *   Menyembunyikan tombol itu demi kenyamanan; memeriksa di sini yang
 *   membuatnya benar-benar berlaku.
 *
 * ATURANNYA DITULIS DI SATU TEMPAT SAJA: bolehJalankan() di
 * lib/status.ts.
 *   Sebelumnya berkas ini punya daftar wewenangnya sendiri, sementara
 *   halaman panel punya daftar lain lagi untuk memutuskan tombol mana
 *   yang ditampilkan. Dua daftar yang harus cocok tapi ditulis terpisah
 *   adalah cara paling andal membuat tombol yang tampil berbeda dari
 *   yang diizinkan server — dan itu muncul sebagai "tombolnya ada tapi
 *   tidak bekerja", yang paling sulit dilacak.
 */

export type HasilUbah = { ok: boolean; pesan: string };

export async function ubahStatusAction(
  _sebelumnya: HasilUbah | undefined,
  data: FormData,
): Promise<HasilUbah> {
  const sesi = await sesiUntukAksi();
  if (!sesi) return { ok: false, pesan: "Sesi sudah berakhir. Masuk ulang." };

  const pesananId = String(data.get("pesananId") ?? "");
  const ke = String(data.get("ke") ?? "") as StatusPesanan;
  if (!pesananId || !ke) return { ok: false, pesan: "Permintaan tidak lengkap." };

  // Status AWAL dibaca dari database, bukan dari isi formulir.
  // Kalau dikirim dari peramban, pemanggil bisa mengaku pesanannya
  // berstatus apa saja supaya perpindahannya lolos pemeriksaan.
  const sekarang = await prisma.pesanan.findUnique({
    where: { id: pesananId },
    select: { status: true },
  });
  if (!sekarang) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  // Peran dibaca dari database (lihat lib/sesi.ts), bukan dari cookie —
  // jadi penurunan peran langsung berlaku pada permintaan berikutnya.
  if (!bolehJalankan(sesi.peran, sekarang.status, ke)) {
    return {
      ok: false,
      pesan: `Peranmu tidak berwenang memindahkan pesanan dari ${LABEL_STATUS[sekarang.status]} ke ${LABEL_STATUS[ke] ?? ke}.`,
    };
  }

  const hasil = await pindahkanStatus(pesananId, ke, sesi.peran, sesi.nama);

  // Panel dihitung ulang supaya angkanya langsung menyesuaikan, bukan
  // menunggu pengunjung memuat ulang sendiri.
  revalidatePath("/operator");

  if (!hasil.ok) return { ok: false, pesan: hasil.galat };
  if (hasil.data.dari === hasil.data.ke) {
    return { ok: true, pesan: "Statusnya memang sudah begitu." };
  }
  return { ok: true, pesan: `Dipindahkan ke ${LABEL_STATUS[ke] ?? ke}.` };
}
