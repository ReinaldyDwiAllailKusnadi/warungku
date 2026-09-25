/**
 * app/operator/page.tsx — panel petugas (kasir & dapur).
 *
 * KENAPA PEMERIKSAAN MASUK DIPANGGIL DI HALAMAN, BUKAN LEWAT middleware:
 *   middleware Next.js berjalan di edge runtime, dan di sana Prisma
 *   tidak bisa dipakai. Memaksa memakai middleware berarti sesi harus
 *   diperiksa di tempat yang tidak bisa membaca database — padahal
 *   pemeriksaan sesi yang benar memang harus membaca database (untuk
 *   memastikan petugasnya belum dinonaktifkan). Jadi pemeriksaannya
 *   diletakkan di halaman itu sendiri.
 *
 * KENAPA TOMBOLNYA DISARING MENURUT PERAN, PADAHAL SERVER SUDAH MENOLAK:
 *   Tombol yang pasti ditolak server tidak perlu ditampilkan — menampilkan
 *   lalu menolaknya hanya membuat petugas mengira aplikasinya rusak.
 *   TAPI penyaringan tombol ini SEMATA-MATA demi tampilan. Penolakan
 *   yang sungguhan tetap ada di server (app/actions/status.ts), karena
 *   tampilan bisa dilewati: cukup dengan memanggil aksinya langsung.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/app/components/Chrome";
import { Ikon } from "@/app/components/Ikon";
import { TombolStatus } from "./TombolStatus";
import { sesiSekarang } from "@/lib/sesi";
import { daftarPesananAktif, ringkasanHariIni } from "@/lib/data";
import {
  LABEL_STATUS,
  URUTAN_STATUS,
  kelasStatus,
  langkahBerikutnya,
  bolehJalankan,
} from "@/lib/status";
import { rupiah, tanggalPendek } from "@/lib/format";

export const metadata: Metadata = { title: "Panel petugas" };
export const dynamic = "force-dynamic";

export default async function HalamanOperator() {
  const sesi = await sesiSekarang();
  if (!sesi) redirect("/masuk");

  const [pesanan, ringkas] = await Promise.all([
    daftarPesananAktif(),
    ringkasanHariIni(),
  ]);

  return (
    <Chrome>
      <div className="kepala-bagian">
        <div>
          <p className="bagian__label">
            Panel petugas · {sesi.peran === "DAPUR" ? "Dapur" : "Kasir"}
          </p>
          <h1 className="bagian__judul">Pesanan yang sedang berjalan</h1>
        </div>
        <p className="kepala-bagian__ket">
          Masuk sebagai <strong>{sesi.nama}</strong>
          {sesi.peran === "DAPUR" ? (
            <>
              {" "}
              — perannya dapur, jadi yang bisa diubah hanya status memasak.
              Pembatalan dan pengantaran diurus kasir.
            </>
          ) : (
            <> — perannya kasir, jadi semua perpindahan status bisa dilakukan.</>
          )}
        </p>
      </div>

      {/* ------------------------------------------------ ringkasan hari ini */}
      <div className="kisi-statistik">
        <div className="statistik">
          <p className="statistik__label">Pesanan hari ini</p>
          <p className="statistik__angka">{ringkas.jumlah}</p>
        </div>
        <div className="statistik">
          <p className="statistik__label">Sudah lunas</p>
          <p className="statistik__angka">{ringkas.lunas}</p>
        </div>
        <div className="statistik">
          <p className="statistik__label">Belum dibayar</p>
          <p className="statistik__angka">{ringkas.belumBayar}</p>
        </div>
        <div className="statistik">
          <p className="statistik__label">Uang masuk</p>
          <p className="statistik__angka">{rupiah(ringkas.uangMasuk)}</p>
        </div>
      </div>

      {/* ----------------------------------------------------------- daftar */}
      {pesanan.length === 0 ? (
        <div className="kartu">
          <p className="kartu__kosong">
            Tidak ada pesanan yang sedang berjalan. Pesanan muncul di sini setelah
            pembayarannya dikonfirmasi penyedia.
          </p>
        </div>
      ) : (
        <ul className="daftar-pesanan">
          {pesanan.map((p) => {
            // Semua perpindahan yang sah dari status sekarang, lalu
            // disaring lagi menurut peran petugas yang sedang masuk.
            const langkah = langkahBerikutnya(p.status);
            const bolehLangkah = langkah.filter((k) =>
              bolehJalankan(sesi.peran, p.status, k),
            );

            return (
              <li className="kartu kartu--pesanan" key={p.id}>
                <div className="pesanan-kepala">
                  <div>
                    <p className="pesanan-kepala__nomor">{p.nomor}</p>
                    <p className="pesanan-kepala__waktu">
                      {tanggalPendek(p.dibuat)} ·{" "}
                      {p.tipe === "ANTAR" ? "Diantar" : "Diambil"}
                      {p.dibayarPada
                        ? ` · lunas ${p.dibayarPada.toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Jakarta",
                          }).replace(":", ".")}`
                        : ""}
                    </p>
                  </div>
                  <span className={kelasStatus(p.status)}>
                    {LABEL_STATUS[p.status]}
                  </span>
                </div>

                <ul className="nota-daftar">
                  {p.item.map((i) => (
                    <li className="nota-baris" key={i.id}>
                      <span className="nota-baris__nama">
                        <strong>{i.jumlah}×</strong> {i.namaSaatItu}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="pesanan-kaki">
                  <div className="pesanan-kaki__pemesan">
                    <p className="mb-0">
                      <strong>{p.nama}</strong> · {p.telepon}
                    </p>
                    {p.tipe === "ANTAR" && p.alamat ? (
                      <p className="keranjang__catatan mb-0">{p.alamat}</p>
                    ) : null}
                    {p.catatan ? (
                      <p className="pesanan-kaki__catatan">
                        <Ikon nama="info" ukuran={14} />
                        {p.catatan}
                      </p>
                    ) : null}
                  </div>

                  <div className="pesanan-kaki__aksi">
                    <span className="pesanan-kaki__total">{rupiah(p.total)}</span>
                    {langkah.length === 0 ? (
                      <span className="pesanan-kaki__selesai">
                        <Ikon nama="centang" ukuran={16} />
                        Selesai
                      </span>
                    ) : bolehLangkah.length === 0 ? (
                      <span className="aksi-status__alasan">
                        <Ikon nama="info" ukuran={14} />
                        Peranmu ({sesi.peran.toLowerCase()}) tidak berwenang
                        memindahkan status ini.
                      </span>
                    ) : (
                      bolehLangkah.map((ke) => (
                        <TombolStatus
                          key={ke}
                          pesananId={p.id}
                          ke={ke}
                          boleh
                          alasan={null}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Jalan status ringkas — supaya petugas tidak perlu membuka
                    halaman pesanan hanya untuk tahu sudah sampai mana. */}
                <ol className="langkah-mini">
                  {URUTAN_STATUS.map((s) => (
                    <li
                      className={`langkah-mini__butir${
                        URUTAN_STATUS.indexOf(s) <= URUTAN_STATUS.indexOf(p.status)
                          ? " langkah-mini__butir--lewat"
                          : ""
                      }`}
                      key={s}
                    >
                      {LABEL_STATUS[s]}
                    </li>
                  ))}
                </ol>

                <Link
                  className="kartu__tautan"
                  href={`/pesanan/${p.nomor}`}
                >
                  Buka halaman pesanan
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Chrome>
  );
}
