<#
  Auto-hébergement des bibliothèques (à lancer une fois par la DSI, avec accès Internet).
  Copie dans wordpress\digitale-academie-experience\assets\vendor\ les fichiers ESM utilisés :
    GSAP 3.12.5 (licence GreenSock « Standard No Charge »), Three.js r160 (licence MIT), Lenis 1.1 (licence MIT).
#>
$dest = Join-Path (Split-Path $PSScriptRoot -Parent) 'wordpress\digitale-academie-experience\assets\vendor'
$files = @(
  'gsap@3.12.5/index.js', 'gsap@3.12.5/gsap-core.js', 'gsap@3.12.5/CSSPlugin.js',
  'gsap@3.12.5/ScrollTrigger.js', 'gsap@3.12.5/Observer.js',
  'three@0.160.0/build/three.module.min.js',
  'lenis@1.1.13/dist/lenis.mjs'
)
foreach ($f in $files) {
  $out = Join-Path $dest ($f -replace '/', '\')
  New-Item -ItemType Directory -Force (Split-Path $out -Parent) | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri ('https://cdn.jsdelivr.net/npm/' + $f) -OutFile $out
  Write-Output "OK $f"
}
