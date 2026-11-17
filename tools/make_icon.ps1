Add-Type -AssemblyName System.Drawing
$sprites = Get-Content "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\dino-nest\data\sprites.json" -Raw | ConvertFrom-Json
$head = $sprites.parts.papa_head
$jaw  = $sprites.parts.papa_jaw

$base = New-Object System.Drawing.Bitmap(24, 24)
$g0 = [System.Drawing.Graphics]::FromImage($base)
$g0.Clear([System.Drawing.Color]::FromArgb(255, 22, 32, 48))
$glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 59, 110, 165))
$g0.FillEllipse($glowBrush, 2, 2, 20, 20)
$g0.Dispose()

function Draw-Part($bmp, $part, $ox, $oy) {
  for ($y = 0; $y -lt $part.rows.Count; $y++) {
    $row = $part.rows[$y]
    for ($x = 0; $x -lt $row.Length; $x++) {
      $ch = [string]$row[$x]
      if ($ch -ne '.' -and $part.palette.$ch) {
        $col = [System.Drawing.ColorTranslator]::FromHtml($part.palette.$ch)
        $px = $ox + $x; $py = $oy + $y
        if ($px -ge 0 -and $px -lt 24 -and $py -ge 0 -and $py -lt 24) {
          $bmp.SetPixel($px, $py, $col)
        }
      }
    }
  }
}
Draw-Part $base $jaw 5 13
Draw-Part $base $head 3 5

$png256 = New-Object System.Drawing.Bitmap(256, 256)
$g256 = [System.Drawing.Graphics]::FromImage($png256)
$g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g256.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g256.DrawImage($base, 0, 0, 256, 256)
$g256.Dispose()
$pngPath = "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\dino-nest\processing\DinoNest\data\icon.png"
$png256.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @(16, 32, 48, 256)
$blobs = @()
foreach ($sz in $sizes) {
  $b = New-Object System.Drawing.Bitmap($sz, $sz)
  $gg = [System.Drawing.Graphics]::FromImage($b)
  $gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $gg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $gg.DrawImage($base, 0, 0, $sz, $sz)
  $gg.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $blobs += ,($ms.ToArray())
  $ms.Dispose()
  $b.Dispose()
}
$base.Dispose()
$png256.Dispose()

foreach ($icoPath in @(
  "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\dino-nest\installer\icon.ico",
  "C:\Users\Aik Kuypers\.gemini\antigravity\scratch\dino-nest\processing\DinoNest\icon.ico"
)) {
  $fs = [System.IO.File]::Create($icoPath)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]; $wb = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $len = $blobs[$i].Length
    $bw.Write([byte]$wb); $bw.Write([byte]$wb); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]$len); $bw.Write([uint32]$offset)
    $offset += $len
  }
  for ($i = 0; $i -lt $sizes.Count; $i++) { $bw.Write($blobs[$i]) }
  $bw.Close(); $fs.Close()
}
Write-Output "Created icon.png and multi-size icon.ico"
