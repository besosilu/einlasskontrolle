# Tickets für GitHub Issues

Abgeleitet aus dem Plan `ich-m-chte-mit-den-swift-stallman.md` (Mitgliederregister + Mehrfach-Datei-Import).
Einfach jeden Abschnitt als eigenes Issue in GitHub anlegen (Titel = Überschrift, Rest = Beschreibung).

---

## [Backend] Paginierte Mitgliederliste (`GET /members/list`)

**Status:** ✅ bereits umgesetzt (dieser Branch)

Neuer Endpunkt für das kommende Mitgliederregister, getrennt vom bestehenden Such-Endpunkt (`GET /members`, wird von der Autocomplete genutzt und bleibt unverändert).

- [x] `listMembers()` in `backend/src/services/members.service.ts` – optional `search`, paginiert (`limit`/`offset`), liefert `{ members, total }`
- [x] `list()` Controller in `backend/src/controllers/members.controller.ts`
- [x] Route `GET /members/list` registriert **vor** `GET /members/:id` (Reihenfolge kritisch wegen Express-Routing)

---

## [Backend] Mehrfach-Datei-CSV-Import

**Status:** ✅ bereits umgesetzt (dieser Branch)

- [x] `upload.single('file')` → `upload.array('files', 200)` in `backend/src/routes/import.routes.ts`
- [x] `importMembers()`-Controller verarbeitet mehrere Dateien **sequentiell** (wichtig für korrekte Duplikat-Erkennung über Dateigrenzen hinweg)
- [x] Fehler-Isolation: eine fehlerhafte Datei bricht den gesamten Batch nicht ab, sondern liefert ein `failed`-Ergebnis für genau diese Datei
- [x] Response-Format auf `{ results: ImportResult[] }` (ein Eintrag pro Datei) umgestellt

---

## [Frontend] Mehrfach-Datei-Auswahl im Import

**Status:** ✅ bereits umgesetzt (dieser Branch)

- [x] `FileDropzone.tsx`: `multiple`-Attribut, Mehrfachauswahl per Drag&Drop/Dateidialog, Vorschauliste
- [x] `api/import.ts`: `importMembers(files: File[], entryDate?)` sendet alle Dateien in einem Request
- [x] `ImportPage.tsx`: zeigt pro hochgeladener Datei eine eigene Ergebniskarte (Stats bzw. Fehler-Banner), kein aggregiertes Gesamtergebnis
- [x] Typen (`ImportResult.filename`, `ImportBatchResult`) ergänzt

---

## [Frontend] Mitgliederregister-Seite (`/members`)

**Status:** 🚧 offen

Neue Seite mit Tabelle aller Mitglieder, durchsuchbar und paginiert, nutzt den neuen `GET /members/list`-Endpunkt.

- [ ] `frontend/src/pages/MembersPage.tsx`: Suchfeld (debounced), Tabelle (Name, Mitgliedsnummer, Quelle-Badge, Flags-Badges, Aktionen), Pagination (Muster aus `LogsPage.tsx`)
- [ ] `frontend/src/components/layout/Sidebar.tsx`: neuer Nav-Eintrag "Mitglieder" (Icon `IdCard`), direkt nach "Einlass"
- [ ] `frontend/src/App.tsx`: Route `/members` (kein Admin-Gate, für alle eingeloggten Nutzer sichtbar)
- [ ] `frontend/src/api/members.ts`: `list()`-Methode (bereits vorhanden ✅), ggf. Feinschliff

---

## [Frontend] Mitglied bearbeiten (Dialog)

**Status:** 🚧 offen

- [ ] `frontend/src/components/members/MemberEditDialog.tsx` (neu): Name/Mitgliedsnummer-Felder + Flags (`needsNewCard`, `isTrainer`, `isTrial` inkl. `trialRegistrationDate`)
- [ ] Nutzt bestehende Endpunkte `PUT /members/:id` und `PATCH /members/:id/flags` (keine neuen Backend-Änderungen nötig)
- [ ] `api/members.ts`: `update()`-Methode (bereits vorhanden ✅)
- [ ] Einbindung in `MembersPage.tsx` (Button "Bearbeiten" pro Zeile)
- [ ] Nach Speichern: Query-Invalidierung für `members-list` und `member-search` (Autocomplete bleibt konsistent)

---

## Hinweis zur bestehenden Dedupe-Logik

Keine neue Matching-Logik für Mitglieder-Duplikate – bewusste Entscheidung laut Plan. Die bestehende Prüfung (Scan: Auto-Anlage nur bei vollständigem QR-Code; manuelle Erfassung: find-or-create; Import: Abgleich über Mitgliedsnummer/Name) gilt als ausreichend und wird im neuen Register nur sichtbar gemacht (Spalte "Quelle").
