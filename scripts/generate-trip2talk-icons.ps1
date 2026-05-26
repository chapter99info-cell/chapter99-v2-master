# Generate PWA icons from public/trip2talk-logo.png
# Usage: powershell -File scripts/generate-trip2talk-icons.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root 'public/trip2talk-logo.png'

if (!(Test-Path $srcPath)) {
  Write-Error "Missing $srcPath - add Trip2Talk logo first."
  exit 1
}

function Save-SquareIcon {
  param([int]$Size, [string]$Path, [System.Drawing.Color]$Bg)

  $src = [System.Drawing.Image]::FromFile($srcPath)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($Bg)

  $pad = [int]($Size * 0.08)
  $inner = $Size - (2 * $pad)
  $scale = [Math]::Min($inner / $src.Width, $inner / $src.Height)
  $w = [int]($src.Width * $scale)
  $h = [int]($src.Height * $scale)
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)
  $g.DrawImage($src, $x, $y, $w, $h)
  $g.Dispose()
  $src.Dispose()

  $dir = Split-Path $Path -Parent
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ('wrote ' + $Path)
}

$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$iconsDir = Join-Path $root 'public/icons'

Save-SquareIcon -Size 192 -Path (Join-Path $iconsDir 'icon-192.png') -Bg $white
Save-SquareIcon -Size 512 -Path (Join-Path $iconsDir 'icon-512.png') -Bg $white
Save-SquareIcon -Size 180 -Path (Join-Path $iconsDir 'apple-touch-icon.png') -Bg $white
Save-SquareIcon -Size 32 -Path (Join-Path $root 'public/favicon-32.png') -Bg $white

Write-Host 'Trip2Talk PWA icons generated from trip2talk-logo.png'
