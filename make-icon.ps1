Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# --- фон: скруглённый квадрат с лёгким вертикальным градиентом ---
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 240
$bgPath.AddArc(0, 0, $r, $r, 180, 90)
$bgPath.AddArc($size - $r, 0, $r, $r, 270, 90)
$bgPath.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
$bgPath.AddArc(0, $size - $r, $r, $r, 90, 90)
$bgPath.CloseFigure()

$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, `
    [System.Drawing.Color]::FromArgb(255, 13, 18, 28), `
    [System.Drawing.Color]::FromArgb(255, 7, 10, 16), 90)
$g.FillPath($bgBrush, $bgPath)

# --- волна: неоновая линия с ореолом ---
function Add-Wave([System.Drawing.Drawing2D.GraphicsPath]$path, [double]$x, [double]$y) {
    $path.AddPoint([System.Drawing.PointF]::new($x, $y))
}

$pts = New-Object System.Drawing.PointF[] (129)
for ($i = 0; $i -lt 129; $i++) {
    $t = $i / 128.0
    $x = 130 + $t * 764
    # огибающая: спокойнее по краям, "гребень" чуть левее центра
    $env = 150 * [Math]::Exp(-[Math]::Pow(($t - 0.42) / 0.30, 2)) + 26 + 18 * [Math]::Sin($t * 3.1)
    $y = 512 + $env * [Math]::Sin($t * 9.4 - 0.6)
    $pts[$i] = [System.Drawing.PointF]::new([single]$x, [single]$y)
}
$wave = New-Object System.Drawing.Drawing2D.GraphicsPath
$wave.AddLines($pts)

$gradRect = New-Object System.Drawing.Rectangle(130, 300, 764, 424)
$penBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($gradRect, `
    [System.Drawing.Color]::FromArgb(255, 45, 212, 191), `
    [System.Drawing.Color]::FromArgb(255, 52, 211, 153), 0)

# ореол: несколько проходов широкой полупрозрачной линией
$glowLevels = @(@(46, 22), @(28, 45), @(16, 80))
foreach ($gl in $glowLevels) {
    $gp = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($gl[1], 45, 212, 191), $gl[0])
    $gp.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $gp.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $gp.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($gp, $wave)
    $gp.Dispose()
}

# основная линия
$pen = New-Object System.Drawing.Pen($penBrush, 13)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPath($pen, $wave)
$pen.Dispose()

# блик: тонкая белая линия поверх половины волны
$shineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(110, 255, 255, 255))
# (мягкий блик делает второй путь поверх, тоньше)
$shine = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 210, 255, 240), 4)
$shine.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$shine.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$shinePts = New-Object System.Drawing.PointF[] (40)
for ($i = 0; $i -lt 40; $i++) {
    $t = 0.18 + ($i / 39.0) * 0.42
    $x = 130 + $t * 764
    $env = 150 * [Math]::Exp(-[Math]::Pow(($t - 0.42) / 0.30, 2)) + 26 + 18 * [Math]::Sin($t * 3.1)
    $y = 512 + $env * [Math]::Sin($t * 9.4 - 0.6) - 3
    $shinePts[$i] = [System.Drawing.PointF]::new([single]$x, [single]$y)
}
$shinePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$shinePath.AddLines($shinePts)
$g.DrawPath($shine, $shinePath)
$shine.Dispose()
$shineBrush.Dispose()

$g.Dispose()

# сохранить: публичная иконка + источник для мобильных ассетов
$out1 = Join-Path $root "public\volna-icon.png"
$bmp.Save($out1, [System.Drawing.Imaging.ImageFormat]::Png)
$out2 = Join-Path $root "assets\icon.png"
(New-Object System.Drawing.Bitmap($bmp)).Save($out2, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "OK: icon saved -> $out1"
