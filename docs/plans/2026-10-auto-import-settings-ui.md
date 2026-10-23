# Plan: UI-Konfiguration für den Auto-Import-Netzlaufwerkpfad

**Status:** genehmigt, Umsetzung begonnen
**Erstellt:** 2026-10-23
**Bezug:** Ergänzt `docs/plans/2026-10-einlass-auto-import.md`

## Context

Der Netzlaufwerk-Pfad für den automatischen Einlass-Import wird aktuell als fester Parameter (`$NetworkPath`) im Windows-PowerShell-Skript `sync-inbox-from-network.ps1` konfiguriert - eine Änderung erfordert direktes Bearbeiten des Skripts auf dem Host. Der Nutzer möchte diesen Pfad statt dessen über einen Konfigurationsbereich in der Web-UI setzen können.

**Architektonische Besonderheit:** Das Skript läuft außerhalb des Docker-Containers auf dem Windows-Host (per Windows-Aufgabenplanung), die UI/Backend laufen im Container. Es braucht also eine Brücke zwischen "in der UI gespeicherter Wert" und "vom Host-Skript gelesener Wert".

**Mit dem Nutzer geklärt:** Datei-Brücke (nicht API-Aufruf, nicht nur Anzeige) - das Backend speichert den Pfad in der DB (Quelle der Wahrheit für die UI) und schreibt ihn bei jeder Änderung zusätzlich automatisch in eine kleine Datei im bereits bestehenden `inbox/`-Bind-Mount. Das Skript liest diese Datei bei jedem Lauf statt eines festen Parameters - kein neuer API-Key, keine Netzwerk-Anfrage vom Skript aus nötig, nutzt exakt das bereits etablierte Container↔Host-Dateimuster (wie `reports/`, `backups/`, `inbox/`).

## Entscheidungen

**Speicherung:** neue, generische Tabelle `app_settings(key, value, updated_at)` - bewusst generisch, weil der Nutzer einen Konfigurations**bereich** möchte, der künftig weitere Einstellungen aufnehmen können soll, ohne dass jede neue Einstellung eine eigene Migration braucht. Für die erste Einstellung: Key `auto_import_network_path`.

**Backend-API:** `GET/PUT /api/v1/settings/auto-import` (bewusst ein spezifischer, typisierter Endpunkt statt einer generischen `/settings/:key`-CRUD-Route). Admin-only (`requireAdmin`) - kein neuer API-Key nötig, da nur die Browser-UI diesen Endpunkt aufruft, das PowerShell-Skript liest die Datei direkt.

**Datei-Brücke:** `settings.service.ts` schreibt beim Speichern atomar (`.tmp-` + `fs.renameSync`) eine Datei `.sync-config.json` (`{ "networkPath": "..." }`) in den bestehenden `AUTO_IMPORT_INBOX_DIR`-Ordner (Default `/app/inbox`). Diese Datei stört den Scanner nicht - `scanInbox()` ignoriert bereits jede Datei, die nicht auf `dd-mm-yyyy.txt` passt. Schreibreihenfolge: zuerst die Datei, dann die DB.

**`sync-inbox-from-network.ps1` Anpassung:** `$NetworkPath` wird optional. Priorität: explizit übergebener `-NetworkPath`-Parameter > `.sync-config.json` im `$TargetPath`-Ordner > bisheriger hartkodierter Default.

**Frontend:** neue Seite `SettingsPage.tsx` unter Route `/einstellungen`, route-level `AdminRoute`-geschützt (wie `/users`). Neuer Sidebar-Eintrag "Einstellungen" nur für Admins. Sektion "Automatischer Einlass-Import" mit Textfeld + Speichern-Button, Struktur offen für künftige weitere Sektionen.

## Vorgehen

### Backend
1. `backend/src/lib/migrate.ts`: Migration `011_app_settings`.
2. `backend/src/services/settings.service.ts` (neu): `getAutoImportNetworkPath()`, `setAutoImportNetworkPath(path)` (Datei zuerst, dann DB).
3. `backend/src/controllers/settings.controller.ts` + `backend/src/routes/settings.routes.ts` (neu).
4. `backend/src/index.ts`: Route mounten (`requireAdmin`).

### Windows-Skript
5. `sync-inbox-from-network.ps1`: Datei-Fallback-Logik, Log-Zeile mit verwendeter Quelle.

### Frontend
6. `frontend/src/api/settings.ts` (neu).
7. `frontend/src/types/index.ts`: `AutoImportSettings`.
8. `frontend/src/pages/SettingsPage.tsx` (neu).
9. `frontend/src/App.tsx`: Route `/einstellungen` + `AdminRoute`.
10. `frontend/src/components/layout/Sidebar.tsx`: Nav-Eintrag "Einstellungen".

### Dokumentation
11. `README.md` aktualisieren.
12. `docs/README.md` Plantabelle.

## Kritische Dateien
- `backend/src/services/settings.service.ts`, `sync-inbox-from-network.ps1`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`

## Verifikation
1. `npm run build` backend+frontend fehlerfrei.
2. Migration genau einmal angewendet.
3. `PUT /api/v1/settings/auto-import` als Admin → 200, `GET` liefert Wert, `.sync-config.json` korrekt, DB-Zeile korrekt.
4. Leerer String → 400, nichts verändert.
5. Ohne Admin → 403.
6. UI: Nav-Eintrag nur für Admin, Formular/Toast funktionieren.
7. PS1-Skript: Datei-Fallback greift ohne `-NetworkPath`; expliziter Parameter überschreibt weiterhin.

## Risiken / offene Punkte
- Keine Format-Validierung über "nicht leer" hinaus (Platzhalter zur Orientierung).
- `app_settings` generisch angelegt, künftige Einstellungen bekommen eigene spezifische Routen statt eines generischen `/settings/:key`.
