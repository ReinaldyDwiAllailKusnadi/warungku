import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/app/components/Chrome";
import { FormMasuk } from "./FormMasuk";
import { sesiSekarang } from "@/lib/sesi";

export const metadata: Metadata = { title: "Masuk petugas" };

export default async function HalamanMasuk() {
  // Yang sudah masuk tidak perlu melihat formulir masuk lagi.
  if (await sesiSekarang()) redirect("/operator");

  return (
    <Chrome>
      <div className="bungkus--sempit">
        <div className="kartu kartu--masuk">
          <p className="bagian__label">Petugas</p>
          <h1 className="bagian__judul">Masuk ke panel warung</h1>
          <p className="bagian__ket">
            Halaman ini untuk petugas kasir dan dapur. Pelanggan tidak perlu masuk
            untuk memesan — pesanan bisa dilacak lewat nomor pesanannya.
          </p>

          <FormMasuk />

          <p className="keranjang__catatan">
            Belum punya pesanan?{" "}
            <Link href="/">Kembali ke menu</Link> atau{" "}
            <Link href="/lacak">lacak pesanan yang sudah dibuat</Link>.
          </p>
        </div>
      </div>
    </Chrome>
  );
}
