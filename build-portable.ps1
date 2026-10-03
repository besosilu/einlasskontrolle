# Baut ein portables, fertiges Docker-Image der gesamten Anwendung (Postgres+Backend+Frontend in einem Image)
# und packt alles zusammen, was man braucht, um es auf einem beliebigen Windows-PC mit Docker Desktop zu starten.
# Ausfuehren: powershell -ExecutionPolicy Bypass -File .\build-portable.ps1

$PLATFORM = "linux/amd64"
$IMAGE = "einlasskontrolle:latest"
$OUT = "$PSScriptRoot\release"

New-Item -ItemType Directory -Force -Path $OUT | Out-Null

Write-Host "== Image bauen ($PLATFORM) ==" -ForegroundColor Cyan
docker build --platform $PLATFORM -t $IMAGE -f "$PSScriptRoot\Dockerfile" $PSScriptRoot
if ($LASTEXITCODE -ne 0) { Write-Host "Build fehlgeschlagen." -ForegroundColor Red; exit 1 }

Write-Host "`n== Image exportieren ==" -ForegroundColor Cyan
docker save -o "$OUT\einlasskontrolle.tar" $IMAGE
if ($LASTEXITCODE -ne 0) { Write-Host "Export fehlgeschlagen." -ForegroundColor Red; exit 1 }

Write-Host "`n== Begleitdateien kopieren ==" -ForegroundColor Cyan
Copy-Item "$PSScriptRoot\docker-compose.portable.yml" "$OUT\docker-compose.yml" -Force

Set-Content -Path "$OUT\.env.example" -Value @'
POSTGRES_PASSWORD=EinSicheresPasswort123!
JWT_SECRET=EinZufaelligerLangerGeheimerString
APP_URL=http://localhost:3001
'@

Set-Content -Path "$OUT\start.bat" -Value @'
@echo off
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
  echo .env wurde aus .env.example erstellt.
  echo Bitte .env oeffnen, Passwort/Secret anpassen und dieses Skript erneut starten.
  pause
  exit /b
)

echo Lade Docker-Image...
docker load -i einlasskontrolle.tar
if errorlevel 1 (
  echo Fehler beim Laden des Images. Ist Docker Desktop gestartet?
  pause
  exit /b
)

echo Starte Anwendung...
docker compose up -d

echo.
echo Fertig. Anwendung erreichbar unter: http://localhost:3001
echo Erster Login: admin@local / admin  (Passwort muss geaendert werden)
pause
'@

Set-Content -Path "$OUT\LIESMICH.txt" -Value @'
Einlassueberwachung - portable Installation
=============================================

Voraussetzung: Docker Desktop ist installiert und gestartet.

1. Alle Dateien in diesem Ordner auf den Ziel-PC kopieren (z.B. per USB-Stick/Netzlaufwerk).
2. start.bat per Doppelklick ausfuehren.
   - Beim ersten Start wird .env aus .env.example erzeugt. Oeffne .env und passe
     POSTGRES_PASSWORD und JWT_SECRET an, dann start.bat erneut ausfuehren.
3. Im Browser oeffnen: http://localhost:3001
4. Erster Login: admin@local / admin (Passwort muss beim ersten Login geaendert werden)

Verwalten (in diesem Ordner, per PowerShell/CMD):
  docker compose ps              - Status pruefen
  docker compose logs -f         - Logs ansehen
  docker compose down            - Stoppen
  docker compose up -d           - Erneut starten

Die Datenbank-Daten liegen in einem Docker-Volume und bleiben beim Stoppen/Neustarten
erhalten. Nur "docker compose down -v" loescht sie.
'@

Write-Host "`n== Ergebnis ==" -ForegroundColor Green
Get-ChildItem $OUT | Select-Object Name, @{N="MB";E={[math]::Round($_.Length/1MB,1)}}
Write-Host "`nPortables Paket liegt in: $OUT" -ForegroundColor Green
Write-Host "Diesen Ordner komplett auf jeden Windows-PC mit Docker Desktop kopieren und start.bat ausfuehren."
