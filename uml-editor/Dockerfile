FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The lockfile was generated on Windows and may only include Win32 optional native binaries.
# Force-install Linux (glibc) native binaries so Next/Tailwind can build in Docker.
RUN npm ci \
  && npm i --no-save lightningcss-linux-x64-gnu@1.30.2 \
  && npm i --no-save @tailwindcss/oxide-linux-x64-gnu@4.1.16

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Next standalone output
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]


