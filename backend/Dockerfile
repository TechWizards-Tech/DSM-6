# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Os fluxos do PROCON vao junto: sao dados da aplicacao, nao configuracao.
COPY fluxos ./fluxos
ENV FLUXOS_DIR=/app/fluxos
ENV PORT=3333
EXPOSE 3333
CMD ["node", "dist/server.js"]
