/**
 * app/bayar/[referensi]/page.tsx — halaman pembayaran PENYEDIA TIRUAN.
 *
 * KENAPA HALAMAN INI ADA DI DALAM APLIKASI YANG SAMA:
 *   Pada alur sungguhan, halaman ini ada di server penyedia pembayaran —
 *   pelanggan dikirim ke sana, dan aplikasi kita tidak pernah melihat
 *   data pembayarannya. Karena di sini penyedianya tiruan, halamannya
 *   ikut dibuat di sini. Yang dijaga: halaman ini TIDAK menyentuh tabel
 *   pesanan sama sekali. Ia hanya mengirim pemberitahuan bertanda
 *   tangan ke alamat webhook, persis seperti penyedia sungguhan.
 *
 * KENAPA ADA TOMBOL "NOMINAL BERBEDA":
 *   Supaya penjagaan nominalnya bisa DIBUKTIKAN, bukan hanya diklaim.
 *   Dua tombol tambahan sengaja mengirim nominal yang kurang dan yang
 *   lebih; keduanya harus DITOLAK dan pesanannya harus tetap belum
 *   lunas. Tanpa tombol ini, satu-satunya cara membuktikannya adalah
 *   dengan alat bantu luar — dan itu berarti penjagaannya tidak pernah
 *   benar-benar dijalankan di lingkungan ini.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ikon } from "@/app/components/Ikon";
import { FormBayar } from "./FormBayar";
import { tagihanByReferensi } from "@/lib/data";
import { rupiah, tanggalPanjang } from "@/lib/format";
import { LABEL_STATUS, kelasStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Halaman pembayaran (tiruan)" };
export const dynamic = "force-dynamic";

export default async function HalamanBayar({
  params,
}: {
  params: Promise<{ referensi: string }>;
}) {
  const { referensi } = await params;
  const tagihan = await tagihanByReferensi(decodeURIComponent(referensi));
  if (!tagihan) notFound();

  const pesanan = tagihan.pesanan;
  const kedaluwarsa = tagihan.kedaluwarsa.getTime() < Date.now();

  return (
    <div className="halaman-bayar">
      <div className="bayar-kartu">
        <p className="bayar-kartu__penyedia">
          <Ikon nama="uang" ukuran={17} />
          Penyedia pembayaran <strong>tiruan</strong>
        </p>

        <h1 className="bayar-kartu__judul">Konfirmasi pembayaran</h1>

        <div className="bayar-kartu__jumlah">
          <span className="bayar-kartu__label">Jumlah tagihan</span>
          <span className="bayar-kartu__angka">{rupiah(tagihan.jumlah)}</span>
        </div>

        <dl className="bayar-kartu__rincian">
          <div>
            <dt>Pesanan</dt>
            <dd>{pesanan.nomor}</dd>
          </div>
          <div>
            <dt>Pemesan</dt>
            <dd>{pesanan.nama}</dd>
          </div>
          <div>
            <dt>Referensi tagihan</dt>
            <dd className="bayar-kartu__referensi">{tagihan.referensi}</dd>
          </div>
          <div>
            <dt>Batas bayar</dt>
            <dd>{tanggalPanjang(tagihan.kedaluwarsa)}</dd>
          </div>
          <div>
            <dt>Status tagihan</dt>
            <dd>
              <span className={kelasStatus(
                tagihan.status === "BERHASIL"
                  ? "DIBAYAR"
                  : tagihan.status === "KEDALUWARSA" || kedaluwarsa
                    ? "DIBATALKAN"
                    : "MENUNGGU_BAYAR",
              )}>
                {tagihan.status === "BERHASIL"
                  ? "Sudah dibayar"
                  : kedaluwarsa
                    ? "Kedaluwarsa"
                    : "Menunggu pembayaran"}
              </span>
            </dd>
          </div>
        </dl>

        {tagihan.status === "BERHASIL" ? (
          <div className="pesan pesan--berhasil">
            Tagihan ini sudah dibayar. Pemberitahuannya sudah diterima dan
            pesanannya sudah diteruskan ke dapur.
          </div>
        ) : kedaluwarsa ? (
          <div className="pesan pesan--galat">
            Tagihan ini sudah lewat batas waktunya. Pemberitahuan yang dikirim
            sekarang tidak akan mengubah apa pun — pesanannya sudah dibatalkan.
          </div>
        ) : (
          <FormBayar referensi={tagihan.referensi} jumlah={tagihan.jumlah} />
        )}

        <p className="bayar-kartu__catatan">
          Halaman ini meniru halaman penyedia pembayaran. Tidak ada data kartu
          yang diminta, dan tidak ada uang yang berpindah. Yang benar-benar
          terjadi: dikirimkannya pemberitahuan bertanda tangan ke{" "}
          <code>/api/webhook/pembayaran</code>, dan pesanannya berubah status
          hanya kalau tanda tangan itu sah.
        </p>

        <p className="tengah mb-0">
          <Link className="tombol tombol--putih tombol--kecil" href={`/pesanan/${pesanan.nomor}`}>
            <span className="ikon-teks">
              <Ikon nama="kiri" ukuran={16} />
              Kembali ke pesanan
            </span>
          </Link>
        </p>
      </div>

      <p className="bayar-kartu__status">
        Status pesanan sekarang: <strong>{LABEL_STATUS[pesanan.status]}</strong>
      </p>
    </div>
  );
}
