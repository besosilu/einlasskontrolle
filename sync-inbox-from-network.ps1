# Kopiert "dd-mm-yyyy.txt"-Einlass-Dateien von einem Netzlaufwerk (UNC-Pfad) in den lokalen
# inbox/-Ordner, von dem aus die App sie automatisch im Hintergrund verarbeitet.
# Als Windows-Aufgabenplanung alle 5-15 Minuten einplanen, z.B.:
#   schtasks /create /tn "EinlassInboxSync" /tr "powershell -ExecutionPolicy Bypass -File C:\...\sync-inbox-from-network.ps1" /sc minute /mo 10
# In der Aufgabenplanung zusaetzlich "Computer zum Ausfuehren dieser Aufgabe aufwecken" aktivieren,
# falls der PC zeitweise im Standby ist.
#
# Netzlaufwerk-Pfad: wird per -NetworkPath explizit uebergeben, sonst aus der von der Web-UI
# (Einstellungen -> Automatischer Einlass-Import) gespeicherten .sync-config.json im inbox/-Ordner
# gelesen, sonst faellt das Skript auf einen Beispiel-Pfad zurueck (fuer Erstinstallationen).
param(
    [string]$NetworkPath,
    [string]$TargetPath = "$PSScriptRoot\inbox",
    [string]$LogPath = "$PSScriptRoot\sync-inbox-from-network.log"
)

function Write-Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -Path $LogPath -Value $line
    Write-Output $line
}

if ($NetworkPath) {
    Write-Log "[INFO] Netzlaufwerk-Pfad aus -NetworkPath-Parameter: $NetworkPath"
} else {
    $configFile = Join-Path $TargetPath ".sync-config.json"
    if (Test-Path -Path $configFile) {
        try {
            $config = Get-Content -Path $configFile -Raw | ConvertFrom-Json
            if ($config.networkPath) {
                $NetworkPath = $config.networkPath
                Write-Log "[INFO] Netzlaufwerk-Pfad aus Konfigurationsdatei (Einstellungen in der UI): $NetworkPath"
            }
        } catch {
            Write-Log "[WARNUNG] Konfigurationsdatei $configFile konnte nicht gelesen werden: $_"
        }
    }
}

if (-not $NetworkPath) {
    $NetworkPath = "\\server\freigabe\EinlassDateien"
    Write-Log "[INFO] Kein Pfad per Parameter/Konfigurationsdatei gesetzt, nutze Beispiel-Default: $NetworkPath"
}

if (-not (Test-Path -Path $NetworkPath)) {
    Write-Log "[FEHLER] Netzlaufwerk nicht erreichbar: $NetworkPath"
    exit 1
}

if (-not (Test-Path -Path $TargetPath)) {
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
}

# Kein /MOV (Original bleibt auf dem Netzlaufwerk, falls die Verarbeitung im Container fehlschlaegt).
# Kein /E, /S oder /MIR - nur flacher Copy ins Inbox-Root, damit die vom Backend verwalteten
# Unterordner verarbeitet/ und fehler/ von diesem Skript nie angefasst werden.
robocopy $NetworkPath $TargetPath *.txt /R:3 /W:10 "/LOG+:$LogPath"
$exitCode = $LASTEXITCODE

# Robocopy-Exitcodes 0-7 sind Erfolg (mit Details), erst 8+ ist ein echter Fehler.
if ($exitCode -ge 8) {
    Write-Log "[FEHLER] robocopy fehlgeschlagen, Exitcode $exitCode"
    exit 1
}

Write-Log "[OK] Sync abgeschlossen, robocopy-Exitcode $exitCode"
exit 0
