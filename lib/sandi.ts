// Kata sandi: scrypt + salt per pengguna.
//
// Kenapa scrypt dan bukan SHA-256: SHA-256 dirancang supaya CEPAT.
// Itu justru merugikan untuk kata sandi — penyerang bisa mencoba
// miliaran tebakan per detik. scrypt sengaja dibuat lambat dan
// memakan memori, jadi setiap tebakan mahal.
//
// Kenapa salt per pengguna: tanpa salt, dua orang dengan kata sandi
// sama menghasilkan hash sama, dan satu tabel pelangi bisa memecahkan
// keduanya sekaligus. Salt membuat setiap hash unik.
//
// Kata sandi mentah tidak pernah disimpan, tidak pernah dicatat ke log,
// dan tidak pernah dikirim kembali ke browser.

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const PANJANG_SALT = 16;
const PANJANG_KUNCI = 64;

/** Ubah kata sandi jadi "salt:hash" untuk disimpan di database. */
export async function hashKataSandi(kataSandi: string): Promise<string> {
  const salt = randomBytes(PANJANG_SALT).toString("hex");
  const kunci = (await scryptAsync(kataSandi, salt, PANJANG_KUNCI)) as Buffer;
  return `${salt}:${kunci.toString("hex")}`;
}

/**
 * Cocokkan kata sandi dengan hash tersimpan.
 *
 * Perbandingan memakai timingSafeEqual, bukan ===. Alasannya: ===
 * berhenti pada karakter pertama yang beda, jadi lama eksekusinya
 * membocorkan berapa karakter awal yang benar. timingSafeEqual selalu
 * membandingkan seluruh panjang.
 */
export async function cocokKataSandi(
  kataSandi: string,
  tersimpan: string,
): Promise<boolean> {
  const [salt, hashHex] = tersimpan.split(":");
  if (!salt || !hashHex) return false;

  const hashAsli = Buffer.from(hashHex, "hex");
  const hashUji = (await scryptAsync(kataSandi, salt, PANJANG_KUNCI)) as Buffer;

  if (hashAsli.length !== hashUji.length) return false;
  return timingSafeEqual(hashAsli, hashUji);
}

/** Aturan kekuatan sandi minimum. Ditegakkan di server, bukan di browser. */
export function sandiCukupKuat(kataSandi: string): string | null {
  if (kataSandi.length < 8) return "Kata sandi minimal 8 karakter.";
  if (!/[a-zA-Z]/.test(kataSandi)) return "Kata sandi harus memuat huruf.";
  if (!/\d/.test(kataSandi)) return "Kata sandi harus memuat angka.";
  return null;
}
