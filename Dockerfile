# ---- Frontend build ----
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ---- Backend build ----
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build && npm prune --omit=dev

# ---- Runtime: Postgres + Backend (liefert Frontend mit aus) in einem Image ----
FROM node:22-alpine
RUN apk add --no-cache postgresql16 su-exec tini tzdata \
    && mkdir -p /var/lib/postgresql/data /run/postgresql \
    && chown -R postgres:postgres /var/lib/postgresql /run/postgresql

WORKDIR /app
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package*.json ./
COPY --from=frontend-build /app/dist ./public
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV PGDATA=/var/lib/postgresql/data \
    POSTGRES_DB=einlass_db \
    POSTGRES_USER=einlass_user \
    TZ=Europe/Berlin \
    NODE_ENV=production \
    PORT=3001

VOLUME ["/var/lib/postgresql/data"]
EXPOSE 3001

ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint.sh"]
