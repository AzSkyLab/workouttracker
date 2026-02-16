# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and root tsconfig
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build backend
WORKDIR /app/packages/backend
RUN npx prisma generate
RUN npm run build

# Production dependencies stage
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

RUN npm ci --omit=dev

# Runtime stage - no npm
FROM node:22-alpine AS runtime

# Install OpenSSL for Prisma, then remove npm/corepack
RUN apk add --no-cache openssl && \
    npm uninstall -g npm corepack && \
    rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built files from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy package.json for workspace resolution
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=deps /app/packages/shared/package.json ./packages/shared/package.json

WORKDIR /app/packages/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
