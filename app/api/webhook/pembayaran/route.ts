import { NextResponse } from "next/server";
import {
  periksaTandaTangan,
  terapkanWebhook,
  type MuatanWebhook,
} from "@/lib/pembayaran";

/**
 * POST /api/webhook/pembayaran — menerima pemberitahuan pembayaran.
 *
 * Alamat ini TERBUKA DI INTERNET dan tidak memerlukan login: yang
 * memanggilnya adalah server penyedia pembayaran, bukan peramban
 * pelanggan. Karena itu satu-satunya yang membuktikan keasliannya
 * adalah TANDA TANGAN, bukan sesi.
 *
 * KENAPA ISI MENTAHNYA DIBACA DULU, BARU DIURAI:
 *   Tanda tangan dihitung atas deretan byte yang benar-benar dikirim.
 *   Begitu isinya melewati JSON.parse lalu disusun ulang, deretan
 *   byte-nya sudah berbeda (urutan kunci bisa berubah, spasi hilang) —
 *   dan tanda tangan yang sah akan gagal diperiksa. Karena itu
 *   `await permintaan.text()` diambil LEBIH DULU, dan JSON.parse
 *   dilakukan setelah tanda tangannya lolos.
 *
 * KENAPA KODE BALASANNYA DIPILIH-PILIH, BUKAN SELALU 200 ATAU SELALU 400:
 *   Penyedia pembayaran mengirim ULANG setiap panggilan yang dijawab
 *   dengan galat. Jadi kode balasan bukan sekadar keterangan — ia
 *   memutuskan apakah mereka akan mencoba lagi.
 *
 *     401 tanda tangan tidak sah -> MEMANG harus gagal. Permintaan
 *         palsu tidak akan menjadi asli kalau diulang.
 *     400 isi tidak bisa dibaca -> juga tidak akan membaik diulang.
 *     200 sudah tercatat -> dijawab berhasil supaya mereka BERHENTI
 *         mengirim ulang. Ini berlaku juga untuk kasus yang secara
 *         bisnis ditolak (nominal tidak cocok, tagihan tidak dikenal):
 *         peristiwanya sudah tercatat permanen, dan mengirim ulang
 *         tidak akan mengubah apa pun — hanya membanjiri kedua sisi.
 */
export async function POST(permintaan: Request) {
  // (1) Isi mentah, apa adanya.
  const isiMentah = await permintaan.text();

  // (2) Tanda tangan.
  const rahasia = process.env.WEBHOOK_SECRET;
  if (!rahasia) {
    // Salah konfigurasi di sisi kita, bukan di sisi mereka. Dijawab 500
    // supaya mereka mengirim ulang setelah kita perbaiki — bukan 401
    // yang akan membuat mereka berhenti dan pembayarannya tidak pernah
    // tercatat.
    console.error("[webhook] WEBHOOK_SECRET belum diisi — tidak bisa memeriksa keaslian.");
    return NextResponse.json(
      { ok: false, galat: "Penerima webhook belum dikonfigurasi." },
      { status: 500 },
    );
  }

  const tandaTangan =
    permintaan.headers.get("x-tanda-tangan") ??
    permintaan.headers.get("x-signature") ??
    "";

  if (!periksaTandaTangan(isiMentah, tandaTangan, rahasia)) {
    console.warn("[webhook] tanda tangan tidak sah — permintaan diabaikan.");
    return NextResponse.json(
      { ok: false, galat: "Tanda tangan tidak sah." },
      { status: 401 },
    );
  }

  // (3) Baru sekarang isinya boleh diurai.
  let muatan: MuatanWebhook;
  try {
    muatan = JSON.parse(isiMentah) as MuatanWebhook;
  } catch {
    return NextResponse.json(
      { ok: false, galat: "Isi permintaan bukan JSON yang sah." },
      { status: 400 },
    );
  }

  // (4) Terapkan.
  const hasil = await terapkanWebhook(muatan);

  if (!hasil.ok) {
    // Tercatat tapi ditolak secara bisnis: dijawab 200 supaya tidak
    // dikirim ulang tanpa henti. Alasannya tetap dicatat di log supaya
    // ada jejak untuk diperiksa manusia.
    console.warn(`[webhook] ditolak: ${hasil.galat}`);
    // dicatat: true (supaya tidak dikirim ulang) TAPI lunas: false
    // (pesanannya memang tidak berubah). Dua penanda terpisah, karena
    // "sudah kami catat" dan "pesanannya sudah lunas" bukan hal yang sama.
    return NextResponse.json({
      ok: true,
      dicatat: true,
      lunas: false,
      catatan: hasil.galat,
    });
  }

  return NextResponse.json({
    ok: true,
    sudahDiproses: hasil.data.sudahDiproses,
    lunas: hasil.data.lunas,
    pesanan: hasil.data.pesananNomor ?? null,
    catatan: hasil.data.catatan ?? null,
  });
}

/**
 * GET sengaja tidak disediakan.
 *
 * KENAPA: alamat yang menerima pemberitahuan uang tidak boleh punya
 * jalur yang bisa dipanggil hanya dengan membuka tautan di peramban.
 * Kalau ada, siapa pun yang menemukan alamatnya bisa memicunya dari
 * bilah alamat — dan itu cara paling mudah membuat catatan pembayaran
 * berubah tanpa uang masuk. Menjawab 405 membuat niatnya jelas.
 */
export async function GET() {
  return NextResponse.json(
    { ok: false, galat: "Alamat ini hanya menerima POST bertanda tangan." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
