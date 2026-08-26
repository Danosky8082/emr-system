// prisma.config.ts
import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  migrations: {
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});