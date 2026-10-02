# Einlassüberwachung Schwimmverein

Webapplikation zur Einlasskontrolle mit QR-Code-Scanner und manueller Eingabe.

## Starten (Produktion)

```bash
cp .env.example .env
# .env anpassen (DB_PASSWORD setzen)

docker compose up -d --build
```

Die App ist dann unter `http://localhost` erreichbar.

## Starten (Entwicklung)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

## QR-Code-Format

Der Handscanner muss QR-Codes im folgenden Format scannen:

```
SWIM:12345:NACHNAME:VORNAME
```

Alternativ funktioniert auch nur die Mitgliedsnummer:

```
12345
```

## CSV-Import

Format (Semikolon-getrennt):

```
Mitgliedsnummer;Name;Vorname
12345;Mustermann;Max
```

- Erste Zeile kann ein Header sein (wird automatisch erkannt und übersprungen)
- UTF-8-kodiert (auch Excel-CSV mit BOM wird unterstützt)
- Max. 10 MB pro Datei
