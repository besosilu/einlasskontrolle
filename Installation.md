# Installation – Start in Docker (All-in-One)

Die komplette Anwendung (PostgreSQL + Backend + Frontend) läuft in **einem** Docker-Image. Es wird nur Docker benötigt – keine lokale Node- oder PostgreSQL-Installation.

## Voraussetzungen

- Docker Desktop (oder Docker Engine) installiert und gestartet

## 1. `.env`-Datei anlegen

Im Projektordner eine Datei `.env` erstellen:

```env
POSTGRES_PASSWORD=EinSicheresPasswort123!
JWT_SECRET=EinZufaelligerLangerGeheimerString
APP_URL=http://localhost:3001
```

- `POSTGRES_PASSWORD`: Passwort für die interne Datenbank – frei wählbar, aber sicher.
- `JWT_SECRET`: beliebiger langer Zufallsstring (wird zum Signieren der Login-Tokens genutzt).
- `APP_URL`: unter welcher Adresse die App später erreichbar ist (wird u.a. für Links in E-Mails verwendet).

## 2. Starten

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

Der erste Start baut das Image (dauert ein paar Minuten) und richtet die Datenbank automatisch ein.

## 3. Öffnen

Im Browser: **http://localhost:3001**

Standard-Login beim allerersten Start:

- **E-Mail:** `admin@local`
- **Passwort:** `admin`

Das Passwort muss beim ersten Login geändert werden.

## Verwalten

```bash
# Status prüfen
docker compose -f docker-compose.standalone.yml ps

# Logs ansehen
docker compose -f docker-compose.standalone.yml logs -f

# Stoppen
docker compose -f docker-compose.standalone.yml down

# Nach Code-Änderungen neu bauen und starten
docker compose -f docker-compose.standalone.yml up -d --build
```

Die Datenbank-Daten liegen in einem Docker-Volume (`einlass_data`) und bleiben beim Stoppen/Neustarten erhalten. Nur `docker compose down -v` löscht sie.
