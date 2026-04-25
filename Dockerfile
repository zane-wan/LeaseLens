# syntax=docker/dockerfile:1.7

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Stage 2: Build the application ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npx prisma generate

COPY . .

RUN --mount=type=cache,target=/app/.next/cache npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# pdf-parse is dynamically imported, so Next.js standalone tracing misses it.
# Copy the package and its pdfjs-dist dependency manually.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
