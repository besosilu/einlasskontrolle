# Build-Skript fuer QNAP ARM32 (armv7l)
# Ausfuehren: powershell -ExecutionPolicy Bypass -File .\build-for-qnap.ps1

$PLATFORM = "linux/arm/v7"
$SRC = "F:\Entwicklung\EinlassUeberwachung"
$OUT = "C:\tmp\qnap-build"

New-Item -ItemType Directory -Force -Path $OUT | Out-Null

Write-Host "== Buildx Builder einrichten ==" -ForegroundColor Cyan
docker buildx create --name qnap-builder --driver docker-container --use 2>$null
docker buildx inspect --bootstrap

Write-Host "`n== Backend bauen (ARM32) ==" -ForegroundColor Cyan
docker buildx build `
  --platform $PLATFORM `
  --output "type=docker,dest=$OUT\einlass_backend.tar" `
  -t einlass_backend:latest `
  "$SRC\backend"

Write-Host "`n== Frontend bauen (ARM32) ==" -ForegroundColor Cyan
docker buildx build `
  --platform $PLATFORM `
  --output "type=docker,dest=$OUT\einlass_frontend.tar" `
  -t einlass_frontend:latest `
  "$SRC\frontend"

Write-Host "`n== Ergebnis ==" -ForegroundColor Green
Get-Item "$OUT\einlass_backend.tar", "$OUT\einlass_frontend.tar" | `
  Select-Object Name, @{N="MB";E={[math]::Round($_.Length/1MB,1)}}

Write-Host "`nDateien liegen in $OUT" -ForegroundColor Green
Write-Host "1. Dateien per Windows Explorer kopieren nach: \\192.168.178.34\Container\einlass\"
Write-Host "2. Auf der NAS per SSH:"
Write-Host "   docker load -i /share/Container/einlass/einlass_backend.tar"
Write-Host "   docker load -i /share/Container/einlass/einlass_frontend.tar"
Write-Host "   cd /share/Container/einlass"
Write-Host "   docker compose -f docker-compose.qnap.yml up -d"
