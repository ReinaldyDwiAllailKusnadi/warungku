# Warungku

Pesan makanan dari warung, bayar daring, lalu ambil di warung atau minta
diantar. Proyek latihan fullstack ke-tujuh, dibangun dan dijalankan di satu
VPS kecil (1 vCPU / 961 MB) bersama enam proyek lain.

**Pembayarannya tiruan.** Tidak ada uang yang berpindah, tidak ada data kartu
yang diminta. Yang dibangun adalah *alur* pembayaran sungguhan: tagihan,
halaman bayar pihak ketiga, pemberitahuan bertanda tangan, dan status yang
berubah sendiri. Halaman `/cara-bayar` menjelaskan bagian mana yang tiruan.

## Menjalankan

```bash
npm install
npx prisma@7.10.0 db push        # membuat 9 tabel
npm run contoh                   # menu contoh + 2 akun petugas
npm run build
npm start                        # 127.0.0.1:3005
```

Diperlukan `.env` (lihat `.env.example`): `DATABASE_URL`, `SESSION_SECRET`,
`WEBHOOK_SECRET` — dua yang terakhir harus acak, bukan kata yang bisa ditebak.

## Uji

```bash
npm run uji        # 101 periksaan, tanpa peramban, tanpa server
npm run typecheck
```

- `scripts/uji-uang.ts` (46) — seluruh aturan uang: subtotal, ongkos kirim,
  gratis antar, batas porsi, penolakan keranjang haram.
- `scripts/uji-webhook.ts` (55) — tanda tangan HMAC atas isi mentah,
  **idempotensi** (5 pemberitahuan kembar bersamaan → tepat 1 diproses),
  nominal tidak cocok, perpindahan status haram, dan balapan webhook.

## Alur yang dibangun

1. Pelanggan memilih menu; keranjangnya hanya menyimpan `{menuId, jumlah}` —
   **harga tidak pernah dikirim peramban**, server yang membaca dari database
   dan menyalinnya ke dalam pesanan.
2. Pesanan terbentuk dengan nomor `WR-2026-0001`, terkunci harganya, dan
   kedaluwarsa dalam 30 menit.
3. Pelanggan dibawa ke halaman bayar. Di sana tombol "Bayar" membuat
   pemberitahuan bertanda tangan (HMAC-SHA256 atas isi mentah) dan mengirimnya
   ke `/api/webhook/pembayaran` — persis seperti penyedia sungguhan.
4. Alamat webhook memeriksa tanda tangan (401 bila tidak sah), mencatat
   peristiwanya sekali saja, mencocokkan nominal sampai rupiah terakhir, lalu
   memindahkan status pesanan di dalam transaksi dengan `FOR UPDATE`.
5. Dapur/kasir memindahkan status pesanan dari panel petugas. **Tidak ada
   tombol yang bisa menandai pesanan lunas** — status "Sudah dibayar" hanya
   bisa lahir dari pemberitahuan yang sah.

### Penjagaan yang bisa dicoba langsung

Halaman bayar punya bagian "Coba kirim nominal yang tidak cocok": dua tombol
yang mengirim pemberitahuan bertanda tangan **sah** dengan nominal kurang atau
lebih. Keduanya dijawab 200 (peristiwanya tercatat, penyedia tidak perlu
mengirim ulang) tetapi pesanannya **tidak** ditandai lunas — dan halamannya
menampilkannya sebagai penolakan, bukan sebagai berhasil.

## Pelajaran teknis yang mahal

Kumpulan hal yang pernah salah (di proyek ini atau sebelumnya) dan cara
menghindarinya. Terbaca sendiri tanpa perlu membaca kodenya.

- **`var()` tanpa definisi tidak menghasilkan galat apa pun.** Latar tombol
  bisa jadi transparan dan halaman tetap "tampak normal". Jalankan pemeriksa
  token: setiap `var(--x)` harus punya definisi (`--font-utama` dikecualikan —
  disuntikkan `next/font` ke `<html>`, lihat `app/layout.tsx`).
