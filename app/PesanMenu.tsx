"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { pesanAction, type HasilForm } from "./actions/pesan";
import {
  BIAYA_ANTAR,
  GRATIS_ANTAR_DI_ATAS,
  MAKS_PER_ITEM,
  hitungSemua,
  type BarisLengkap,
  type TipePesan,
} from "@/lib/menu";
import { rupiah } from "@/lib/format";
import { Ikon } from "./components/Ikon";

/**
 * PesanMenu.tsx — daftar menu, keranjang, dan formulir pemesanan.
 *
 * KENAPA ANGKA DI LAYAR DIHITUNG MENGGUNAKAN FUNGSI YANG SAMA DENGAN SERVER:
 *   lib/menu.ts adalah fungsi murni tanpa database, jadi peramban boleh
 *   memakainya. Server tetap menghitung ulang saat menyimpan — nilai dari
 *   peramban tidak pernah disimpan. Kalau keduanya memakai rumus
 *   masing-masing, cepat atau lambat angkanya berbeda, dan pelanggan
 *   melihat angka yang berbeda dari yang ditagih.
 *
 * KENAPA KERANJANGNYA HANYA MENYIMPAN ID DAN JUMLAH, TANPA HARGA:
 *   Karena harga yang dikirim peramban tidak dipercaya. Yang dikirim ke
 *   server hanyalah { menuId, jumlah }; harga diambil server dari
 *   database. Perhatikan bentuk state di bawah: tidak ada satu pun
 *   angka rupiah di dalamnya.
 */

export type MenuKlien = {
  id: string;
  nama: string;
  keterangan: string | null;
  harga: number;
  pedas: number;
  tersedia: boolean;
};

export type KategoriKlien = { id: string; nama: string; menu: MenuKlien[] };

const IKON_KATEGORI: Record<string, "mangkuk" | "gelas" | "kotak" | "daftar"> = {
  Makanan: "mangkuk",
  Minuman: "gelas",
  Camilan: "daftar",
  Paket: "kotak",
};

/** Keranjang: menuId -> jumlah porsi. TANPA harga. */
type Keranjang = Record<string, number>;

function TombolKirim({ mati }: { mati: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="tombol tombol--penuh" type="submit" disabled={pending || mati}>
      {pending ? "Menyimpan pesanan…" : "Buat pesanan & bayar"}
    </button>
  );
}

