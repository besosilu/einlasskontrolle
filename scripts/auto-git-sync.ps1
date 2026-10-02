<#
Beobachtet das Projektverzeichnis und committet + pusht Aenderungen gesammelt
in einem festen Intervall nach GitHub, statt bei jeder einzelnen Datei-Aenderung.
#>
param(
    [int]$IntervalSeconds = 300,
    [string]$Branch = "main"
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Output "[auto-git-sync] Starte Watcher fuer '$RepoRoot' (Intervall: ${IntervalSeconds}s, Branch: $Branch)"

while ($true) {
    try {
        $changes = git status --porcelain
        if ($changes) {
            git add -A
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Auto-Sync: $timestamp" | Out-Null
            git push origin $Branch 2>&1 | Out-Null
            Write-Output "[auto-git-sync] $timestamp - Aenderungen committet und gepusht."
        }
    } catch {
        Write-Output "[auto-git-sync] Fehler: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds $IntervalSeconds
}
