// prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  migrations: {
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});