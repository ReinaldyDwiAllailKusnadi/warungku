// lib/sesi.ts — sesi login petugas warung.
//
// Pola ini disalin dari proyek-proyek sebelumnya yang sudah terbukti jalan,
// termasuk satu perbaikan yang butuh waktu lama untuk ketemu (soal cookie
// Secure di belakang nginx). Tidak ada alasan menulis ulang dari nol dan
// menemukan ulang masalah yang sama.
//
// CATATAN: nama cookie dan nomor port di komentar ikut disesuaikan. Berkas
// yang disalin tapi masih menyebut nama proyek lama adalah sumber kebingungan
// yang mahal — pernah terjadi di proyek sebelumnya, dan sempat membuat cookie
// sesi dua aplikasi saling menimpa saat diuji di peramban yang sama.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const NAMA_COOKIE = "warungku_sesi";

export type Sesi = {
  id: string;
  nama: string;
  email: string;
  peran: string;
};

export async function buatSesi(penggunaId: string): Promise<void> {
  const jar = await cookies();
  jar.set(NAMA_COOKIE, penggunaId, {
    httpOnly: true, // tidak bisa dibaca JavaScript -> sesi tidak bisa dicuri lewat XSS
    sameSite: "lax",
    // ---- Kenapa TIDAK selalu "secure: true" ----
    // Kalau ditandai Secure, browser HANYA menyimpan cookie itu di HTTPS.
    // Situs ini masih diakses lewat http:// (port 8085, belum ada domain +
    // sertifikat). Kalau dipaksa Secure, browser membuang cookienya TANPA
    // pesan galat apa pun — login tampak berhasil, lalu sesi hilang begitu
    // halaman dimuat ulang. Sangat membingungkan kalau belum pernah kena.
    //
    // Jadi syaratnya diukur dari kenyataan (apakah permintaan ini memang
    // sudah HTTPS), bukan dari NODE_ENV. Begitu sertifikat dipasang,
    // cookie Secure menyala sendiri tanpa perubahan kode.
    secure: await permintaanSudahHttps(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Apakah permintaan ini datang lewat HTTPS? Dibaca dari X-Forwarded-Proto
 *  karena aplikasi berdiri di belakang nginx. */
async function permintaanSudahHttps(): Promise<boolean> {
  try {
    const h = await headers();
    return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
  } catch {
    return false;
  }
}

export async function hapusSesi(): Promise<void> {
  const jar = await cookies();
  jar.delete(NAMA_COOKIE);
}

/**
 * Sesi aktif, atau null kalau belum masuk.
 *
 * Setiap panggilan menanyakan ulang ke database. Itu disengaja: kalau
 * petugas dinonaktifkan atau perannya diturunkan, perubahan itu langsung
 * berlaku. Cookie hanya menyimpan id — kewenangan selalu dibaca dari
 * database, bukan dari isi cookie.
 */
export async function sesiSekarang(): Promise<Sesi | null> {
  const jar = await cookies();
  const id = jar.get(NAMA_COOKIE)?.value;
  if (!id) return null;

  const p = await prisma.pengguna.findUnique({
    where: { id },
    select: { id: true, nama: true, email: true, peran: true, aktif: true },
  });

  if (!p || !p.aktif) return null;
  return { id: p.id, nama: p.nama, email: p.email, peran: p.peran };
}

/** Sesi wajib ada, kalau tidak dialihkan ke halaman masuk. */
export async function wajibMasuk(): Promise<Sesi> {
  const s = await sesiSekarang();
  if (!s) redirect("/masuk");
  return s;
}

/**
 * Cek peran untuk AKSI (bukan halaman). Mengembalikan pesan galat, bukan
 * melakukan redirect — karena aksi mengembalikan nilai ke form, bukan
 * mengganti halaman.
 *
 * Ini yang membuat pembatasan peran benar-benar berlaku: menyembunyikan
 * tombol di tampilan tidak menghentikan siapa pun yang mengirim
 * permintaannya langsung ke server.
 */
export function peranCukup(peran: string, diizinkan: string[]): string | null {
  if (!diizinkan.includes(peran)) {
    return "Peranmu tidak punya wewenang untuk tindakan ini.";
  }
  return null;
}
