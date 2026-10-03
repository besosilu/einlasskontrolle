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
