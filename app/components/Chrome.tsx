/**
 * Chrome.tsx — kerangka halaman: kepala, isi, kaki.
 *
 * Server component karena ia membaca sesi (cookie + database). Kalau
 * dijadikan komponen klien, pembacaan sesi terjadi di peramban dan
 * setiap halaman harus menunggu data sesi datang lewat jaringan setelah
 * halaman tampil — kedipan yang tidak perlu, dan itu terasa.
 *
 * KENAPA "PESAN SEKARANG" DIBUAT TOMBOL, BUKAN TAUTAN BIASA:
 *   Ada tiga tautan di menu dan hanya satu yang perlu dilakukan hampir
 *   semua pengunjung. Kalau semuanya tampak sama, yang paling penting
 *   justru tenggelam di antara yang tidak penting. "Masuk petugas"
 *   sengaja dibiarkan tenang — itu pintu untuk petugas, bukan sesuatu
 *   yang perlu dilakukan pelanggan.
 *
 * KELAS CSS: semua nama kelas di sini sudah ada di app/globals.css.
 * Kelas yang dikarang di TSX tidak akan bergaya apa pun dan hasilnya
 * halaman yang tampak rusak TANPA pesan galat apa pun.
 */

import Link from "next/link";
import { sesiSekarang } from "@/lib/sesi";
import { Ikon } from "./Ikon";
import { TombolKeluar } from "./TombolKeluar";

export async function Chrome({ children }: { children: React.ReactNode }) {
  const sesi = await sesiSekarang();

  return (
    <>
      {/* Tautan lompat: pengguna papan ketik dan pembaca layar tidak perlu
          menelusuri seluruh menu di setiap halaman untuk sampai ke isi. */}
      <a className="lewati" href="#isi">
        Lompat ke isi
      </a>

      <header className="kepala">
        <Link href="/" className="kepala__merek">
          <Ikon nama="mangkuk" ukuran={19} />
          Warung<span>ku</span>
        </Link>

        <nav className="kepala__nav" aria-label="Menu utama">
          <Link href="/#menu">Menu</Link>
          <Link href="/cara-bayar">Cara bayar</Link>
          <Link href="/lacak">Lacak pesanan</Link>
        </nav>

        <div className="kepala__aksi">
          <Link className="tombol tombol--kecil kepala__ajakan" href="/#pesan">
            Pesan sekarang
          </Link>

          {sesi ? (
            <>
              <Link className="kepala__masuk" href="/operator">
                <span className="ikon-teks">
                  <Ikon nama="meja" ukuran={16} />
                  {sesi.nama.split(" ")[0]}
                </span>
              </Link>
              <TombolKeluar />
            </>
          ) : (
            <Link className="kepala__masuk" href="/masuk">
              Masuk petugas
            </Link>
          )}
        </div>
      </header>

      <main id="isi" className="bungkus">
        {children}
      </main>

      <footer className="kaki">
        <div className="kaki__isi">
          <div>
            <div className="kaki__merek">
              Warung<span>ku</span>
            </div>
            <p className="kaki__ket">
              Proyek latihan fullstack. <strong>Pembayarannya tiruan</strong> —
              tidak ada uang yang benar-benar berpindah, dan tidak ada data kartu
              yang diminta maupun disimpan. Nama menu dan harganya juga contoh.
            </p>
          </div>
          <nav className="kaki__nav" aria-label="Menu kaki">
            <Link href="/#menu">Menu</Link>
            <Link href="/cara-bayar">Cara bayar</Link>
            <Link href="/lacak">Lacak pesanan</Link>
            <Link href="/masuk">Masuk petugas</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
