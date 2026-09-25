/**
 * app/page.tsx — halaman utama Warungku.
 *
 * SUSUNANNYA SENGAJA PENDEK DAN LANGSUNG:
 *   Hero kecil, lalu menu, lalu keranjang di sebelahnya. Tidak ada
 *   bagian pengantar panjang sebelum orang bisa memesan.
 *
 *   Ini pelajaran dari proyek sebelumnya: halaman utama di sana tumbuh
 *   sampai 10.000px karena semua rincian ditaruh di depan, dan
 *   formulirnya — satu-satunya hal yang perlu dilakukan pengunjung —
 *   jadi terkubur di paling bawah. Untuk warung, orang datang untuk
 *   melihat menu dan memesan; apa pun yang menghalangi itu adalah
 *   gangguan.
 */

import type { Metadata } from "next";
import { Chrome } from "./components/Chrome";
import { Ikon } from "./components/Ikon";
import { PesanMenu } from "./PesanMenu";
import { katalog } from "@/lib/data";
import { BIAYA_ANTAR, GRATIS_ANTAR_DI_ATAS } from "@/lib/menu";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Warungku — pesan makanan, bayar daring",
  description:
    "Pilih menu, bayar, lalu ambil di warung atau minta diantar. Pembayaran daring dengan konfirmasi otomatis.",
};

export default async function Beranda() {
  const katalogData = await katalog();

  const jumlahMenu = katalogData.reduce((a, k) => a + k.menu.length, 0);
  const jumlahTersedia = katalogData.reduce(
    (a, k) => a + k.menu.filter((m) => m.tersedia).length,
    0,
  );

  return (
    <Chrome>
      {/* ---------- Pembuka ---------- */}
      <section className="pembuka">
        <div className="pembuka__teks">
          <p className="pembuka__label">Warung makan · buka 08.00–21.00</p>
          <h1 className="pembuka__judul">
            Pesan dari meja, atau dari rumah.
          </h1>
          <p className="pembuka__ket">
            {jumlahTersedia} dari {jumlahMenu} menu sedang tersedia. Ambil sendiri
            di warung, atau minta diantar — gratis untuk pesanan di atas{" "}
            {rupiah(GRATIS_ANTAR_DI_ATAS)}, di bawah itu ongkos kirimnya{" "}
            {rupiah(BIAYA_ANTAR)}.
          </p>
        </div>

        <ul className="pembuka__cara">
          <li className="cara-langkah">
            <span className="cara-langkah__nomor">1</span>
            <div>
              <p className="cara-langkah__judul">Pilih menu</p>
              <p className="cara-langkah__ket">Tekan Tambah pada yang mau dipesan.</p>
            </div>
          </li>
          <li className="cara-langkah">
            <span className="cara-langkah__nomor">2</span>
            <div>
              <p className="cara-langkah__judul">Bayar</p>
              <p className="cara-langkah__ket">
                Lewat halaman pembayaran, bukan di sini.
              </p>
            </div>
          </li>
          <li className="cara-langkah">
            <span className="cara-langkah__nomor">3</span>
            <div>
              <p className="cara-langkah__judul">Kami masak</p>
              <p className="cara-langkah__ket">
                Pesanan masuk dapur setelah pembayaran dikonfirmasi.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* ---------- Menu & keranjang ---------- */}
      <section className="bagian">
        <div className="kepala-bagian">
          <div>
            <p className="bagian__label">Menu</p>
            <h2 className="bagian__judul">Semua yang bisa dipesan hari ini</h2>
          </div>
          <p className="kepala-bagian__ket">
            Harga di bawah sudah termasuk pajak. Belum ada pembayaran di halaman
            ini — keranjangmu dibawa ke halaman bayar lebih dulu.
          </p>
        </div>

        <PesanMenu katalog={katalogData} />
      </section>

      {/* ---------- Catatan kejujuran ---------- */}
      <section className="bagian">
        <div className="catatan-uji">
          <span className="catatan-uji__ikon">
            <Ikon nama="info" ukuran={18} />
          </span>
          <div>
            <p className="catatan-uji__judul">Pembayarannya tiruan</p>
            <p className="catatan-uji__isi">
              Ini proyek latihan, bukan warung sungguhan. Alur pembayarannya
              lengkap — tagihan, halaman bayar, pemberitahuan bertanda tangan,
              dan status yang berubah sendiri — tetapi tidak ada uang yang
              berpindah dan tidak ada data kartu yang diminta. Halaman{" "}
              <a href="/cara-bayar">Cara bayar</a> menjelaskan bagian mana yang
              tiruan dan apa yang berubah kalau memakai penyedia sungguhan.
            </p>
          </div>
        </div>
      </section>
    </Chrome>
  );
}