export function PesanMenu({ katalog }: { katalog: KategoriKlien[] }) {
  const [keranjang, setKeranjang] = useState<Keranjang>({});
  const [tipe, setTipe] = useState<TipePesan>("DIAMBIL");
  const [hasil, kirim] = useActionState<HasilForm | undefined, FormData>(
    pesanAction,
    undefined,
  );

  const semuaMenu = useMemo(
    () => katalog.flatMap((k) => k.menu),
    [katalog],
  );

  // Baris keranjang yang sudah dilengkapi harga — supaya fungsi
  // perhitungan yang sama bisa dipakai seperti di server.
  const barisLengkap: BarisLengkap[] = useMemo(() => {
    return Object.entries(keranjang)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const m = semuaMenu.find((x) => x.id === id);
        if (!m) return null;
        return {
          menuId: m.id,
          jumlah: n,
          namaSaatItu: m.nama,
          hargaSaatItu: m.harga,
        };
      })
      .filter((b): b is BarisLengkap => b !== null);
  }, [keranjang, semuaMenu]);

  const { subtotal, biayaAntar, total } = useMemo(
    () => hitungSemua(barisLengkap, tipe),
    [barisLengkap, tipe],
  );

  const jumlahPorSi = barisLengkap.reduce((a, b) => a + b.jumlah, 0);
  const kurangUntukGratis = Math.max(0, GRATIS_ANTAR_DI_ATAS - subtotal);

  function ubah(menuId: string, delta: number) {
    setKeranjang((k) => {
      const sekarang = k[menuId] ?? 0;
      const baru = Math.min(MAKS_PER_ITEM, Math.max(0, sekarang + delta));
      const salinan = { ...k };
      if (baru === 0) delete salinan[menuId];
      else salinan[menuId] = baru;
      return salinan;
    });
  }

  const kosong = barisLengkap.length === 0;

  return (
    <div className={`pemesanan${kosong ? "" : " pemesanan--ada-keranjang"}`}>
      {/* ---------------------------------------------- daftar menu */}
      <div className="pemesanan__menu" id="menu">
        {/* Di ponsel daftar menunya 2.456px — lebih dari tiga layar.
            Tanpa jalan pintas, orang yang cuma mau minum harus melewati
            semua makanan dulu untuk sampai ke bagian minuman. */}
        <nav className="menu-lompat" aria-label="Lompat ke kategori menu">
          {katalog.map((k) => (
            <a className="menu-lompat__butir" href={`#kategori-${k.id}`} key={k.id}>
              {k.nama}
            </a>
          ))}
        </nav>
        {katalog.map((k) => (
          <section className="menu-bagian" id={`kategori-${k.id}`} key={k.id}>
            <h3 className="menu-bagian__judul">
              <Ikon nama={IKON_KATEGORI[k.nama] ?? "daftar"} ukuran={18} />
              {k.nama}
            </h3>

            <ul className="menu-daftar">
              {k.menu.map((m) => {
                const n = keranjang[m.id] ?? 0;
                return (
                  <li
                    className={`menu-baris${m.tersedia ? "" : " menu-baris--kosong"}`}
                    key={m.id}
                  >
                    <div className="menu-baris__teks">
                      <p className="menu-baris__nama">
                        {m.nama}
                        {m.pedas > 0 ? (
                          <span
                            className={`pedas pedas--${m.pedas}`}
                            title={`Tingkat pedas ${m.pedas} dari 3`}
                          >
                            <span className="sr-only">
                              Tingkat pedas {m.pedas} dari 3
                            </span>
                          </span>
                        ) : null}
                      </p>
                      {m.keterangan ? (
                        <p className="menu-baris__ket">{m.keterangan}</p>
                      ) : null}
                      {!m.tersedia ? (
                        <p className="menu-baris__habis">Sedang tidak tersedia</p>
                      ) : null}
                    </div>

                    <div className="menu-baris__aksi">
                      <span className="menu-baris__harga">{rupiah(m.harga)}</span>
                      {m.tersedia ? (
                        n === 0 ? (
                          <button
                            type="button"
                            className="tombol tombol--kecil tombol--putih"
                            onClick={() => ubah(m.id, 1)}
                          >
                            Tambah
                          </button>
                        ) : (
                          <span className="jumlah">
                            <button
                              type="button"
                              className="jumlah__tombol"
                              onClick={() => ubah(m.id, -1)}
                              aria-label={`Kurangi ${m.nama}`}
                            >
                              −
                            </button>
                            <span className="jumlah__nilai">{n}</span>
                            <button
                              type="button"
                              className="jumlah__tombol"
                              onClick={() => ubah(m.id, 1)}
                              disabled={n >= MAKS_PER_ITEM}
                              aria-label={`Tambah ${m.nama}`}
                            >
                              +
                            </button>
                          </span>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* ---------------------------------------------- keranjang */}
      <aside className="pemesanan__keranjang" id="pesan">
        <div className="keranjang">
          <h3 className="keranjang__judul">
            <Ikon nama="nota" ukuran={18} />
            Pesananmu
          </h3>

          {kosong ? (
            <p className="keranjang__kosong">
              Belum ada yang dipilih. Tekan <strong>Tambah</strong> pada menu di
              sebelah.
            </p>
          ) : (
            <ul className="keranjang__daftar">
              {barisLengkap.map((b) => (
                <li className="keranjang__baris" key={b.menuId}>
                  <span className="keranjang__nama">
                    {b.namaSaatItu}
                    <span className="keranjang__kali"> × {b.jumlah}</span>
                  </span>
                  <span className="keranjang__harga">
                    {rupiah(b.hargaSaatItu * b.jumlah)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="keranjang__hitungan">
            <div className="keranjang__larik">
              <dt>Subtotal</dt>
              <dd>{rupiah(subtotal)}</dd>
            </div>
            <div className="keranjang__larik">
              <dt>{tipe === "ANTAR" ? "Ongkos kirim" : "Diambil sendiri"}</dt>
              <dd>{biayaAntar === 0 ? "Gratis" : rupiah(biayaAntar)}</dd>
            </div>
            <div className="keranjang__larik keranjang__larik--total">
              <dt>Total</dt>
              <dd>{rupiah(total)}</dd>
            </div>
          </dl>

          {tipe === "ANTAR" && kurangUntukGratis > 0 ? (
            <p className="keranjang__petunjuk">
              Tambah {rupiah(kurangUntukGratis)} lagi supaya ongkos kirimnya gratis.
            </p>
          ) : null}

          {/* ------------------------------------------ formulir */}
          <form action={kirim} className="keranjang__form" id="form-pesan">
            {/* Yang dikirim hanya menu apa dan berapa porsi — TANPA harga. */}
            <input
              type="hidden"
              name="keranjang"
              value={JSON.stringify(
                barisLengkap.map((b) => ({ menuId: b.menuId, jumlah: b.jumlah })),
              )}
            />
            <input type="hidden" name="tipe" value={tipe} />

            <div className="pilihan-tipe">
              <label
                className={`pilihan-tipe__opsi${tipe === "DIAMBIL" ? " pilihan-tipe__opsi--aktif" : ""}`}
              >
                <input
                  type="radio"
                  name="tipeTampil"
                  checked={tipe === "DIAMBIL"}
                  onChange={() => setTipe("DIAMBIL")}
                />
                <span className="ikon-teks">
                  <Ikon nama="meja" ukuran={16} />
                  Ambil di warung
                </span>
              </label>
              <label
                className={`pilihan-tipe__opsi${tipe === "ANTAR" ? " pilihan-tipe__opsi--aktif" : ""}`}
              >
                <input
                  type="radio"
                  name="tipeTampil"
                  checked={tipe === "ANTAR"}
                  onChange={() => setTipe("ANTAR")}
                />
                <span className="ikon-teks">
                  <Ikon nama="kotak" ukuran={16} />
                  Diantar
                </span>
              </label>
            </div>

            <div className="isian">
              <label htmlFor="nama">Nama</label>
              <input
                id="nama"
                type="text"
                name="nama"
                required
                maxLength={60}
                placeholder="Nama untuk memanggil pesananmu"
              />
            </div>

            <div className="isian">
              <label htmlFor="telepon">Nomor WhatsApp</label>
              <input
                id="telepon"
                type="text"
                name="telepon"
                required
                inputMode="tel"
                maxLength={20}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {tipe === "ANTAR" ? (
              <div className="isian">
                <label htmlFor="alamat">Alamat pengantaran</label>
                <textarea
                  id="alamat"
                  name="alamat"
                  rows={3}
                  maxLength={300}
                  placeholder="Jalan, nomor rumah, RT/RW, patokan"
                />
              </div>
            ) : null}

            <div className="isian">
              <label htmlFor="catatan">
                Catatan <span className="petunjuk-kecil">(boleh dikosongkan)</span>
              </label>
              <input
                id="catatan"
                type="text"
                name="catatan"
                maxLength={300}
                placeholder="Misalnya: tanpa pedas, sambal dipisah"
              />
            </div>

            {hasil && !hasil.ok ? (
              <p className="pesan pesan--galat" role="alert">
                {hasil.galat}
              </p>
            ) : null}

            <TombolKirim mati={kosong} />

            <p className="keranjang__catatan">
              Belum ada pembayaran di langkah ini. Setelah ditekan, kamu diarahkan
              ke halaman bayar — pesanannya baru masuk dapur setelah pembayaran
              dikonfirmasi.
            </p>
          </form>
        </div>
      </aside>

      {/* Bilah keranjang untuk ponsel.
          KENAPA ADA: terukur pada 390px, formulir pesan berada 3.720px
          dari atas — 4,4 layar. Orang yang sudah memilih menu lalu harus
          menggulir lebih dari empat layar untuk membayarnya biasanya
          berhenti di tengah. Bilah ini membuat langkah berikutnya selalu
          berada dalam jangkauan jempol, dan angkanya ikut terlihat
          supaya tidak perlu menggulir ke atas hanya untuk tahu totalnya. */}
      {!kosong ? (
        <div className="bar-keranjang">
          <div className="bar-keranjang__teks">
            <span className="bar-keranjang__jumlah">
              {jumlahPorSi} item
            </span>
            <span className="bar-keranjang__total">{rupiah(total)}</span>
          </div>
          <button
            type="button"
            className="tombol tombol--kecil"
            onClick={() =>
              document
                .getElementById("form-pesan")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Lanjut pesan
          </button>
        </div>
      ) : null}
    </div>
  );
}
