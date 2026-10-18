# Einlassüberwachung Schwimmverein

Webapplikation zur Einlasskontrolle mit QR-Code-Handscanner und manueller Eingabe. Läuft komplett in Docker (PostgreSQL, Backend und Frontend in einem Image) und ist als PWA auf dem Einlass-PC bedienbar.

## Funktionen

- **Einlasskontrolle:** Scan per USB-Handscanner (Tastatur-Emulation) oder manuelle Eingabe; Tagesliste mit Kennzahlen, Suche und sortierbaren Spalten
- **Mehrere Tage pro Mitglied:** Ein Mitglied kann an jedem Tag einmal eingelassen werden; doppelte Einlässe am selben Tag werden erkannt
- **Kennzeichen pro Mitglied:** Übungsleiter (ÜL), Neuer Ausweis, Schnupper-Training, Vorschwimmen (noch kein Mitglied, nur Name wird gespeichert)
- **Notizen** pro Einlass
- **Export** pro Tag (Neuer Ausweis, Schnupper-Training, Vorschwimmen) als CSV nach Vorschau
- **CSV-Import** von Scan-Dateien (mehrere Dateien gleichzeitig)
- **Mitgliederverwaltung**, Statistiken (Tag, Woche, Monat, Auslastung), Protokolle, Preisliste
- **Chat in den Statistiken** (optional): Fragen zu den Besucherzahlen in normaler Sprache, beantwortet mit Tabellen und Diagrammen (siehe [KI-Auswertung](#ki-auswertung-chat-in-den-statistiken))
- **Benutzerverwaltung** mit Registrierung, Freigabe durch Administratoren, Sperren und Passwort-Reset

## Starten

Voraussetzung: Docker Desktop (oder Docker Engine). Details in [Installation.md](Installation.md).

### Produktion (All-in-One)

Im Projektordner eine `.env` anlegen (Vorlage: `.env.example`):

```env
POSTGRES_PASSWORD=EinSicheresPasswort123!
JWT_SECRET=EinZufaelligerLangerGeheimerString
APP_URL=http://localhost:3001
```

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

Die App ist unter `http://localhost:3001` erreichbar. Erster Login: `admin@local` / `admin` (das Passwort muss beim ersten Login geändert werden). Die Daten liegen im Docker-Volume `einlass_data` und bleiben beim Neustart oder Update erhalten.

Nach Codeänderungen: `docker compose -f docker-compose.standalone.yml up -d --build`. Migrationen laufen beim Start automatisch.

### Portables Paket für andere Windows-PCs

```powershell
powershell -ExecutionPolicy Bypass -File .\build-portable.ps1
```

Erzeugt im Ordner `release/` ein Image (`einlasskontrolle.tar`) samt `docker-compose.yml`, `.env.example`, `start.bat` und `LIESMICH.txt`. Den Ordner auf den Ziel-PC kopieren und `start.bat` ausführen. Das `.tar` ist nicht im Git-Repository; es muss nach Codeänderungen neu gebaut werden.

### Weitere Varianten

| Variante | Datei / Anleitung |
|---|---|
| Mehrere Container (Postgres, Backend, nginx) | `docker-compose.yml` |
| Entwicklung (Hot Reload) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` |
| QNAP NAS | [QNAP-Anleitung.md](QNAP-Anleitung.md), `docker-compose.qnap.yml`, `build-for-qnap.ps1` |

Entwicklung: Frontend http://localhost:5173, Backend-API http://localhost:3001.

## Bedienung

### Einlass

- **Scannen:** Der Scanner tippt den Code samt Enter. Die Seite muss dafür kein Eingabefeld im Fokus haben; nach dem manuellen Hinzufügen wird der Fokus deshalb automatisch freigegeben.
- **Manuell:** Name suchen und mit **Enter** übernehmen (fügt sofort hinzu) oder Vor- und Nachname eingeben und auf „Manuell hinzufügen“ klicken. Das Häkchen „Vorschwimmen (noch kein Mitglied)“ setzt das Kennzeichen gleich mit.
- **Anderer Tag:** Im Mini-Kalender ein Datum wählen; Scans und manuelle Einträge werden dann für diesen Tag gebucht. Um Mitternacht springt die Seite von selbst auf den neuen Tag, solange „heute“ gewählt ist.
- **Tagesliste:** Suche (Name, Nummer, Notiz) und Sortierung nach Name, Nr., Methode und Zeit. Pro Eintrag lassen sich Neuer Ausweis, ÜL, Schnupper-Training, Vorschwimmen und Notiz setzen oder der Eintrag löschen.
- **Warnungen:** Hinweis bei häufigen manuellen Einlässen (Ausweis vergessen) und beim Schnupper-Training ab dem 3. Besuch.

### Export

Der Button **Export** an der Tagesliste öffnet für das gewählte Datum drei Listen (Neuer Ausweis, Schnupper-Training, Vorschwimmen). Jede Liste hat ein eigenes **Speichern**, das eine CSV im Format `Mitgliedsnummer;Name;Vorname` herunterlädt (UTF-8 mit BOM, importfähig). Das Kennzeichen wird zum Zeitpunkt des Exports gelesen, am besten also am selben Tag exportieren.

### QR-Code-Format

```
SWIM:12345:NACHNAME:VORNAME
```

Alternativ nur die Mitgliedsnummer (`12345`) oder `Nummer;Name;Vorname`.

### CSV-Import

Format (Semikolon-getrennt):

```
Mitgliedsnummer;Name;Vorname
12345;Mustermann;Max
```

- Erste Zeile kann ein Header sein (wird erkannt und übersprungen); UTF-8, auch mit BOM; max. 10 MB pro Datei
- **Datum:** Steht `yyyy-mm-dd` im Dateinamen (z. B. `scan_2026-10-08.csv`), gilt es als Einlassdatum, sonst das im Importdialog gewählte Datum
- **Mitgliedsnummer `0` oder leer:** manuell erfasstes Mitglied; es wird über Name und Vorname gesucht oder neu angelegt (Methode „manuell“)
- **Doppelte Mitgliedsnummer in einer Datei:** nur das erste Vorkommen wird importiert
- **Bekanntes Mitglied:** bekommt einen Eintrag für den Tag; hat es ihn schon, zählt die Zeile als „bereits erfasst“. Geänderte Namen werden aktualisiert.
- Manuelle Zeilen mit Komma wie `0;Macholl, Lukas` werden erkannt
- Zeilen mit nur einem Namen oder nur einer Nummer werden **nicht** importiert, sondern in der Fehlerliste angezeigt
- Eine fehlerhafte Zeile bricht den Import nicht ab

Die Ergebnisse (Eintritte erfasst, neue Mitglieder, aktualisiert, bereits erfasst, Fehler) stehen im Importdialog und im Import-Protokoll.

## KI-Auswertung (Chat in den Statistiken)

Im Reiter **Statistiken → Chat** lassen sich Auswertungen in normaler Sprache abfragen, z. B. „Vergleiche September und Oktober“ oder „Wie viele Schnupperer waren pro Monat da?“. Die Antwort kommt als kurzer Text plus Tabelle und Diagramm.

**Einrichten (optional):**

1. Bei https://console.anthropic.com einen API-Key anlegen (Abrechnung nach Nutzung; das Modell Haiku 4.5 kostet bei gelegentlichen Fragen nur wenige Cent).
2. In die `.env` eintragen: `ANTHROPIC_API_KEY=sk-ant-...` (optional `STATS_CHAT_MODEL`, Standard `claude-haiku-4-5`).
3. Container neu erzeugen: `docker compose up -d`.

Ohne Key bleibt der Chat deaktiviert, der Reiter zeigt einen Hinweis; die übrige Anwendung ist nicht betroffen. Der Rechner braucht Internetzugang, rechnet aber nichts selbst; 8 GB RAM genügen.

**Datenschutz:** Die KI ruft nur vorbereitete Auswertungen ab (Einlässe pro Tag, Woche, Monat, Wochentag oder Uhrzeit, verschiedene Personen, Besuchshäufigkeit, Neuanlagen, Bestand je Kennzeichen) und bekommt ausschließlich zusammengerechnete Zahlen. **Namen und Mitgliedsnummern verlassen den Rechner nicht.** Der eingetippte Fragetext geht allerdings an den Anbieter, deshalb keine Namen eingeben. Fragen nach einzelnen Personen werden nicht beantwortet. Die Kennzeichen (ÜL, Neuer Ausweis, Schnupper, Vorschwimmen) gelten so, wie sie aktuell gesetzt sind, nicht rückwirkend. Pro Benutzer sind 20 Fragen pro Minute erlaubt.

## Datum, Uhrzeit und Zeitzone

- Datum und Uhrzeit eines Einlasses kommen vom **Browser** (Datum des Einlass-PCs). Der Server nutzt seine eigene Uhr nur, wenn nichts mitgeschickt wird.
- Server und Datenbank laufen in `Europe/Berlin` (`TZ`, im Image gesetzt).
- Im Kopf der Seite steht die Uhrzeit des Containers. Weicht sie um mehr als eine Minute vom Browser ab, wird sie orange markiert. Das passiert bei Docker Desktop nach dem Ruhezustand des PCs. Zurücksetzen:

```bash
docker run --rm --privileged alpine hwclock -s
```

## Backup und Wiederherstellung

```bash
# Sichern
docker exec einlasskontrolle su-exec postgres pg_dump -U einlass_user -d einlass_db > backup.sql

# Wiederherstellen (ersetzt alle Daten!)
docker exec einlasskontrolle su-exec postgres psql -U einlass_user -d einlass_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker exec -i einlasskontrolle su-exec postgres psql -U einlass_user -d einlass_db < backup.sql
docker restart einlasskontrolle
```

Der Ordner `backups/` ist in `.gitignore`, weil er personenbezogene Daten enthält.

## Finanzamt-Berichte

Die App erzeugt Besucherzahlen-Berichte als **Excel-Datei** (`.xlsx`) - **keine Namen auf der Übersicht, kein Geld**, die App erfasst keine Zahlungen:

- **Monat** (automatisch zum Monatswechsel erzeugt): Sheet "Übersicht" mit einer Zeile pro Tag des Monats (Datum, Eintritte gesamt, lückenlos auch an Tagen ohne Eintritte). Danach ein eigenes Sheet **pro Tag mit mindestens einem Eintritt** (Sheet-Name = Datum), mit den Mitgliedern dieses Tages: Spalte 1 Mitgliedsnummer, Spalte 2 Name, Spalte 3 Vorname.
- **Jahr** (nur auf Knopfdruck, keine Automatik): Sheet "Übersicht" mit einer Zeile pro Monat (Monat, Eintritte gesamt). Danach ein Sheet **pro Monat mit mindestens einem Eintritt** (statt pro Tag, sonst zu viele Sheets) mit allen Besuchen dieses Monats in den gleichen drei Spalten - ein Mitglied, das mehrfach im Monat da war, erscheint entsprechend mehrfach.

Beide Berichtsarten landen im Ordner `reports/` neben der `docker-compose.yml` (lokales Bind-Mount, `REPORTS_DIR` im Container).

Soll der Bericht automatisch auf ein Netzlaufwerk (UNC-Pfad) kopiert werden, ist das in zwei Schritte aufgeteilt, weil Docker Desktop einen UNC-Pfad nicht zuverlässig direkt einbinden kann:

1. Der Container schreibt ausschließlich in den lokalen `reports/`-Ordner.
2. [`sync-reports-to-network.ps1`](sync-reports-to-network.ps1) kopiert von dort per `robocopy` auf das Netzlaufwerk - `$NetworkPath` im Skript anpassen, dann als tägliche Windows-Aufgabe registrieren:

```powershell
schtasks /create /tn "EinlassBerichteSync" /tr "powershell -ExecutionPolicy Bypass -File C:\...\sync-reports-to-network.ps1" /sc daily /st 03:00
```

In der Aufgabenplanung zusätzlich **"Computer zum Ausführen dieser Aufgabe aufwecken"** aktivieren, falls der PC zeitweise im Standby ist - sonst läuft die Aufgabe an diesem Tag einfach nicht.

Manuell erzeugen (nur Admins, auch im Finanzamt-Tab unter Protokoll möglich): `POST /api/v1/reports/generate?scope=month&period=yyyy-MM` oder `?scope=year&period=yyyy` (Default ohne `period`: letzter abgeschlossener Monat bzw. letztes Jahr). Vorhandene Berichte: `GET /api/v1/reports`, Download über `GET /api/v1/reports/:filename/download`.

## Projektstruktur

```
backend/     Express + TypeScript, postgres.js; Migrationen in src/lib/migrate.ts
frontend/    React + Vite + TypeScript + Tailwind, TanStack Query, PWA
Dockerfile   All-in-One-Image (Postgres + Backend + Frontend)
entrypoint.sh  Startskript des Images (initialisiert die Datenbank, startet Postgres und Backend)
nginx/       Konfiguration für die Mehr-Container-Varianten
scripts/     Hilfsskripte
```

## API (Auswahl)

Alle Routen unter `/api/v1`, außer Login und Registrierung mit Bearer-Token.

| Bereich | Routen |
|---|---|
| Auth | `POST /auth/login`, `/auth/register`, `/auth/change-password`, `GET /auth/me` |
| Scan | `POST /scan` (`qrCode`, optional `entryDate`, `clientNow`) |
| Einlässe | `GET /entries?date=`, `POST /entries`, `PATCH /entries/:id/notes`, `DELETE /entries/:id`, `GET /entries/today/count?date=` |
| Export | `GET /entries/export/summary?date=`, `GET /entries/export?date=&type=new-card\|trial\|pre-swim` |
| Mitglieder | `GET /members`, `GET /members/list`, `POST/PUT /members`, `PATCH /members/:id/flags` |
| Import | `POST /import/members`, `GET /import/logs` |
| Statistik | `GET /stats/dashboard?date=`, `/stats/workload`, `/stats/by-day`, `/stats/by-member/:id`, `/stats/summary`, `/stats/new-card` |
| Chat | `GET /stats/chat/status`, `POST /stats/chat` (`messages[]`, `today`) |
| System | `GET /system/time` |
| Benutzer (Admin) | `GET /users`, Registrierungen freigeben oder ablehnen, sperren, löschen |
