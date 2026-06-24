# syntax=docker/dockerfile:1

###############################################################################
# Bridge — multi-stage build producing a minimal Next.js standalone runtime.  #
###############################################################################

ARG NODE_VERSION=20-bookworm-slim

# --- deps: install node_modules (cached unless lockfile changes) -------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# openssl + ca-certificates are required by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The Prisma schema is needed because `postinstall` runs `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
# --legacy-peer-deps: next-auth@5 beta declares a peerOptional on nodemailer@^7
# while the project uses nodemailer@8 (the lockfile already resolves this).
RUN npm ci --legacy-peer-deps

# --- builder: compile the Next.js standalone output --------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate the Prisma client for the Linux runtime (local copy is macOS-only).
RUN npx prisma generate

# Env validation reads runtime secrets that aren't present at build time.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- migrator: full deps, used to run `prisma migrate deploy` ----------------
# The slim runner can't host the Prisma CLI (its transitive deps aren't in Next's
# traced node_modules). This stage keeps the complete node_modules so migrations
# run reliably as a one-off step (see the `migrate` service in docker-compose).
FROM builder AS migrator
WORKDIR /app
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# --- runner: minimal production image ----------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as the unprivileged user that the node image already provides.
USER node

# Standalone bundle: server.js + traced node_modules, then static + public assets.
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

# Prisma client + Linux query engine. The runtime client uses the native query
# engine binary here — it needs neither the Prisma CLI nor the schema engine
# (migrations run separately via the `migrator` stage).
COPY --chown=node:node --from=builder /app/generated ./generated

EXPOSE 3000

CMD ["node", "server.js"]
