/**
 * scripts/uji-webhook.ts — menguji bagian yang paling mudah salah.
 *
 * Dua bagian:
 *   A. Fungsi murni (tanpa database): tanda tangan HMAC dan mesin status.
 *   B. Dengan database: idempotensi, kecocokan nominal, dan balapan
 *      webhook kembar yang datang bersamaan.
 *
 * Bagian B memakai database sungguhan karena yang diuji justru perilaku
 * database: batasan UNIK pada eventId dan penguncian baris. Menguji
 * idempotensi dengan tiruan tidak membuktikan apa pun — yang dijaga
 * justru jaminan dari database itu sendiri.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  buatTagihan,
  periksaTandaTangan,
  pindahkanStatus,
  tandaTanganWebhook,
  terapkanWebhook,
  type MuatanWebhook,
} from "../lib/pembayaran";
import { bolehPindah, type StatusPesanan } from "../lib/status";
import { buatPesanan } from "../lib/pesanan";

let lulus = 0;
let gagal = 0;

function sama(judul: string, dapat: unknown, harus: unknown) {
  const a = JSON.stringify(dapat);
  const b = JSON.stringify(harus);
  if (a === b) {
    lulus++;
    console.log(`  ok   ${judul}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${judul}\n         dapat: ${a}\n         harus: ${b}`);
  }
}

const RAHASIA = "rahasia-uji-jangan-dipakai-di-sunggguhan";

// ==================================================================== A
console.log("\n== A. Tanda tangan webhook ==");

const isi = JSON.stringify({ eventId: "evt-1", jumlah: 58000 });
const sah = tandaTanganWebhook(isi, RAHASIA);

sama("tanda tangan sah diterima", periksaTandaTangan(isi, sah, RAHASIA), true);
sama("tanda tangan kosong ditolak", periksaTandaTangan(isi, "", RAHASIA), false);
sama("tanda tangan null ditolak", periksaTandaTangan(isi, null, RAHASIA), false);
sama(
  "tanda tangan dari kunci lain ditolak",
  periksaTandaTangan(isi, tandaTanganWebhook(isi, "kunci-penyerang"), RAHASIA),
  false,
);
// Yang penting: isi diubah SETELAH ditandatangani. Ini serangan yang
// sebenarnya — ambil webhook yang sah, ubah nominalnya, kirim ulang.
const diubah = JSON.stringify({ eventId: "evt-1", jumlah: 1 });
sama(
  "isi diubah setelah ditandatangani -> DITOLAK",
  periksaTandaTangan(diubah, sah, RAHASIA),
  false,
);
sama(
  "tanda tangan hampir sama (1 karakter beda) ditolak",
  periksaTandaTangan(isi, sah.slice(0, -1) + (sah.endsWith("a") ? "b" : "a"), RAHASIA),
  false,
);
sama(
  "tanda tangan panjang beda ditolak tanpa melempar galat",
  periksaTandaTangan(isi, "abc", RAHASIA),
  false,
);
sama(
  "urutan kunci berbeda -> tanda tangan berbeda (isi mentah yang ditandatangani)",
  tandaTanganWebhook(JSON.stringify({ a: 1, b: 2 }), RAHASIA) ===
    tandaTanganWebhook(JSON.stringify({ b: 2, a: 1 }), RAHASIA),
  false,
);

console.log("\n== A. Mesin status: yang SAH ==");
sama("menunggu bayar -> dibayar", bolehPindah("MENUNGGU_BAYAR", "DIBAYAR"), true);
sama("menunggu bayar -> dibatalkan", bolehPindah("MENUNGGU_BAYAR", "DIBATALKAN"), true);
sama("dibayar -> dimasak", bolehPindah("DIBAYAR", "DIMASAK"), true);
sama("dimasak -> siap", bolehPindah("DIMASAK", "SIAP"), true);
sama("siap -> selesai", bolehPindah("SIAP", "SELESAI"), true);

console.log("\n== A. Mesin status: yang HARUS DITOLAK ==");
sama(
  "menunggu bayar -> dimasak (melompati pembayaran)",
  bolehPindah("MENUNGGU_BAYAR", "DIMASAK"),
  false,
);
sama(
  "menunggu bayar -> siap",
  bolehPindah("MENUNGGU_BAYAR", "SIAP"),
  false,
);
sama(
  "dibayar -> dibatalkan (butuh pengembalian dana yang belum ada)",
  bolehPindah("DIBAYAR", "DIBATALKAN"),
  false,
);
sama("dimasak -> dibayar (mundur)", bolehPindah("DIMASAK", "DIBAYAR"), false);
sama("selesai -> apa pun", bolehPindah("SELESAI", "DIMASAK"), false);
sama("dibatalkan -> apa pun", bolehPindah("DIBATALKAN", "DIBAYAR"), false);
sama("status ke dirinya sendiri bukan perpindahan", bolehPindah("DIBAYAR", "DIBAYAR"), false);

// ==================================================================== B

async function utama() {
console.log("\n== B. Dengan database ==");

const SLUG_UJI = "menu-uji-webhook";

async function bersihkan() {
  const pes = await prisma.pesanan.findMany({
    where: { nama: { startsWith: "Uji" } },
    select: { id: true },
  });
  const ids = pes.map((p) => p.id);
  if (ids.length) {
    await prisma.peristiwaPesanan.deleteMany({ where: { pesananId: { in: ids } } });
    await prisma.pembayaran.deleteMany({ where: { pesananId: { in: ids } } });
    await prisma.itemPesanan.deleteMany({ where: { pesananId: { in: ids } } });
    await prisma.pesanan.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.peristiwaWebhook.deleteMany({ where: { eventId: { startsWith: "uji-" } } });
  await prisma.menu.deleteMany({ where: { slug: SLUG_UJI } });
}

await bersihkan();

const kategori = await prisma.kategori.create({
  data: { nama: "Kategori Uji Webhook", urutan: 999 },
});
const menu = await prisma.menu.create({
  data: {
    kategoriId: kategori.id,
    nama: "Menu Uji",
    slug: SLUG_UJI,
    harga: 25_000,
    tersedia: true,
  },
});

/** Membuat pesanan uji berisi 2 porsi Menu Uji (total 50.000). */
async function pesananUji(nama: string) {
  const hasil = await buatPesanan({
    nama,
    telepon: "081234567890",
    tipe: "DIAMBIL",
    keranjang: [{ menuId: menu.id, jumlah: 2 }],
  });
  if (!hasil.ok) throw new Error("gagal membuat pesanan uji: " + hasil.galat);
  return hasil.data;
}

