// prisma.config.ts
import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  datasource: {
    // Fallback prevents `prisma generate` from crashing during the Docker
    // build, when DATABASE_URL isn't available yet. Render injects the
    // real value at runtime via environment variables.
    url: process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build",
  },
  migrations: {
    seed: "node prisma/seed.js",
  },
});