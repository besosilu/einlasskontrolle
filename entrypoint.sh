#!/bin/sh

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
POSTGRES_DB="${POSTGRES_DB:-einlass_db}"
POSTGRES_USER="${POSTGRES_USER:-einlass_user}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD muss gesetzt sein}"

mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  echo "[entrypoint] Initialisiere PostgreSQL-Datenverzeichnis..."
  echo "$POSTGRES_PASSWORD" > /tmp/pgpass
  su-exec postgres initdb -D "$PGDATA" --username="$POSTGRES_USER" --pwfile=/tmp/pgpass \
    --auth-local=trust --auth-host=scram-sha-256
  rm -f /tmp/pgpass

  su-exec postgres pg_ctl -D "$PGDATA" -w -o "-c listen_addresses=''" start
  su-exec postgres psql --username "$POSTGRES_USER" --dbname postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

: "${DATABASE_URL:=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB}"
export DATABASE_URL

su-exec postgres postgres -D "$PGDATA" &
PG_PID=$!

echo "[entrypoint] Warte auf PostgreSQL..."
until su-exec postgres pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  sleep 1
done
echo "[entrypoint] PostgreSQL bereit."

cleanup() {
  echo "[entrypoint] Fahre herunter..."
  [ -n "$APP_PID" ] && kill -TERM "$APP_PID" 2>/dev/null
  wait "$APP_PID" 2>/dev/null
  kill -TERM "$PG_PID" 2>/dev/null
  wait "$PG_PID" 2>/dev/null
  echo "[entrypoint] Herunterfahren abgeschlossen."
}
trap 'cleanup; exit 0' TERM INT

node dist/index.js &
APP_PID=$!

wait "$APP_PID"
APP_EXIT=$?
kill -TERM "$PG_PID" 2>/dev/null
wait "$PG_PID" 2>/dev/null
exit "$APP_EXIT"
