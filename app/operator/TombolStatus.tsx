"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ubahStatusAction, type HasilUbah } from "@/app/actions/status";
import { Ikon } from "@/app/components/Ikon";
import { LABEL_STATUS, type StatusPesanan } from "@/lib/status";

/**
 * TombolStatus.tsx — satu tombol perpindahan status di panel petugas.
 *
 * KENAPA SETIAP TOMBOL PUNYA FORMULIRNYA SENDIRI:
 *   Server Action mengirim seluruh isi formulir yang membungkusnya. Kalau
 *   semua tombol berada dalam satu formulir besar, menekan tombol mana
 *   pun akan mengirim data yang sama — termasuk id pesanan milik baris
 *   lain. Satu formulir per tombol membuat yang terkirim hanya satu
 *   pesanan, satu tujuan.
 *
 * KENAPA HASILNYA DITAMPILKAN, BUKAN HANYA DIREFRESH:
 *   Kalau server menolak (misalnya perannya tidak berwenang karena peran
 *   barunya baru diturunkan), halaman yang hanya menyegar akan tampak
 *   seperti tombol yang tidak bekerja. Pesan penolakannya harus terlihat.
 */

function Tombol({ label, ke }: { label: string; ke: StatusPesanan }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`tombol tombol--kecil${
        ke === "SIAP" || ke === "SELESAI" ? "" : " tombol--putih"
      }`}
      disabled={pending}
    >
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export function TombolStatus({
  pesananId,
  ke,
  boleh,
  alasan,
}: {
  pesananId: string;
  ke: StatusPesanan;
  boleh: boolean;
  alasan: string | null;
}) {
  const [hasil, kirim] = useActionState<HasilUbah | undefined, FormData>(
    ubahStatusAction,
    undefined,
  );

  return (
    <div className="aksi-status">
      <form action={kirim}>
        <input type="hidden" name="pesananId" value={pesananId} />
        <input type="hidden" name="ke" value={ke} />
        <Tombol label={`Tandai ${LABEL_STATUS[ke].toLowerCase()}`} ke={ke} />
      </form>

      {!boleh && alasan ? (
        <p className="aksi-status__alasan">
          <Ikon nama="info" ukuran={14} />
          {alasan}
        </p>
      ) : null}

      {hasil ? (
        <p
          className={`aksi-status__hasil${
            hasil.ok ? "" : " aksi-status__hasil--galat"
          }`}
          role="status"
        >
          {hasil.pesan}
        </p>
      ) : null}
    </div>
  );
}
