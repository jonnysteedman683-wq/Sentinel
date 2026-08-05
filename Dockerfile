# Stage 1: build frontend + server bundle
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: production image
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/firebase-applet-config.json ./
# Install only runtime dependencies to ensure correct native binaries for tensorflow and other packages are resolved
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

# Assuming the build process outputs dist/server.cjs
# Note: Express + Vite apps in this environment use dist/server.cjs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
