import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma CLI does not load `.env.local` by default; mirror Next.js precedence.
const root = process.cwd();
for (const name of ['.env.local', '.env']) {
  const path = resolve(root, name);
  if (existsSync(path)) {
    config({ path });
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Neon: pooled `DATABASE_URL` for the app; CLI/migrations need a direct URL.
    url: env('DIRECT_URL'),
  },
});
