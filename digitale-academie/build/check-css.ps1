<#
  Vérifie que toutes les règles de src\css\da.css sont confinées à #da-experience.
  Usage : powershell -ExecutionPolicy Bypass -File build\check-css.ps1
#>
$css = Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path $PSScriptRoot -Parent) 'src\css\da.css')
$css = [regex]::Replace($css, '/\*[\s\S]*?\*/', '')
# Retire le contenu des @keyframes (sélecteurs from/to/% légitimes)
$css = [regex]::Replace($css, '@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '')
$bad = @()
foreach ($m in [regex]::Matches($css, '([^{}]+)\{')) {
  $sel = $m.Groups[1].Value.Trim()
  if ($sel -eq '' -or $sel.StartsWith('@')) { continue }
  foreach ($part in $sel.Split(',')) {
    $p = $part.Trim()
    if (-not $p.StartsWith('#da-experience')) { $bad += $p }
  }
}
if ($bad.Count) { Write-Output "ECHEC : $($bad.Count) sélecteur(s) hors de #da-experience :"; $bad | Select-Object -Unique | ForEach-Object { Write-Output "  $_" }; exit 1 }
Write-Output 'OK : tous les sélecteurs sont confinés à #da-experience'
