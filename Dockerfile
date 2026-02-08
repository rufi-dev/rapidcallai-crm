# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/client

COPY client/package.json client/package-lock.json* ./
RUN npm install

COPY client/ .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

# Copy built frontend to public/ (served by Express)
COPY --from=frontend-build /app/client/dist ./public

EXPOSE 8788
CMD ["node", "src/index.js"]
