Add-Type -AssemblyName System.Drawing

function Save-Icon {
  param([int]$Size, [string]$Path)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 26, 61, 43))
  $gold = [System.Drawing.Color]::FromArgb(255, 201, 162, 39)
  $font = New-Object System.Drawing.Font('Georgia', [int]($Size * 0.22), [System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush($gold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'
  $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
  $g.DrawString('MIRA', $font, $brush, $rect, $sf)
  $g.Dispose()
  $dir = Split-Path $Path -Parent
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$root = Split-Path $PSScriptRoot -Parent
Save-Icon -Size 192 -Path (Join-Path $root 'public/icons/pwa-192x192.png')
Save-Icon -Size 512 -Path (Join-Path $root 'public/icons/pwa-512x512.png')
Save-Icon -Size 180 -Path (Join-Path $root 'public/icons/apple-touch-icon.png')
Write-Host 'PWA icons generated'
