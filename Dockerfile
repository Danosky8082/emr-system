# ============================================================
# Backend Dockerfile — Node.js EMR server
# Used by Render (and any Docker-compatible host)
# ============================================================
FROM node:22-slim

# Prisma's query engine needs OpenSSL at runtime; ca-certificates
# are needed for outbound HTTPS (Cloudinary, Postgres, etc.)
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Dependency layer (cached) ---------------------------------
# Copy manifests first so Docker caches `npm ci` unless they change.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

# Prisma's config loader requires DATABASE_URL to be set, even during
# `prisma generate` (which never actually connects to the DB).
# Use a dummy URL here — Render overrides it at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Install ALL deps (including `prisma` from devDependencies — needed for generate)
RUN npm ci

# Generate Prisma Client explicitly. Prisma 7 removed the auto
# postinstall hook, so this must run.
RUN npx prisma generate

# Prune devDependencies to keep the runtime image lean.
# Prisma Client is already generated in node_modules/.prisma/client,
# so it survives the prune.
RUN npm prune --omit=dev

# ---- Application layer -----------------------------------------
# Copy the rest of the backend
COPY . .

# Create the uploads folder. Harmless when Cloudinary is the backend
# but prevents "directory not found" errors on the local-storage path.
RUN mkdir -p uploads/imaging

# Render sets PORT at runtime; these are defaults for local docker runs
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# On startup, push the Prisma schema to the DB (idempotent), then run.
# We use `db push` instead of `migrate deploy` because the project has
# no migrations folder yet — the schema is applied directly.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]