function muatan(
  referensi: string,
  jumlah: number,
  jenis = "pembayaran.berhasil",
  eventId = "uji-" + randomUUID(),
): MuatanWebhook {
  return { eventId, jenis, referensi, jumlah, waktuBayar: new Date().toISOString() };
}

const status = (id: string) =>
  prisma.pesanan.findUnique({ where: { id }, select: { status: true } });

// --- 1. jalur normal
{
  const p = await pesananUji("Uji Normal");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);
  sama("total pesanan = 2 x 25.000", p.total, 50_000);
  sama("tagihan memakai total pesanan", (await prisma.pembayaran.count({ where: { pesananId: p.id } })), 1);

  const hasil = await terapkanWebhook(muatan(tag.data.referensi, 50_000));
  sama("webhook sah diproses", hasil.ok && !hasil.data.sudahDiproses, true);
  sama("pesanan jadi DIBAYAR", (await status(p.id))?.status, "DIBAYAR");
}

// --- 2. idempotensi: webhook yang SAMA datang dua kali
{
  const p = await pesananUji("Uji Kembar");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);
  const m = muatan(tag.data.referensi, 50_000, "pembayaran.berhasil", "uji-sama-" + randomUUID());

  const a = await terapkanWebhook(m);
  const b = await terapkanWebhook(m);

  sama("yang pertama diproses", a.ok && !a.data.sudahDiproses, true);
  sama("yang kedua dikenali sudah pernah", b.ok && b.data.sudahDiproses, true);
  sama("pesanan tetap DIBAYAR", (await status(p.id))?.status, "DIBAYAR");
  sama(
    "hanya SATU peristiwa tercatat (tidak menagih dua kali)",
    await prisma.peristiwaPesanan.count({
      where: { pesananId: p.id, sebab: "webhook" },
    }),
    1,
  );
}

// --- 3. dua eventId BERBEDA untuk tagihan yang sama
{
  const p = await pesananUji("Uji Dua Event");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);
  await terapkanWebhook(muatan(tag.data.referensi, 50_000));
  const kedua = await terapkanWebhook(muatan(tag.data.referensi, 50_000));
  sama("tagihan yang sudah lunas tidak diproses lagi", kedua.ok && kedua.data.sudahDiproses, true);
  sama(
    "tetap hanya satu peristiwa webhook",
    await prisma.peristiwaPesanan.count({ where: { pesananId: p.id, sebab: "webhook" } }),
    1,
  );
}

// --- 4. BALAPAN: lima webhook kembar dikirim BERSAMAAN
{
  const p = await pesananUji("Uji Balapan");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);
  const m = muatan(tag.data.referensi, 50_000, "pembayaran.berhasil", "uji-balapan-" + randomUUID());

  const hasil = await Promise.all(
    Array.from({ length: 5 }, () => terapkanWebhook(m)),
  );
  const diproses = hasil.filter((h) => h.ok && !h.data.sudahDiproses).length;
  const dikenali = hasil.filter((h) => h.ok && h.data.sudahDiproses).length;

  console.log(
    `       (5 webhook sekaligus -> ${diproses} diproses, ${dikenali} dikenali sudah, ` +
      `${hasil.filter((h) => !h.ok).length} galat)`,
  );
  sama("TEPAT SATU yang benar-benar diproses", diproses, 1);
  sama(
    "hanya satu peristiwa webhook tercatat",
    await prisma.peristiwaPesanan.count({ where: { pesananId: p.id, sebab: "webhook" } }),
    1,
  );
  sama("pesanan DIBAYAR", (await status(p.id))?.status, "DIBAYAR");
}

