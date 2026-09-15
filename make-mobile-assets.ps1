param([string]$Root = $PSScriptRoot)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$src = [System.Drawing.Image]::FromFile("$Root\public\volna-icon.png")
$res = "$Root\android\app\src\main\res"
$bg = [System.Drawing.Color]::FromArgb(255, 10, 13, 20)

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    return @($bmp, $g)
}

# Квадратная иконка: логотип с 10% отступами
foreach ($dpi in @(@("mdpi",48), @("hdpi",72), @("xhdpi",96), @("xxhdpi",144), @("xxxhdpi",192))) {
    $name = $dpi[0]; $size = [int]$dpi[1]
    $dir = "$res\mipmap-$name"
    New-Item -ItemType Directory -Force $dir | Out-Null

    $pair = New-Canvas $size $size; $bmp = $pair[0]; $g = $pair[1]
    $pad = [int]($size * 0.06)
    $g.DrawImage($src, $pad, $pad, $size - 2 * $pad, $size - 2 * $pad)
    $g.Dispose()
    $bmp.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    # круглая версия
    $pair = New-Canvas $size $size; $bmp = $pair[0]; $g = $pair[1]
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $size, $size)
    $g.SetClip($path)
    $g.Clear($bg)
    $g.DrawImage($src, $pad, $pad, $size - 2 * $pad, $size - 2 * $pad)
    $g.Dispose(); $path.Dispose()
    $bmp.Save("$dir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Splash: тёмный фон + логотип по центру
$iconW = 0.28   # доля меньшей стороны
$port = @(@("mdpi",480,800), @("hdpi",720,1280), @("xhdpi",960,1600), @("xxhdpi",1440,2560), @("xxxhdpi",1920,3200))
$land = @(@("mdpi",800,480), @("hdpi",1280,720), @("xhdpi",1600,960), @("xxhdpi",2560,1440), @("xxxhdpi",3200,1920))

function Save-Splash([int]$w, [int]$h, [string]$path) {
    $pair = New-Canvas $w $h; $bmp = $pair[0]; $g = $pair[1]
    $g.Clear($bg)
    $iw = [int]([Math]::Min($w, $h) * $iconW)
    $g.DrawImage($src, [int](($w - $iw) / 2), [int](($h - $iw) / 2), $iw, $iw)
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

foreach ($p in $port) {
    New-Item -ItemType Directory -Force "$res\drawable-port-$($p[0])" | Out-Null
    Save-Splash ([int]$p[1]) ([int]$p[2]) "$res\drawable-port-$($p[0])\splash.png"
}
foreach ($p in $land) {
    New-Item -ItemType Directory -Force "$res\drawable-land-$($p[0])" | Out-Null
    Save-Splash ([int]$p[1]) ([int]$p[2]) "$res\drawable-land-$($p[0])\splash.png"
}
Save-Splash 480 320 "$res\drawable\splash.png"

$src.Dispose()
Write-Output "OK: icons and splash generated"
