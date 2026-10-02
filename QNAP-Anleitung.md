# Einlassüberwachung – Deployment auf QNAP NAS

---

## Voraussetzungen

- QNAP NAS mit QTS 5.x
- **Container Station** installiert (QTS App Center → Container Station)
- PC im gleichen Netzwerk wie die NAS
- DuckDNS-Konto (kostenlos auf https://www.duckdns.org)
- FritzBox als Router

---

## Phase 1 – QNAP vorbereiten

### 1.1 Container Station installieren

1. QTS öffnen → **App Center** → nach „Container Station" suchen → **Installieren**
2. Nach der Installation: Container Station öffnen → kurz warten bis Docker bereit ist

### 1.2 SSH aktivieren

SSH wird benötigt um Befehle direkt auf der NAS auszuführen.

1. QTS → **Systemsteuerung** → **Netzwerk- & Dateidienste** → **Telnet / SSH**
2. Haken bei **SSH aktivieren** setzen → Port `22` → **Übernehmen**

### 1.3 Feste IP für die NAS vergeben (in der FritzBox)

Damit die Portweiterleitung dauerhaft funktioniert, muss die NAS immer die gleiche IP haben.

1. FritzBox aufrufen: http://fritz.box
2. **Heimnetz** → **Netzwerk** → Tab **IP-Adressen**
3. NAS in der Geräteliste suchen → **Bearbeiten** → Haken bei **Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen** → Speichern
4. IP der NAS notieren, z.B. `192.168.178.50`

---

## Phase 2 – DuckDNS einrichten

### 2.1 Domain anlegen

1. https://www.duckdns.org aufrufen → mit Google/GitHub anmelden
2. Unter „**add domain**" einen Namen eingeben, z.B. `meinverein` → **add domain**
3. Den angezeigten **Token** kopieren und sicher aufbewahren

### 2.2 DynDNS in der FritzBox konfigurieren

1. FritzBox → **Internet** → **Freigaben** → Tab **DynDNS**
2. Haken bei **DynDNS benutzen** setzen
3. Felder ausfüllen:

| Feld | Wert |
|------|------|
| Anbieter | Benutzerdefiniert |
| Update-URL | `https://www.duckdns.org/update?domains=meinverein&token=DEIN-TOKEN&ip=<ipaddr>` |
| Domainname | `meinverein.duckdns.org` |
| Benutzername | beliebig (z.B. `admin`) |
| Kennwort | Dein DuckDNS-Token |

4. **Übernehmen** → FritzBox aktualisiert jetzt automatisch die IP bei DuckDNS

### 2.3 Portweiterleitungen einrichten

1. FritzBox → **Internet** → **Freigaben** → **Portfreigaben**
2. **Gerät für Freigaben hinzufügen** → NAS auswählen
3. Zwei Freigaben anlegen:

| Bezeichnung | Protokoll | Externer Port | Interner Port |
|-------------|-----------|---------------|---------------|
| Einlass HTTP | TCP | 80 | 80 |
| Einlass HTTPS | TCP | 443 | 443 |

4. **Übernehmen**

---

## Phase 3 – Projektdateien anpassen

### 3.1 Passwort ändern

In `docker-compose.qnap.yml` das Passwort `EinlassDB_2024!` an **beiden** Stellen durch ein eigenes sicheres Passwort ersetzen:

```yaml
POSTGRES_PASSWORD: MeinSicheresPasswort123!
...
DATABASE_URL: postgresql://einlass_user:MeinSicheresPasswort123!@db:5432/einlass_db
```

### 3.2 Domain in der Nginx-Konfiguration eintragen

In `nginx/nginx.qnap.conf` alle Vorkommen von `meinverein.duckdns.org` durch die eigene Domain ersetzen (4 Stellen):

```nginx
server_name meinverein.duckdns.org;        # → eigene Domain
...
ssl_certificate     /etc/letsencrypt/live/meinverein.duckdns.org/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/meinverein.duckdns.org/privkey.pem;
```

---

## Phase 4 – Dateien auf die NAS übertragen

### 4.1 Per SSH verbinden (vom PC aus)

**Windows:** PowerShell oder Windows Terminal öffnen:co
```powershell
ssh admin@192.168.178.50
```
Passwort eingeben (NAS-Adminpasswort).

### 4.2 Ordnerstruktur anlegen

```bash
mkdir -p /share/Container/einlass/data/postgres
mkdir -p /share/Container/einlass/data/certbot/conf
mkdir -p /share/Container/einlass/data/certbot/www
mkdir -p /share/Container/einlass/nginx
mkdir -p /share/Container/einlass/db/init
```

### 4.3 Projektdateien kopieren

SSH-Verbindung schließen (`exit`), dann vom PC aus:

```powershell
# Gesamtes Projekt auf die NAS kopieren
scp -r "f:\Entwicklung\EinlassÜberwachung\*" admin@192.168.178.34:/share/Container/einlass/
```

Alternativ: **File Station** in QTS öffnen → `Container/einlass/` → Dateien per Drag & Drop hochladen.

### 4.4 Nginx-Konfiguration aktivieren

Per SSH auf der NAS:
```bash
cp /share/Container/einlass/nginx/nginx.qnap.conf \
   /share/Container/einlass/nginx/nginx.conf
```

---

## Phase 5 – SSL-Zertifikat ausstellen (einmalig)

Das Zertifikat kann erst ausgestellt werden, wenn Port 80 von außen erreichbar ist (Phase 2 muss abgeschlossen sein).

### 5.1 Nginx temporär mit HTTP-Only starten

Damit Let's Encrypt die Domain verifizieren kann, braucht Nginx zuerst eine vereinfachte Konfiguration ohne HTTPS-Block.

Temporäre Konfiguration erstellen:
```bash
#cat > /share/Container/einlass/nginx/nginx.conf << 'EOF'
cat > nginx.conf << 'EOF'
events { worker_connections 1024; }
http {
  server {
    listen 80;
    server_name besosilu-apps.duckdns.org;
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }
    location / {
      return 200 'OK';
    }
  }
}
EOF
```
> `meinverein.duckdns.org` durch die eigene Domain ersetzen.

### 5.2 Nur Nginx und Certbot starten

```bash
cd /share/Container/einlass
docker-compose -f docker-compose.qnap.yml up -d nginx certbot
```

### 5.3 Zertifikat anfordern

```bash
docker-compose -f docker-compose.qnap.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email b.leonhardt@web.de \
  --agree-tos \
  --no-eff-email \
  -d besosilu-apps.duckdns.org
```
> `deine@email.de` und `meinverein.duckdns.org` ersetzen.

Erfolgsmeldung: `Successfully received certificate.`

### 5.4 Vollständige Nginx-Konfiguration aktivieren

```bash
cp /share/Container/einlass/nginx/nginx.qnap.conf \
   /share/Container/einlass/nginx/nginx.conf
```

---

## Phase 6 – Anwendung starten

### 6.1 Alle Container bauen und starten

```bash
cd /share/Container/einlass
docker compose -f docker-compose.qnap.yml up -d --build
```

Der erste Build dauert einige Minuten (Node.js und React werden kompiliert).

### 6.2 Status prüfen

```bash
docker compose -f docker-compose.qnap.yml ps
```

Alle Container sollten den Status `Up` haben:

```
einlass_db        Up (healthy)
einlass_backend   Up
einlass_frontend  Up
einlass_nginx     Up
einlass_certbot   Up
```

### 6.3 Logs prüfen (bei Problemen)

```bash
# Alle Container
docker compose -f docker-compose.qnap.yml logs

# Nur Backend (inkl. Datenbankfehler)
docker compose -f docker-compose.qnap.yml logs backend

# Nur Nginx
docker compose -f docker-compose.qnap.yml logs nginx
```

---

## Phase 7 – Erreichbarkeit testen

1. Im Browser öffnen: `https://meinverein.duckdns.org`
2. Das Schloss-Symbol im Browser zeigt an, dass HTTPS aktiv ist
3. Die Anwendung sollte vollständig laden

**Lokal im Heimnetz** ist die Anwendung auch direkt über die NAS-IP erreichbar:
`http://192.168.178.50`

---

## Wartung

### Container nach einem NAS-Neustart

Container Station ist so konfiguriert, dass Container mit `restart: unless-stopped` automatisch starten. Falls nicht:

```bash
cd /share/Container/einlass
docker compose -f docker-compose.qnap.yml up -d
```

### Anwendung aktualisieren (neuer Code)

```bash
cd /share/Container/einlass

# Neue Dateien hochladen (per SCP oder File Station), dann:
docker compose -f docker-compose.qnap.yml up -d --build
```

### Datenbank-Backup

Die PostgreSQL-Daten liegen unter `/share/Container/einlass/data/postgres/`.
Sie können direkt über **HBS 3 Hybrid Backup Sync** in QNAP gesichert werden.

Manuelles Backup:
```bash
docker exec einlass_db pg_dump -U einlass_user einlass_db \
  > /share/Container/einlass/backup_$(date +%Y%m%d).sql
```

### SSL-Zertifikat

Das Zertifikat wird automatisch vom Certbot-Container alle 12 Stunden geprüft und bei Bedarf erneuert. Kein manueller Eingriff nötig.

---

## Häufige Probleme

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Port 80/443 nicht erreichbar | Portweiterleitung fehlt | FritzBox Portfreigaben prüfen |
| Zertifikat schlägt fehl | Domain zeigt nicht auf die NAS | DynDNS in FritzBox prüfen, `nslookup meinverein.duckdns.org` ausführen |
| Backend startet nicht | DB noch nicht bereit | `docker compose logs backend` prüfen, ggf. nochmal starten |
| Seite lädt nicht | Nginx-Konfiguration fehlerhaft | `docker compose logs nginx` prüfen |