// --- 5. nominal tidak cocok
{
  const p = await pesananUji("Uji Nominal");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);

  const kurang = await terapkanWebhook(muatan(tag.data.referensi, 49_000));
  sama("nominal kurang DITOLAK", kurang.ok, false);
  sama("pesanan TIDAK jadi lunas", (await status(p.id))?.status, "MENUNGGU_BAYAR");

  const lebih = await terapkanWebhook(muatan(tag.data.referensi, 51_000));
  sama("nominal lebih DITOLAK", lebih.ok, false);
  sama("pesanan tetap belum lunas", (await status(p.id))?.status, "MENUNGGU_BAYAR");

  const pas = await terapkanWebhook(muatan(tag.data.referensi, 50_000));
  sama("nominal yang tepat baru diterima", pas.ok && !pas.data.sudahDiproses, true);
}

// --- 6. referensi tidak dikenal
{
  const hasil = await terapkanWebhook(muatan("TAG-TIDAK-ADA-9", 50_000));
  sama("referensi tidak dikenal DITOLAK", hasil.ok, false);
}

// --- 7. muatan tidak lengkap
{
  sama(
    "tanpa eventId ditolak",
    (await terapkanWebhook({ ...muatan("X", 1), eventId: "" })).ok,
    false,
  );
  sama(
    "nominal negatif ditolak",
    (await terapkanWebhook(muatan("TAG-X", -1))).ok,
    false,
  );
  sama(
    "nominal pecahan ditolak",
    (await terapkanWebhook(muatan("TAG-X", 1000.5))).ok,
    false,
  );
}

// --- 8. dibayar setelah kedaluwarsa
{
  const p = await pesananUji("Uji Lewat Batas");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);

  const batal = await pindahkanStatus(p.id, "DIBATALKAN", "kedaluwarsa", null);
  sama("pesanan dibatalkan karena lewat batas", batal.ok, true);

  const hasil = await terapkanWebhook(muatan(tag.data.referensi, 50_000));
  sama("pembayaran setelah batal TETAP dicatat", hasil.ok, true);
  sama("pesanan TIDAK dihidupkan lagi", (await status(p.id))?.status, "DIBATALKAN");
  sama(
    "ditandai perlu pengembalian dana",
    await prisma.peristiwaPesanan.count({
      where: { pesananId: p.id, sebab: "dibayar-setelah-batal-perlu-pengembalian" },
    }),
    1,
  );
  console.log(`       (${hasil.ok ? hasil.data.catatan : "-"})`);
}

// --- 9. webhook gagal tidak mengubah status pesanan
{
  const p = await pesananUji("Uji Webhook Gagal");
  const tag = await buatTagihan(p.id);
  if (!tag.ok) throw new Error(tag.galat);
  const hasil = await terapkanWebhook(
    muatan(tag.data.referensi, 50_000, "pembayaran.gagal"),
  );
  sama("webhook gagal diterima", hasil.ok, true);
  sama("pesanan tetap menunggu bayar", (await status(p.id))?.status, "MENUNGGU_BAYAR");
}

// --- 10. perpindahan status haram lewat lapisan database
{
  const p = await pesananUji("Uji Pindah Haram");
  const lompat = await pindahkanStatus(p.id, "SIAP", "kasir", "Petugas Uji");
  sama("menunggu bayar -> siap DITOLAK", lompat.ok, false);
  sama("status tidak berubah", (await status(p.id))?.status, "MENUNGGU_BAYAR");

  const mundur = await pindahkanStatus(p.id, "SELESAI", "kasir", "Petugas Uji");
  sama("menunggu bayar -> selesai DITOLAK", mundur.ok, false);

  const sah = await pindahkanStatus(p.id, "DIBATALKAN", "kasir", "Petugas Uji");
  sama("menunggu bayar -> dibatalkan DITERIMA", sah.ok, true);
  sama(
    "peristiwa mencatat SIAPA yang mengubah",
    (await prisma.peristiwaPesanan.findFirst({
      where: { pesananId: p.id, sebab: "kasir" },
      select: { oleh: true },
    }))?.oleh,
    "Petugas Uji",
  );
}

// --- 11. tagihan dipakai ulang, bukan menumpuk
{
  const p = await pesananUji("Uji Tagihan Ulang");
  const a = await buatTagihan(p.id);
  const b = await buatTagihan(p.id);
  if (!a.ok || !b.ok) throw new Error("gagal membuat tagihan");
  sama("menekan bayar dua kali -> referensi sama", a.data.referensi, b.data.referensi);
  sama(
    "tetap hanya satu baris tagihan",
    await prisma.pembayaran.count({ where: { pesananId: p.id } }),
    1,
  );
}

await bersihkan();
await prisma.kategori.deleteMany({ where: { nama: "Kategori Uji Webhook" } });
await prisma.$disconnect();

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
}

utama().catch((e) => {
  console.error(e);
  process.exit(1);
});
