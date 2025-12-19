# syntax=docker/dockerfile:1

#####################
# 1) Install all deps once (dev + prod)
#####################
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

#####################
# 2) Dev image (uses dev deps, hot reload)
#####################
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
# use deps from the deps layer
COPY --from=deps /app/node_modules ./node_modules
# app source comes from bind mount during dev, but copying is fine too:
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]   # or your "dev:docker" script

#####################
# 3) Build (production build)
#####################
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time Stripe publishable key for embedding in the client bundle
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

#####################
# 4) Production-only deps (omit dev)
#####################
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

#####################
# 5) Runtime (lean prod image)
#####################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Prod deps
COPY --from=prod-deps /app/node_modules ./node_modules
# Built app
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./

# Ensure Next.js build/cache is writable by the node user
RUN chown -R node:node .next

# Run as non-root user that exists in the official image
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]