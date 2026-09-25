import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chrome } from "@/app/components/Chrome";
import { Ikon } from "@/app/components/Ikon";

export const metadata: Metadata = { title: "Lacak pesanan" };

/**
 * app/lacak/page.tsx — mencari pesanan dengan nomornya.
 *
 * KENAPA PERLU ADA, PADAHAL SUDAH ADA HALAMAN STATUS:
 *   Halaman status hanya bisa dibuka kalau tautannya masih ada. Orang
 *   yang menutup tabnya, atau yang memesan dari ponsel lalu pindah ke
 *   komputer, tidak punya jalan kembali ke pesanannya. Tanpa halaman
 *   ini, satu-satunya cara adalah menelepon warung.
 *
 * Nomornya sengaja BUKAN satu-satunya bukti kepemilikan: kasir tetap
 * bisa membuka semua pesanan dari panelnya. Yang tidak ada di sini
 * adalah daftar pesanan — halaman ini hanya membuka satu pesanan yang
 * nomornya sudah diketahui, jadi tidak ada cara menyisir pesanan orang
 * lain dari sini.
 */

async function cari(data: FormData) {
  "use server";
  const nomor = String(data.get("nomor") ?? "").trim();
  // Bentuknya diperiksa sekilas supaya salah ketik kecil tidak
  // menghasilkan halaman "tidak ditemukan" yang membingungkan.
  if (!/^[A-Z]{2}-\d{4}-\d{4}$/i.test(nomor)) {
    redirect("/lacak?galat=bentuk");
  }
  redirect(`/pesanan/${encodeURIComponent(nomor.toUpperCase())}`);
}

export default async function HalamanLacak({
  searchParams,
}: {
  searchParams: Promise<{ galat?: string }>;
}) {
  const { galat } = await searchParams;

  return (
    <Chrome>
      <div className="bungkus--sempit">
        <div className="kartu kartu--masuk">
          <p className="bagian__label">Lacak pesanan</p>
          <h1 className="bagian__judul">Di mana pesananku?</h1>
          <p className="bagian__ket">
            Masukkan nomor pesanan yang kamu terima setelah memesan. Bentuknya
            seperti <code>WR-2026-0001</code>.
          </p>

          {galat === "bentuk" ? (
            <p className="pesan pesan--galat" role="alert">
              <span className="ikon-teks">
                <Ikon nama="info" ukuran={16} />
                Bentuk nomornya belum benar. Contoh yang benar: WR-2026-0001.
              </span>
            </p>
          ) : null}

          <form action={cari}>
            <div className="isian">
              <label htmlFor="nomor">Nomor pesanan</label>
              <input
                id="nomor"
                type="text"
                name="nomor"
                required
                autoComplete="off"
                placeholder="WR-2026-0001"
              />
              <p className="isian__petunjuk">
                Ada di halaman yang muncul setelah kamu selesai memesan.
              </p>
            </div>
            <button className="tombol tombol--penuh" type="submit">
              <span className="ikon-teks">
                <Ikon nama="cari" ukuran={17} />
                Cari pesanan
              </span>
            </button>
          </form>

          <p className="keranjang__catatan">
            Nomornya hilang? Hubungi warung dengan menyebutkan nama dan nomor
            WhatsApp yang kamu pakai saat memesan.
          </p>
        </div>
      </div>
    </Chrome>
  );
}
