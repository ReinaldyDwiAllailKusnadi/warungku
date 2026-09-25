"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cocokKataSandi } from "@/lib/sandi";
import { buatSesi, hapusSesi, sesiSekarang } from "@/lib/sesi";

/**
 * app/actions/auth.ts — masuk dan keluar petugas warung.
 *
 * Dua hal yang dijaga di sini dan sering terlewat:
 *
 *   1. PESAN GALATNYA SATU BENTUK untuk "email tidak ada" dan "sandi
 *      salah". Kalau dibedakan, orang bisa memakai halaman masuk untuk
 *      menyisir daftar email petugas: jawaban "email tidak dikenal"
 *      memberi tahu mana yang BUKAN petugas.
 *
 *   2. Pemeriksaan kata sandi tetap dijalankan walau emailnya tidak
 *      ada. Kalau langsung berhenti, selisih waktu balasannya bisa
 *      diukur dan dipakai menebak email mana yang terdaftar.
 */

export type HasilMasuk = { ok: boolean; galat?: string };

// Kata sandi tiruan untuk kasus "email tidak ada". Bukan rahasia apa pun:
// gunanya hanya supaya pemeriksaan sandi tetap berjalan dan waktunya
// serupa. Nilainya tidak akan pernah cocok karena hash aslinya acak.
const HASH_TIRUAN =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8/RdQzVJ2KqRqv0Tq5Lh7bO3oQ5tZu";

export async function masukAction(
  _sebelumnya: HasilMasuk | undefined,
  data: FormData,
): Promise<HasilMasuk> {
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const sandi = String(data.get("sandi") ?? "");

  if (!email || !sandi) {
    return { ok: false, galat: "Email dan kata sandi belum diisi." };
  }

  const pengguna = await prisma.pengguna.findUnique({ where: { email } });

  const cocok = await cocokKataSandi(sandi, pengguna?.sandiHash ?? HASH_TIRUAN);

  if (!pengguna || !cocok) {
    return { ok: false, galat: "Email atau kata sandi salah." };
  }
  if (!pengguna.aktif) {
    // Ini boleh dibedakan dari sandi salah: orang yang tahu kata
    // sandinya tapi dimatikan akunnya perlu tahu kenapa, dan
    // mengetahuinya tidak menolong penyerang apa pun.
    return { ok: false, galat: "Akun ini sedang dinonaktifkan." };
  }

  await buatSesi(pengguna.id);
  redirect("/operator");
}

export async function keluarAction(): Promise<void> {
  await hapusSesi();
  redirect("/");
}

/**
 * Sesi untuk keperluan pemeriksaan wewenang di dalam aksi.
 * Dipisahkan supaya pemanggilnya jelas: ini untuk aksi, bukan untuk
 * halaman. Halaman memakai wajibMasuk() yang mengalihkan.
 */
export async function sesiUntukAksi() {
  return sesiSekarang();
}
