"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { masukAction, type HasilMasuk } from "@/app/actions/auth";
import { Ikon } from "@/app/components/Ikon";

/**
 * FormMasuk.tsx — formulir masuk petugas.
 *
 * KENAPA GALATNYA DITAMPILKAN DI ATAS FORMULIR, BUKAN DI BAWAH TOMBOL:
 *   Setelah menekan "Masuk", pandangan orang ada di sekitar tombolnya.
 *   Pesan galat yang muncul jauh dari situ tidak terbaca, dan yang
 *   terjadi berikutnya adalah orang menekan tombolnya berulang kali
 *   sambil mengira tombolnya tidak bekerja.
 */

function Tombol() {
  const { pending } = useFormStatus();
  return (
    <button className="tombol tombol--penuh" type="submit" disabled={pending}>
      {pending ? "Memeriksa…" : "Masuk"}
    </button>
  );
}

export function FormMasuk() {
  const [hasil, kirim] = useActionState<HasilMasuk | undefined, FormData>(
    masukAction,
    undefined,
  );

  return (
    <form action={kirim}>
      {hasil && !hasil.ok ? (
        <p className="pesan pesan--galat" role="alert">
          <span className="ikon-teks">
            <Ikon nama="info" ukuran={16} />
            {hasil.galat}
          </span>
        </p>
      ) : null}

      <div className="isian">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="text"
          name="email"
          autoComplete="username"
          required
          placeholder="nama@warungku.test"
        />
      </div>

      <div className="isian">
        <label htmlFor="sandi">Kata sandi</label>
        <input
          id="sandi"
          type="password"
          name="sandi"
          autoComplete="current-password"
          required
        />
      </div>

      <Tombol />
    </form>
  );
}
