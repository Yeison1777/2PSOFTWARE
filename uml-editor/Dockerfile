FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The lockfile was generated on Windows; on Linux this often causes npm to skip optional
# native binaries (Tailwind oxide / lightningcss). For Docker builds we regenerate the
# lock inside Linux to reliably install the correct native bindings.
RUN rm -f package-lock.json \
  && npm install --include=optional

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


