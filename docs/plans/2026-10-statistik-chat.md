# Plan: Chat mit den Statistiken

**Status:** umgesetzt (ohne Live-Test mit API-Key)
**Erstellt:** 2026-10-15

## Context

Auswertungen (z. B. "Wie viele Schnupperer pro Monat?", "Besuche pro Wochentag im letzten Quartal", "Vergleiche September und Oktober") erfordern heute Klicken durch die Tabs der Statistik-Seite und manuelles Rechnen. Ein Chat soll solche Fragen in normaler Sprache beantworten.

### Entscheidungen

- **Hardware:** Die Lösung muss auf einem PC mit **8 GB RAM** laufen. Ein lokales Modell ist dafür unrealistisch: Docker (Postgres + App) und Browser belegen bereits einen großen Teil, ein 3B-Modell wäre langsam und bei mehrstufigen Auswertungen unzuverlässig. **Daher Claude API (Cloud) mit Haiku 4.5**; der PC macht nur HTTP-Aufrufe. Voraussetzung: Internet + API-Key (Abrechnung nach Nutzung, bei gelegentlichen Fragen wenige Cent).
- **Datenschutz:** Nur Zahlen, **keine Namen oder Mitgliedsnummern** gehen an das Modell (viele Mitglieder sind Kinder).
- **Abfrage-Art:** **Feste Auswertungs-Werkzeuge** (Tool Use), kein freies SQL.

## Ansatz

Claude bekommt eine Handvoll vorbereiteter, parametrisierter Abfragen als Tools und ruft sie nach Bedarf (auch mehrfach, z. B. für Vergleiche) auf. Die Tools liefern ausschließlich aggregierte Zahlen. Die App rechnet nichts "nach", das Modell formuliert nur die Antwort. Die Rohdaten der Tool-Aufrufe schickt der Server zusätzlich an die UI, die sie als Tabelle/Diagramm anzeigt, sodass Zahlen nicht vom Modell abgetippt werden müssen (kein Halluzinationsrisiko in Tabellen).

### Backend

1. **Abhängigkeit** `@anthropic-ai/sdk` in `backend/package.json`.
2. **Konfiguration** (Umgebungsvariablen, optional): `ANTHROPIC_API_KEY`, `STATS_CHAT_MODEL` (Default `claude-haiku-4-5`). Ohne Key liefert die Route `503` mit Hinweistext, der Rest der App ist unberührt. In `.env.example` und den Compose-Dateien als `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` durchreichen.
3. **`backend/src/services/statsChat.queries.ts`**: die Tools als reine, namenlose Aggregat-Abfragen:
   - `visits_over_time` (`group_by`: day | week | month | weekday | hour; `from`, `to`; optional `method`, Filter auf Kennzeichen ÜL/Neuer Ausweis/Schnupper/Vorschwimmen)
   - `unique_visitors` (verschiedene Mitglieder pro Zeitraum/Gruppierung)
   - `visit_frequency` (Verteilung: wie viele Mitglieder 1×, 2×, 3–5×, 6+ kamen)
   - `new_members` (neu angelegte Mitglieder pro Zeitraum, nach Quelle)
   - `flag_totals` (aktuelle Anzahl je Kennzeichen)
   - Datumsvalidierung mit `parseDay` (`backend/src/lib/dateParams.ts`); Tageszuordnung über `entries.entry_date`. Die bestehenden Funktionen `getStatsByDay`/`getStatsByMember` liefern Namen und werden **nicht** verwendet.
   - Begrenzungen: maximal 400 Gruppen pro Antwort, maximal 5 Jahre Zeitraum, Parameter per zod geprüft.
4. **`backend/src/services/statsChat.service.ts`**: Tool-Use-Schleife (max. 6 Runden), deutscher Systemprompt (Vereinskontext, "nur aus Tool-Daten antworten", "keine Namen", heutiges Datum aus dem Browser, Wochen beginnen Montag, Zeitzone Europe/Berlin), `max_tokens` ca. 1024, Gesprächsverlauf auf die letzten ~20 Nachrichten begrenzt. Gibt `{ answer, datasets }` zurück.
5. **Route** `POST /api/v1/stats/chat` (`stats.routes.ts` + `stats.controller.ts`, hinter `requireAuth`). Eingabe: `messages[]`, `today` (yyyy-MM-dd vom Browser). Eingabegrenzen, Rate-Limit pro Benutzer (z. B. 20 Fragen/Minute), Timeout, freundliche Fehlertexte, Token-Verbrauch ins Log.

### Frontend

6. **Neuer Tab "Chat"** in `StatsPage.tsx`, Komponente `StatsChat.tsx`: Nachrichtenliste, Enter sendet, Beispielfragen, Lade- und Fehlerzustand, Hinweis "Es werden nur Zahlen ausgewertet, bitte keine Namen eingeben".
7. **Darstellung der `datasets`** als Tabelle und Balken-/Liniendiagramm mit `recharts` (bereits Abhängigkeit); kein Markdown-Paket nötig.
8. **API-Funktion** `chat` in `frontend/src/api/stats.ts` (sendet `todayIso()`).
9. Gespräch lebt im Komponenten-State, keine Speicherung in der Datenbank.

### Dokumentation

10. `README.md` und `Installation.md`: Abschnitt "KI-Auswertung" (API-Key anlegen, Variable setzen, Datenschutz, Kosten, 8-GB-Hinweis).

## Kritische Dateien

- neu: `backend/src/services/statsChat.queries.ts`, `backend/src/services/statsChat.service.ts`, `frontend/src/components/stats/StatsChat.tsx`
- geändert: `backend/package.json`, `backend/src/routes/stats.routes.ts`, `backend/src/controllers/stats.controller.ts`, `frontend/src/pages/StatsPage.tsx`, `frontend/src/api/stats.ts`, `frontend/src/types/index.ts`, Compose-Dateien, `.env.example`, `README.md`, `Installation.md`

## Verifikation

1. Docker-Build (`docker build -f Dockerfile .`) läuft fehlerfrei durch (Typecheck Backend + Frontend).
2. Testcontainer mit **Kopie der Produktionsdaten** (Dump → zweiter Container auf Port 3002, Test-Admin anlegen).
3. **Tools einzeln prüfen:** Antworten gegen direkte SQL-Abfragen und die vorhandenen Statistik-Tabs vergleichen.
4. **Datenschutz:** automatisierte Prüfung, dass keine Tool-Antwort Felder wie `last_name`, `first_name`, `member_number` enthält.
5. **Ohne Key:** Route liefert `503` mit Hinweis, Chat-Tab zeigt Einrichtungshinweis, restliche App unverändert.
6. **Mit Key:** Beispielfragen (Wochentage, Monatsvergleich, Schnupperer pro Monat, Frage nach einem Namen) und Zahlenabgleich; Rate-Limit und Eingabegrenzen testen; ohne Login `401`.
7. Danach: Deployment in den Container, Commit, Push.

## Vom Nutzer zu erledigen / Risiken

- **Anthropic-API-Key** anlegen und in der `.env` eintragen; **Internetzugang** für den Container nötig. Ohne beides bleibt der Chat deaktiviert.
- Laufende Kosten nach Nutzung (Haiku ist die günstigste Stufe; Modell per `STATS_CHAT_MODEL` änderbar).
- Der Fragetext selbst geht an die API; die UI weist darauf hin, keine Namen einzugeben.
- Nicht Teil von v1: Streaming der Antwort, gespeicherte Chat-Verläufe, Namen-Auswertungen (z. B. "Wer kam am häufigsten?") rein lokal ohne Modell.
