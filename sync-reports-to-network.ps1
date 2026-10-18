# Kopiert die monatlichen Finanzamt-Berichte aus dem lokalen reports/-Ordner
# (von der App im Container erzeugt) auf ein Netzlaufwerk (UNC-Pfad).
# Als Windows-Aufgabenplanung taeglich einplanen, z.B.:
#   schtasks /create /tn "EinlassBerichteSync" /tr "powershell -ExecutionPolicy Bypass -File C:\...\sync-reports-to-network.ps1" /sc daily /st 03:00
# In der Aufgabenplanung zusaetzlich "Computer zum Ausfuehren dieser Aufgabe aufwecken" aktivieren,
# falls der PC zeitweise im Standby ist.
param(
    [string]$NetworkPath = "\\server\freigabe\EinlassBerichte",
    [string]$SourcePath = "$PSScriptRoot\reports",
    [string]$LogPath = "$PSScriptRoot\sync-reports-to-network.log"
)

function Write-Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -Path $LogPath -Value $line
    Write-Output $line
}

if (-not (Test-Path -Path $NetworkPath)) {
    Write-Log "[FEHLER] Netzlaufwerk nicht erreichbar: $NetworkPath"
    exit 1
}

if (-not (Test-Path -Path $SourcePath)) {
    Write-Log "[FEHLER] Quellordner nicht gefunden: $SourcePath"
    exit 1
}

robocopy $SourcePath $NetworkPath /E /R:3 /W:10 "/LOG+:$LogPath"
$exitCode = $LASTEXITCODE

# Robocopy-Exitcodes 0-7 sind Erfolg (mit Details), erst 8+ ist ein echter Fehler.
if ($exitCode -ge 8) {
    Write-Log "[FEHLER] robocopy fehlgeschlagen, Exitcode $exitCode"
    exit 1
}

Write-Log "[OK] Sync abgeschlossen, robocopy-Exitcode $exitCode"
exit 0
