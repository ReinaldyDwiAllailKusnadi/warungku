"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { bayarAction, type HasilBayar } from "@/app/actions/bayar";
import { Ikon } from "@/app/components/Ikon";
import { rupiah } from "@/lib/format";

/**
 * FormBayar.tsx — tombol bayar dan hasil balasan dari alamat webhook.
 *
 * KENAPA BALASANNYA DITAMPILKAN APA ADANYA:
 *   Di alur sungguhan, balasan ini hanya terlihat di log penyedia. Di
 *   sini ia justru bagian yang paling berguna untuk dilihat: dari situ
 *   terlihat kode HTTP yang dijawab, dan kode itulah yang menentukan
 *   apakah penyedia akan mengirim ulang atau tidak.
 */

function Tombol({
  mode,
  label,
  utama,
}: {
  mode: string;
  label: string;
  utama?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="mode"
      value={mode}
      className={`tombol${utama ? "" : " tombol--putih"}`}
      disabled={pending}
    >
      {pending ? "Mengirim…" : label}
    </button>
  );
}

export function FormBayar({
  referensi,
  jumlah,
}: {
  referensi: string;
  jumlah: number;
}) {
  const [hasil, kirim] = useActionState<HasilBayar | undefined, FormData>(
    bayarAction,
    undefined,
  );

  return (
    <div className="bayar-aksi">
      <form action={kirim} className="bayar-aksi__tombol">
        <input type="hidden" name="referensi" value={referensi} />
        <Tombol mode="tepat" label={`Bayar ${rupiah(jumlah)}`} utama />
      </form>

      {hasil ? (
        (() => {
          // TIGA keadaan, bukan dua. "Panggilannya berhasil" (ok) dan
          // "pesanannya lunas" (lunas) adalah hal yang berbeda: pemberitahuan
          // bertanda tangan sah dengan nominal kurang juga dijawab berhasil
          // oleh alamat webhook, tetapi pesanannya TIDAK lunas. Menampilkan
          // hijau untuk keadaan itu berarti menipu pembayarnya.
          const judul = !hasil.ok
            ? "Pengiriman gagal"
            : hasil.lunas
              ? "Pembayaran diterima — pesanan lunas"
              : "Pemberitahuan ditolak — pesanan belum lunas";
          const kelas = hasil.ok && hasil.lunas ? "pesan--berhasil" : "pesan--galat";
          return (
            <div className={`pesan ${kelas}`}>
              <p className="mb-0">
                <strong>{judul}</strong>
                <br />
                {hasil.pesan}
              </p>
              {hasil.balasan ? (
                <p className="bayar-aksi__balasan">
                  Balasan dari alamat webhook: <code>{hasil.balasan}</code>
                </p>
              ) : null}
            </div>
          );
        })()
      ) : null}

      <details className="bayar-uji">
        <summary className="bayar-uji__ringkas">
          <Ikon nama="info" ukuran={16} />
          Coba kirim nominal yang tidak cocok
        </summary>
        <p className="bayar-uji__ket">
          Dua tombol ini mengirim pemberitahuan yang tanda tangannya SAH, tetapi
          nominalnya sengaja dibuat berbeda. Keduanya <strong>harus ditolak</strong>{" "}
          dan pesanannya harus tetap belum lunas — kalau tidak, siapa pun yang
          menemukan alamat webhook bisa melunasi pesanannya sendiri dengan
          membayar lebih sedikit.
        </p>
        <div className="bayar-uji__tombol">
          <form action={kirim}>
            <input type="hidden" name="referensi" value={referensi} />
            <Tombol mode="kurang" label={`Kurang ${rupiah(1_000)}`} />
          </form>
          <form action={kirim}>
            <input type="hidden" name="referensi" value={referensi} />
            <Tombol mode="lebih" label={`Lebih ${rupiah(1_000)}`} />
          </form>
        </div>
      </details>
    </div>
  );
}
