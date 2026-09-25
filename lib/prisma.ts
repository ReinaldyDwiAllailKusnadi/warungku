import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Satu koneksi Prisma dipakai bersama, tidak dibuat ulang tiap request.
// Tanpa ini, setiap hot-reload saat `npm run dev` menambah koneksi baru
// sampai PostgreSQL menolak ("too many clients").
//
// Pola globalThis dipakai karena Next.js memuat ulang modul saat dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // VPS ini 1 vCPU / 961 MB RAM dan sudah menjalankan enam situs lain.
  // Pool kecil itu disengaja: koneksi menganggur tetap memakan memori
  // di sisi PostgreSQL, dan di mesin sekecil ini itu langsung terasa.
  max: 5,
  idleTimeoutMillis: 30_000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
