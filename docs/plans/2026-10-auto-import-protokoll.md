# Plan: Sichtbares Protokoll für Auto-Import-Dateien (inkl. Fehlerfälle) im Scanner-Widget

**Status:** genehmigt, Umsetzung begonnen
**Erstellt:** 2026-10-23
**Bezug:** Ergänzt `docs/plans/2026-10-einlass-auto-import.md`

## Context

Der Auto-Import (`backend/src/services/autoImport.service.ts`) schreibt für jede erfolgreich (auch teilweise fehlerhaft) verarbeitete Datei bereits einen `import_logs`-Eintrag über `importMembersFromCsv()` - inkl. Zeilen-Fehlerliste (`errors: [{line, content, reason}]`). Zwei Fehlerfälle erzeugen aktuell aber **keinen** Log-Eintrag und sind damit im UI komplett unsichtbar:

- **Gap A:** Dateiname passt auf `dd-mm-yyyy.txt`, kodiert aber ein ungültiges Kalenderdatum (z.B. `31-02-2026.txt`) → nur `console.warn`, Datei wandert nach `inbox/fehler/`.
- **Gap B:** `importMembersFromCsv()` wirft eine echte Exception (nicht die intern bereits abgefangenen Zeilenfehler) → nur `console.error`, Datei wandert nach `inbox/fehler/`.

Der Nutzer möchte: zu jeder Auto-Import-Datei ein per UI aufrufbares Protokoll mit Anzahl importierter Einträge, und im Fehlerfall eine detaillierte Fehlermeldung inkl. Zeilen-Fehlerprotokoll.

**Mit dem Nutzer geklärt:** Die Protokoll-Ansicht lebt **ausschließlich** im `AutoImportFeedWidget.tsx` auf der Scanner-Seite (nicht in `LogsPage.tsx`/Protokoll-Seite). Das Widget bleibt bei "letzte 5 Auto-Importe", keine Pagination.

## Entscheidungen

**Gap A/B schließen - zentral in `import.service.ts`:** neue exportierte Funktion `logImportFailure(filename, reason, source = 'auto')`, schreibt einen `import_logs`-Row ohne Zeilenverarbeitung (alle Zähler 0, ein Fehler-Eintrag `{line: 0, content: '', reason}`). Das Schema ist exakt das bereits in `import.controller.ts`'s `importMembers`-Fehlerzweig verwendete Muster für "ganze Datei fehlgeschlagen" - keine neue Konvention. Keine Migration nötig, alle Spalten existieren bereits.

`autoImport.service.ts` ruft `logImportFailure` an beiden Fehlerstellen auf, **vor** dem jeweiligen `moveTo(...)`, selbst in ein eigenes try/catch gewrapped (ein Logging-Fehler darf den Datei-Move nach `fehler/` nie verhindern):

- Gap A (invalid-date-Zweig): Reason `` `Ungültiges Kalenderdatum im Dateinamen: ${candidate.filename}` ``
- Gap B (äußerer catch um `importMembersFromCsv`): Reason `err instanceof Error ? err.message : 'Unbekannter Fehler beim Verarbeiten der Datei'`

Beide Aufrufe mit `source: 'auto'`.

**Frontend - `AutoImportFeedWidget.tsx` um Expand-Interaktion erweitern, keine neue gemeinsame Komponente:** Logik direkt im Widget duplizieren statt mit `ImportLogRow` (`LogsPage.tsx`) zu teilen - konsistent mit dem Projekt-Prinzip "small, direct per-flow logic over shared abstraction" (CLAUDE.md), die zu teilende Logik ist klein und beide Stellen haben unterschiedliche Darstellungskontexte.

Konkret:
- Ein `useState<number | null>` (`expandedId`) auf Widget-Ebene.
- Klick auf eine Zeile togglet `expandedId`.
- Aufgeklappt zusätzlich: Zähler-Aufschlüsselung (`entriesCreated`, `+N neu`, `~N akt.`), und falls `errors.length > 0` die Fehlerliste (`Zeile {e.line}: {e.reason}` + optional `{e.content}`).
- Kein neuer API-Call nötig - `importApi.getLogs(5, 0, 'auto')` liefert bereits alle benötigten Felder.

## Vorgehen

1. `backend/src/services/import.service.ts` (geändert): neue exportierte Funktion `logImportFailure()`.
2. `backend/src/services/autoImport.service.ts` (geändert): Aufruf von `logImportFailure` an beiden Fehlerstellen vor `moveTo(...)`.
3. `frontend/src/components/scanner/AutoImportFeedWidget.tsx` (geändert): Expand-Interaktion mit Zähler/Fehlerliste.

Keine Migration, keine Änderung an `import.controller.ts`/`import.routes.ts`/`frontend/src/api/import.ts`/`frontend/src/types/index.ts`/`LogsPage.tsx`.

## Kritische Dateien

- `backend/src/services/import.service.ts`
- `backend/src/services/autoImport.service.ts`
- `frontend/src/components/scanner/AutoImportFeedWidget.tsx`

## Verifikation

1. `npm run build` in `backend/` und `frontend/` fehlerfrei.
2. Gap A: `31-02-2026.txt` in `./inbox/` → landet in `inbox/fehler/`, neuer `import_logs`-Eintrag `source='auto'`, `records_total=0`, Fehlertext sichtbar im Widget.
3. Gap B: echter Wurf provoziert → Datei landet in `fehler/`, Exception-Message im Widget sichtbar.
4. Regression Zeilenfehler: Datei mit einer fehlerhaften Zeile → weiterhin `verarbeitet/`, im Widget aufklappbar mit korrekter Zeile/Reason/Content.
5. Erfolgsfall unverändert: Zähler korrekt, keine Fehlerliste.
6. Widget-Verhalten unverändert (max. 5 Zeilen, keine Pagination, Toast-Verhalten, kein Einfluss auf `useScanner`).
7. `GET /api/v1/import/logs?source=auto` liefert die neuen Zeilen korrekt.
