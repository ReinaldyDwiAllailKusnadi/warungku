import type { Metadata } from "next";
import Link from "next/link";
import { Chrome } from "@/app/components/Chrome";
import { Ikon } from "@/app/components/Ikon";
import { BIAYA_ANTAR, GRATIS_ANTAR_DI_ATAS, MENIT_KEDALUWARSA } from "@/lib/menu";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Cara bayar — Warungku",
  description:
    "Alur pembayaran Warungku, dan bagian mana yang tiruan pada proyek latihan ini.",
};

/**
 * app/cara-bayar/page.tsx — halaman penjelasan alur pembayaran.
 *
 * KENAPA HALAMAN INI HARUS ADA:
 *   Situs yang meminta orang memasukkan data pembayaran tanpa
 *   menjelaskan apa yang terjadi sesudahnya adalah situs yang tidak bisa
 *   dipercaya. Di sini ada satu hal tambahan yang wajib dijelaskan:
 *   pembayarannya TIRUAN. Kalau tidak ditulis, orang yang membuka
 *   proyek ini bisa mengira uangnya benar-benar berpindah — dan itu
 *   kesalahpahaman yang akibatnya jauh lebih serius daripada tampilan
 *   yang kurang rapi.
 *
 * Halaman ini juga tempat menuliskan hal-hal yang biasanya hanya ada di
 * kepala orang yang membangunnya: ongkos kirim, batas waktu bayar, dan
 * apa yang terjadi kalau pembayarannya telat.
 */

const LANGKAH = [
  {
    judul: "Pilih menu",
    isi: "Tekan Tambah pada menu yang mau dipesan. Keranjangnya tersimpan di peramban, belum di server — jadi belum ada apa pun yang tercatat sebelum kamu menekan tombol buat pesanan.",
  },
  {
    judul: "Pesanan dibuat dan terkunci harganya",
    isi: "Saat pesanan dibuat, server membaca ulang harga setiap menu dari database dan menyimpannya ke dalam pesanan. Harga yang tersimpan itu yang dipakai seterusnya, jadi harga di halaman ini tidak ikut berubah kalau nanti harga menunya kami naikkan.",
  },
  {
    judul: "Bayar di halaman pembayaran",
    isi: "Kamu diarahkan ke halaman penyedia pembayaran. Warung tidak melihat dan tidak menyimpan data pembayaranmu.",
  },
  {
    judul: "Pembayaran dikonfirmasi",
    isi: "Penyedia mengirim pemberitahuan ke warung, dan pesananmu baru masuk dapur setelah pemberitahuan itu diterima.",
  },
];

export default function HalamanCaraBayar() {
  return (
    <Chrome>
      <div className="bungkus--sempit">
        <p className="bagian__label">Cara bayar</p>
        <h1 className="bagian__judul">Dari memilih menu sampai masuk dapur</h1>
        <p className="bagian__ket">
          Empat langkah, dan satu hal penting di akhir: pembayarannya tiruan.
        </p>

        {/* Pemberitahuan jujur ditaruh di ATAS, bukan di catatan kaki.
            Ini satu-satunya hal di halaman ini yang perlu dibaca semua
            orang sebelum menekan tombol apa pun. */}
        <div className="catatan-uji catatan-uji--tegas">
          <span className="catatan-uji__ikon">
            <Ikon nama="info" ukuran={18} />
          </span>
          <div>
            <p className="catatan-uji__judul">
              Ini alur pembayaran tiruan, untuk latihan
            </p>
            <p className="catatan-uji__isi">
              Penyedianya tiruan: pesanan tidak pernah keluar dari server ini.
              Halaman pembayaran yang kamu lihat dibuat di aplikasi yang sama,
              bukan di server penyedia sungguhan. Tidak ada uang yang berpindah,
              tidak ada data kartu yang diminta, dan tidak ada makanan yang
              benar-benar dimasak.
            </p>
          </div>
        </div>

        <ol className="daftar-langkah">
          {LANGKAH.map((l, i) => (
            <li className="langkah-penuh" key={l.judul}>
              <span className="langkah-penuh__nomor">{i + 1}</span>
              <div>
                <p className="langkah-penuh__judul">{l.judul}</p>
                <p className="langkah-penuh__isi">{l.isi}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="kartu">
          <h2 className="kartu__judul">Angka-angkanya</h2>
          <dl className="nota-total">
            <div className="nota-total__larik">
              <dt>Ongkos kirim</dt>
              <dd>{rupiah(BIAYA_ANTAR)}</dd>
            </div>
            <div className="nota-total__larik">
              <dt>Gratis ongkos kirim</dt>
              <dd>untuk pesanan mulai {rupiah(GRATIS_ANTAR_DI_ATAS)}</dd>
            </div>
            <div className="nota-total__larik">
              <dt>Batas waktu bayar</dt>
              <dd>{MENIT_KEDALUWARSA} menit</dd>
            </div>
          </dl>
          <p className="keranjang__catatan">
            Lewat dari {MENIT_KEDALUWARSA} menit, pesanannya batal sendiri.
            Alasannya sederhana: pesanan yang menggantung membuat menunya
            tertahan, dan dapur tidak bisa tahu apakah perlu dimasak atau tidak.
          </p>
        </div>

        <div className="kartu">
          <h2 className="kartu__judul">Yang benar-benar terjadi di belakang</h2>
          <ul className="daftar-poin">
            <li>
              <strong>Harga tidak pernah datang dari peramban.</strong> Yang
              dikirim hanya menu apa dan berapa porsi; harganya diambil server
              dari database.
            </li>
            <li>
              <strong>Pemberitahuan pembayaran diperiksa tanda tangannya.</strong>{" "}
              Setiap pemberitahuan membawa tanda tangan HMAC yang dihitung dari
              isi mentahnya. Kalau isinya diubah satu huruf saja, tanda tangannya
              tidak lagi cocok dan pemberitahuannya ditolak.
            </li>
            <li>
              <strong>Pemberitahuan kembar tidak menagih dua kali.</strong> Setiap
              pemberitahuan punya id peristiwanya sendiri, dan id itu disimpan
              dengan batasan unik. Pemberitahuan yang sama datang dua kali — hal
              yang sangat sering terjadi pada penyedia sungguhan — dikenali dan
              tidak mengubah apa pun untuk kedua kalinya.
            </li>
            <li>
              <strong>Nominalnya harus cocok sampai rupiah terakhir.</strong>{" "}
              Pemberitahuan bertanda tangan sah yang membawa nominal berbeda tetap
              ditolak. Bisa dicoba sendiri di halaman bayar.
            </li>
            <li>
              <strong>Statusnya hanya bisa berjalan maju.</strong> Pesanan yang
              belum dibayar tidak bisa langsung masuk dapur, dan pesanan yang sudah
              dibayar tidak bisa dibatalkan — yang belum punya cara mengembalikan
              uang sebaiknya tidak disediakan tombolnya.
            </li>
          </ul>
        </div>

        <p className="tengah">
          <Link className="tombol" href="/#pesan">
            Coba alurnya
          </Link>
        </p>
      </div>
    </Chrome>
  );
}
