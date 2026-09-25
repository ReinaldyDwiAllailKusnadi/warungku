// prisma.config.ts
//
// Prisma 7 tidak lagi membaca .env otomatis dan tidak lagi mengambil
// DATABASE_URL langsung dari schema.prisma. Semua diatur di sini.
// Dokumentasi: https://pris.ly/d/prisma-config
//
// Akibatnya .env harus dimuat manual ("dotenv/config") — kalau tidak,
// DATABASE_URL bernilai undefined dan error yang muncul membingungkan
// (bukan "env tidak ada", tapi "url tidak valid").

import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
