# Photo -> ASCII portrait (assets/portrait.txt). No installs, uses .NET System.Drawing.
# Usage: powershell -File tools\ascii.ps1 -Photo "C:\path\to\photo.jpg" [-Cols 64] [-Invert] [-Gamma 1.0]
param(
  [Parameter(Mandatory = $true)][string]$Photo,
  [int]$Cols = 64,
  [double]$CharAspect = 0.525,   # char width / line height in the SVG (4.2px / 8px)
  [double]$Gamma = 1.0,
  [switch]$Invert,
  [switch]$Equalize,
  [switch]$Edges,
  [switch]$FullShade,             # with -Edges: shade non-edge cells with the full ramp instead of 8 levels
  [double]$EdgeThreshold = 0.3,  # fraction of the strongest cell edge that counts as a line
  [double]$CropTop = 0.0,        # fraction of height to trim from the top before the square crop
  [double]$BgCutoff = 0.0,       # raw luminance at or above this becomes blank (white backgrounds), 0 = off
  [string]$Out = "$PSScriptRoot\..\assets\portrait.txt"
)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Photo))

# centre square crop (shifted down by CropTop)
$side = [Math]::Min($src.Width, $src.Height)
$x0 = [int](($src.Width - $side) / 2)
$y0 = [int]([Math]::Min($src.Height - $side, $src.Height * $CropTop))
$rows = [int][Math]::Round($Cols * $CharAspect)

$small = New-Object System.Drawing.Bitmap $Cols, $rows
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $Cols, $rows), (New-Object System.Drawing.Rectangle $x0, $y0, $side, $side), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $src.Dispose()

# luminance grid + contrast stretch
$lum = New-Object 'double[,]' $rows, $Cols
$min = 1.0; $max = 0.0
for ($y = 0; $y -lt $rows; $y++) { for ($x = 0; $x -lt $Cols; $x++) {
  $p = $small.GetPixel($x, $y)
  $v = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B) / 255.0
  $lum[$y, $x] = $v
  if ($v -lt $min) { $min = $v }; if ($v -gt $max) { $max = $v }
} }
$small.Dispose()

# dark terminal background: bright pixel = dense glyph
$ramp = " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
$range = [Math]::Max($max - $min, 0.001)

