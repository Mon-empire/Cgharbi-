# Extrait le logo réel (avec la toque) de l'image de la brochure, fond blanc rendu transparent.
param([string]$Src, [string]$Out)
Add-Type -AssemblyName System.Drawing
$img = [Drawing.Image]::FromFile($Src)
$rect = New-Object Drawing.Rectangle 55, 90, 300, 325
$bmp = New-Object Drawing.Bitmap 600, 650
$g = [Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($img, (New-Object Drawing.Rectangle 0, 0, 600, 650), $rect, [Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
for ($y = 0; $y -lt $bmp.Height; $y++) {
  for ($x = 0; $x -lt $bmp.Width; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $m = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
    if ($m -gt 235) { $bmp.SetPixel($x, $y, [Drawing.Color]::FromArgb(0, 255, 255, 255)) }
    elseif ($m -gt 200) { $a = [int](255 * (235 - $m) / 35); $bmp.SetPixel($x, $y, [Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B)) }
  }
}
$bmp.Save($Out, [Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $img.Dispose()
Write-Output ("logo: {0} Ko" -f [int]((Get-Item $Out).Length / 1KB))