- **Heap bawaan Node di VPS ini ~256 MB, dan `next build` mati persis di
  langkah pemeriksaan tipe.** Pesannya kadang eksplisit ("JavaScript heap out
  of memory"), kadang tidak menyebut memori sama sekali (`SIGABRT`). Obat:
  `NODE_OPTIONS=--max-old-space-size=512` (sudah di `npm run build`) dan
  hentikan enam aplikasi lain selagi membangun.
- **`next build` memakai banyak pekerja sekaligus** — `cpus: 1` +
  `workerThreads: false` di `next.config.ts` membuatnya selesai di mesin 961 MB.
- **nginx + Server Actions: `proxy_set_header Host $http_host`**, bukan `$host`.
  `$host` membuang port, Origin tidak cocok, dan pengguna hanya melihat
  "Application error". (Ketiga kalinya pelajaran ini dibayar.)
- **Jangan kasih nama yang sama untuk dua hal berbeda.** Kelas `.pesan` sudah
  dipakai untuk kotak pemberitahuan; menamai pembungkus halaman `.pesan` juga
  membuat keduanya saling menimpa tanpa galat apa pun.
- **Dua daftar wewenang yang ditulis terpisah akan berbeda.** Aturan "peran
  mana boleh memindahkan status ke mana" ditulis sekali saja
  (`bolehJalankan` di `lib/status.ts`) dan dipakai baik untuk menampilkan
  tombol maupun untuk menolak di server.
- **Tampilkan status yang sesungguhnya.** "Panggilan berhasil" (HTTP 200) dan
  "pesanan lunas" bukan hal yang sama; alamat webhook mengembalikan keduanya
  sebagai dua penanda terpisah (`dicatat`, `lunas`) dan halaman bayar
  menampilkan tiga keadaan, bukan dua.
- **Alat bantu bisa tersamar.** Alat sunting yang mencocokkan teks secara
  longgar pernah menulis `0812****7890` menggantikan nomor telepon di skrip
  uji. Setelah setiap suntingan terotomasi, periksa kembali nilai yang
  ditulisnya.
- **Ukur, baru mengubah.** Keluhan "UI-nya kurang bagus" di proyek sebelumnya
  ternyata bukan soal warna: 20 ukuran huruf, 0 bayangan, tanpa nama huruf.
  Di proyek ini sebaliknya — token dan tangga ukurannya sudah rapi, tetapi
  formulirnya 4,4 layar dari jempol di ponsel. Dua-duanya ketemu dengan
  mengukur, bukan dengan menebak.

## Struktur

```
prisma/schema.prisma     9 tabel: menu, kategori, pesanan, item, pembayaran,
                         peristiwa pesanan, log webhook, penghitung, pengguna
lib/menu.ts              aturan uang (fungsi murni, tanpa DB — dipakai klien & server)
lib/status.ts            mesin status + aturan peran (fungsi murni)
lib/pembayaran.ts        tagihan, HMAC, penerapan webhook idempoten, transaksi
lib/pesanan.ts           keranjang → pesanan (harga disalin, total dihitung server)
lib/gateway-tiruan.ts    pihak ketiga tiruan: menandatangani & mengirim webhook
app/api/webhook/         penerima pemberitahuan (401/400/200 yang dipilih sengaja)
app/PesanMenu.tsx        daftar menu + keranjang (komponen klien)
app/operator/            panel petugas: wewenang per kasir/dapur
app/[…]/page.tsx         status pesanan, halaman bayar, cara bayar, lacak, masuk
scripts/                 uji, isi contoh, pembersih
```

## Akun contoh

`kasir@warungku.test` (semua wewenang) dan `dapur@warungku.test`
(hanya status memasak), keduanya `rahasiauji123`. **Akun ini ada di repo
publik — wajib diganti sebelum dipakai sungguhan.**

## Peta port VPS

80 klinik · 8080 batikku · 8081 desaku · 8082 antriku · 8083 wisataku ·
8084 diengku · **8085 warungku** — semuanya http saja.
