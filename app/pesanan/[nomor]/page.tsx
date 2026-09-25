/**
 * app/pesanan/[nomor]/page.tsx — status satu pesanan.
 *
 * Halaman ini yang dibuka pelanggan setelah memesan, dan yang dibiarkan
 * terbuka sambil menunggu pembayarannya dikonfirmasi.
 *
 * KENAPA NOMOR PESANAN BOLEH JADI ALAMAT HALAMANNYA:
 *   Pelanggan tidak punya akun di sini — memaksakan akun hanya untuk
 *   melihat status pesanan makanan jauh lebih merepotkan daripada
 *   manfaatnya. Nomornya memuat tahun dan urutan, tapi tidak memuat
 *   data pribadi apa pun: nama, nomor telepon, dan alamat hanya muncul
 *   di dalam halaman, bukan di alamatnya. Jadi tautannya boleh
 *   dibagikan tanpa ikut membocorkan siapa pemesannya.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chrome } from "@/app/components/Chrome";
import { Ikon } from "@/app/components/Ikon";
import { SegarkanOtomatis } from "./SegarkanOtomatis";
import { pesananByNomor } from "@/lib/data";
import { kelasStatus, LABEL_STATUS, URUTAN_STATUS } from "@/lib/status";
import { rupiah, tanggalPendek, tanggalPanjang } from "@/lib/format";

export const metadata: Metadata = { title: "Status pesanan" };

// Halaman ini menampilkan status yang berubah karena kejadian di luar
// (webhook dari penyedia pembayaran), jadi tidak boleh di-cache.
export const dynamic = "force-dynamic";

export default async function HalamanPesanan({
  params,
}: {
  params: Promise<{ nomor: string }>;
}) {
  const { nomor } = await params;
  const pesanan = await pesananByNomor(decodeURIComponent(nomor));
  if (!pesanan) notFound();

  const tagihanAktif = pesanan.pembayaran.find((p) => p.status === "MENUNGGU");
  const sudahDibayar = pesanan.status !== "MENUNGGU_BAYAR" && pesanan.status !== "DIBATALKAN";

  const langkah = URUTAN_STATUS.indexOf(pesanan.status);

  return (
    <Chrome>
      <div className="bungkus--sempit">
        <p className="bagian__label">Status pesanan</p>
        <div className="status-kepala">
          <h1 className="status-kepala__nomor">{pesanan.nomor}</h1>
          <span className={kelasStatus(pesanan.status)}>
            {LABEL_STATUS[pesanan.status]}
          </span>
        </div>

        {/* ---------------------------------------------------- langkah */}
        {pesanan.status !== "DIBATALKAN" ? (
          <ol className="langkah-jalan">
            {URUTAN_STATUS.map((s, i) => (
              <li
                className={`langkah-jalan__butir${
                  i < langkah ? " langkah-jalan__butir--lewat" : ""
                }${i === langkah ? " langkah-jalan__butir--kini" : ""}`}
                key={s}
              >
                <span className="langkah-jalan__titik">
                  {i < langkah ? <Ikon nama="centang" ukuran={13} /> : null}
                </span>
                <span className="langkah-jalan__label">{LABEL_STATUS[s]}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pesan pesan--galat">
            Pesanan ini dibatalkan karena pembayarannya tidak diselesaikan sebelum
            batas waktunya. Silakan buat pesanan baru.
          </p>
        )}

        {/* -------------------------------------------------- bayar/harga */}
        {pesanan.status === "MENUNGGU_BAYAR" ? (
          <div className="kartu-bayar">
            <div className="kartu-bayar__teks">
              <p className="kartu-bayar__judul">Menunggu pembayaran</p>
              <p className="kartu-bayar__ket">
                Batas bayar {tanggalPanjang(pesanan.kedaluwarsa)} pukul{" "}
                {pesanan.kedaluwarsa
                  .toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })
                  .replace(":", ".")}{" "}
                WIB. Kalau lewat, pesanannya batal sendiri — supaya menunya tidak
                tertahan.
              </p>
            </div>
            {tagihanAktif ? (
              <Link
                className="tombol tombol--besar"
                href={`/bayar/${tagihanAktif.referensi}`}
              >
                <span className="ikon-teks">
                  <Ikon nama="uang" ukuran={18} />
                  Bayar {rupiah(pesanan.total)}
                </span>
              </Link>
            ) : (
              <p className="kartu-bayar__ket">Tagihan belum terbentuk.</p>
            )}
          </div>
        ) : null}

        {sudahDibayar && pesanan.dibayarPada ? (
          <div className="kartu-bayar kartu-bayar--lunas">
            <div className="kartu-bayar__teks">
              <p className="kartu-bayar__judul">
                <Ikon nama="centang" ukuran={18} />
                Pembayaran diterima
              </p>
              <p className="kartu-bayar__ket">
                Dikonfirmasi {tanggalPendek(pesanan.dibayarPada)} pukul{" "}
                {pesanan.dibayarPada
                  .toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  })
                  .replace(":", ".")}{" "}
                WIB. Pesananmu sudah diteruskan ke dapur.
              </p>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------------- rincian */}
        <div className="kartu">
          <h2 className="kartu__judul">Rincian</h2>
          <ul className="nota-daftar">
            {pesanan.item.map((i) => (
              <li className="nota-baris" key={i.id}>
                <span className="nota-baris__nama">
                  {i.namaSaatItu}
                  <span className="nota-baris__kali"> × {i.jumlah}</span>
                </span>
                <span className="nota-baris__harga">
                  {rupiah(i.hargaSaatItu * i.jumlah)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="nota-total">
            <div className="nota-total__larik">
              <dt>Subtotal</dt>
              <dd>{rupiah(pesanan.subtotal)}</dd>
            </div>
            <div className="nota-total__larik">
              <dt>{pesanan.tipe === "ANTAR" ? "Ongkos kirim" : "Diambil sendiri"}</dt>
              <dd>
                {pesanan.biayaAntar === 0 ? "Gratis" : rupiah(pesanan.biayaAntar)}
              </dd>
            </div>
            <div className="nota-total__larik nota-total__larik--total">
              <dt>Total</dt>
              <dd>{rupiah(pesanan.total)}</dd>
            </div>
          </dl>

          <div className="dua-daftar mt-2">
            <div>
              <p className="label-kecil">Pemesan</p>
              <p className="mb-0">
                {pesanan.nama}
                <br />
                {pesanan.telepon}
              </p>
            </div>
            <div>
              <p className="label-kecil">
                {pesanan.tipe === "ANTAR" ? "Diantar ke" : "Cara pengambilan"}
              </p>
              <p className="mb-0">
                {pesanan.tipe === "ANTAR" ? pesanan.alamat : "Ambil di warung"}
              </p>
            </div>
          </div>

          {pesanan.catatan ? (
            <p className="keranjang__catatan">
              <strong>Catatan:</strong> {pesanan.catatan}
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------------- riwayat */}
        <div className="kartu">
          <h2 className="kartu__judul">Riwayat</h2>
          <ul className="riwayat">
            {pesanan.peristiwa.map((p) => (
              <li className="riwayat__butir" key={p.id}>
                <span className="riwayat__waktu">{tanggalPendek(p.waktu)}</span>
                <span className="riwayat__teks">
                  {LABEL_STATUS[p.ke]}
                  <span className="riwayat__sebab"> · {p.sebab}</span>
                  {p.oleh ? <span className="riwayat__sebab"> · {p.oleh}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="keranjang__catatan">
            Riwayat ini juga yang dipakai petugas untuk menjawab kalau kamu
            bertanya kenapa pesanannya belum jalan.
          </p>
        </div>

        <p className="tengah mt-2 mb-0">
          <Link className="tombol tombol--putih" href="/">
            Pesan lagi
          </Link>
        </p>

        {/* Halaman ini disegarkan sendiri selama belum dibayar, karena
            perubahannya datang dari luar (pemberitahuan penyedia). */}
        {pesanan.status === "MENUNGGU_BAYAR" ? <SegarkanOtomatis /> : null}
      </div>
    </Chrome>
  );
}
