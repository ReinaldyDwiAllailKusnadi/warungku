"use server";

import { redirect } from "next/navigation";
import { buatPesanan } from "@/lib/pesanan";
import { buatTagihan } from "@/lib/pembayaran";
import type { BarisKeranjang, TipePesan } from "@/lib/menu";

/**
 * app/actions/pesan.ts — jembatan tipis antara formulir dan lib/pesanan.ts.
 *
 * KENAPA TIPIS:
 *   Seluruh aturan (harga dari database, total, batas porsi, nomor
 *   pesanan) ada di lib/pesanan.ts. Kalau aturannya ditulis lagi di
 *   sini, akan ada dua tempat yang harus dijaga tetap sama — dan yang
 *   satu akan tertinggal.
 *
 * KENAPA KERANJANGNYA DIKIRIM SEBAGAI TEKS JSON, BUKAN SEBAGAI BEBERAPA KOLOM:
 *   Jumlah barisnya berubah-ubah. Kalau dipaksa jadi kolom tetap
 *   (menu1..menu10), batas jumlah jenis menu ikut ditentukan bentuk
 *   formulirnya — bukan oleh aturan yang sebenarnya. Bentuknya tetap
 *   diperiksa di server; yang dipercaya bukan isinya, hanya bentuknya.
 */

export type HasilForm = { ok: boolean; galat?: string; nomor?: string };

export async function pesanAction(
  _sebelumnya: HasilForm | undefined,
  data: FormData,
): Promise<HasilForm> {
  const nama = String(data.get("nama") ?? "");
  const telepon = String(data.get("telepon") ?? "");
  const tipe = String(data.get("tipe") ?? "DIAMBIL") as TipePesan;
  const alamat = String(data.get("alamat") ?? "");
  const catatan = String(data.get("catatan") ?? "");
  const keranjangMentah = String(data.get("keranjang") ?? "[]");

  if (tipe !== "DIAMBIL" && tipe !== "ANTAR") {
    return { ok: false, galat: "Cara pengambilan tidak dikenali." };
  }

  let keranjang: BarisKeranjang[];
  try {
    keranjang = JSON.parse(keranjangMentah);
  } catch {
    return { ok: false, galat: "Keranjang tidak bisa dibaca. Muat ulang halaman." };
  }
  if (!Array.isArray(keranjang)) {
    return { ok: false, galat: "Keranjang tidak bisa dibaca. Muat ulang halaman." };
  }

  const hasil = await buatPesanan({
    nama,
    telepon,
    tipe,
    alamat,
    catatan,
    keranjang,
  });

  if (!hasil.ok) return { ok: false, galat: hasil.galat };

  // Tagihan dibuat langsung supaya pelanggan tidak perlu menekan satu
  // tombol lagi hanya untuk sampai ke halaman bayar.
  await buatTagihan(hasil.data.id);

  redirect(`/pesanan/${hasil.data.nomor}`);
}