# -Equalize: rank-based histogram equalization over subject pixels only, so a narrow tonal
# range (dark skin and hair against white) still uses the whole glyph ramp
$rank = $null
if ($Equalize) {
  $fg = New-Object System.Collections.Generic.List[double]
  foreach ($v in $lum) { if (-not ($BgCutoff -gt 0 -and $v -ge $BgCutoff)) { $fg.Add($v) } }
  $fg.Sort(); $rank = $fg.ToArray()
}
function Norm([double]$v) {
  if ($rank) {
    $i = [Array]::BinarySearch($rank, $v); if ($i -lt 0) { $i = -bnot $i }
    return [Math]::Min(1.0, $i / [Math]::Max(1, $rank.Length - 1))
  }
  return ($v - $min) / $range
}
$lines = for ($y = 0; $y -lt $rows; $y++) {
  $sb = New-Object System.Text.StringBuilder
  for ($x = 0; $x -lt $Cols; $x++) {
    if ($BgCutoff -gt 0 -and $lum[$y, $x] -ge $BgCutoff) { [void]$sb.Append(" "); continue }
    $l = $lum[$y, $x]; $v = [Math]::Pow((Norm $l), $Gamma)
    if ($Invert) { $v = 1 - $v }
    [void]$sb.Append($ramp[[int][Math]::Round($v * ($ramp.Length - 1))])
  }
  $sb.ToString().TrimEnd()
}
# -Edges: sketch look. Sobel edges at 4x supersampling drawn as | / - \ by orientation,
# everything else shaded with a light ramp. Overrides the tonal $lines above.
if ($Edges) {
  $SS = 4; $bw = $Cols * $SS; $bh = $rows * $SS
  $src2 = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Photo))
  $big = New-Object System.Drawing.Bitmap $bw, $bh
  $g2 = [System.Drawing.Graphics]::FromImage($big)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($src2, (New-Object System.Drawing.Rectangle 0, 0, $bw, $bh), (New-Object System.Drawing.Rectangle $x0, $y0, $side, $side), [System.Drawing.GraphicsUnit]::Pixel)
  $g2.Dispose(); $src2.Dispose()
  # fast pixel read
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bw, $bh
  $data = $big.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $bytes = New-Object byte[] ($data.Stride * $bh)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $stride = $data.Stride; $big.UnlockBits($data); $big.Dispose()
  $G = New-Object 'double[]' ($bw * $bh)
  for ($y = 0; $y -lt $bh; $y++) { for ($x = 0; $x -lt $bw; $x++) {
    $o = $y * $stride + $x * 3
    $G[$y * $bw + $x] = (0.114 * $bytes[$o] + 0.587 * $bytes[$o + 1] + 0.299 * $bytes[$o + 2]) / 255.0
  } }
  $Jxx = New-Object 'double[,]' $rows, $Cols; $Jyy = New-Object 'double[,]' $rows, $Cols; $Jxy = New-Object 'double[,]' $rows, $Cols
  $mag = New-Object 'double[,]' $rows, $Cols; $maxMag = 0.0
  for ($y = 1; $y -lt $bh - 1; $y++) { for ($x = 1; $x -lt $bw - 1; $x++) {
    $i = $y * $bw + $x
    $gx = ($G[$i - $bw + 1] + 2 * $G[$i + 1] + $G[$i + $bw + 1]) - ($G[$i - $bw - 1] + 2 * $G[$i - 1] + $G[$i + $bw - 1])
    $gy = ($G[$i + $bw - 1] + 2 * $G[$i + $bw] + $G[$i + $bw + 1]) - ($G[$i - $bw - 1] + 2 * $G[$i - $bw] + $G[$i - $bw + 1])
    $cy = [int][Math]::Floor($y / $SS); $cx = [int][Math]::Floor($x / $SS)
    $Jxx[$cy, $cx] += $gx * $gx; $Jyy[$cy, $cx] += $gy * $gy; $Jxy[$cy, $cx] += $gx * $gy
  } }
  for ($y = 0; $y -lt $rows; $y++) { for ($x = 0; $x -lt $Cols; $x++) {
    $a = $Jxx[$y, $x]; $b = $Jyy[$y, $x]
    $m = [Math]::Sqrt($a + $b); $mag[$y, $x] = $m; if ($m -gt $maxMag) { $maxMag = $m }
  } }
  $shade = if ($FullShade) { $ramp } else { " .:-=+*#" }
  $lines = for ($y = 0; $y -lt $rows; $y++) {
    $sb = New-Object System.Text.StringBuilder
    for ($x = 0; $x -lt $Cols; $x++) {
      $isBg = $BgCutoff -gt 0 -and $lum[$y, $x] -ge $BgCutoff
      $e = $mag[$y, $x] / $maxMag
      if ($e -ge $EdgeThreshold) {
        # gradient orientation (structure tensor), edge runs perpendicular to it
        $tXY = $Jxy[$y, $x]; $tD = $Jxx[$y, $x] - $Jyy[$y, $x]   # PS names are case-insensitive, keep these distinct
        $ang = 0.5 * [Math]::Atan2(2 * $tXY, $tD) * 180 / [Math]::PI
        if ($ang -lt 0) { $ang += 180 }
        $ch = if ($ang -lt 22.5 -or $ang -ge 157.5) { '|' } elseif ($ang -lt 67.5) { '/' } elseif ($ang -lt 112.5) { '-' } else { '\' }
        [void]$sb.Append($ch)
      } elseif ($isBg) { [void]$sb.Append(' ') }
      else {
        $l = $lum[$y, $x]; $v = [Math]::Pow((Norm $l), $Gamma); if ($Invert) { $v = 1 - $v }
        [void]$sb.Append($shade[[int][Math]::Round($v * ($shade.Length - 1))])
      }
    }
    $sb.ToString().TrimEnd()
  }
}

$dir = Split-Path $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
[System.IO.File]::WriteAllLines((Join-Path (Resolve-Path $dir) (Split-Path $Out -Leaf)), $lines)
"wrote $rows rows x $Cols cols -> $Out"
