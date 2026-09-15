# Foreground адаптивной иконки: только волна, прозрачный фон,
# волна вписана в safe-zone (66/108 = ~61% ширины холста)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$res = Join-Path $PSScriptRoot "android\app\src\main\res"

# плотность -> размер холста (108dp)
$densities = @(
    @("mdpi", 108),
    @("hdpi", 162),
    @("xhdpi", 216),
    @("xxhdpi", 324),
    @("xxxhdpi", 432)
)

function New-WavePath([double]$size) {
    # масштаб: ширина волны = 60% холста (исходник: 764px @ 1024)
    $k = ($size * 0.60) / 764.0
    $pts = New-Object System.Drawing.PointF[] (129)
    for ($i = 0; $i -lt 129; $i++) {
        $t = $i / 128.0
        $env = 150 * [Math]::Exp(-[Math]::Pow(($t - 0.42) / 0.30, 2)) + 26 + 18 * [Math]::Sin($t * 3.1)
        $x = $size / 2 + ((130 + $t * 764) - 512) * $k
        $y = $size / 2 + ($env * [Math]::Sin($t * 9.4 - 0.6)) * $k
        $pts[$i] = [System.Drawing.PointF]::new([single]$x, [single]$y)
    }
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddLines($pts)
    return $path
}

foreach ($d in $densities) {
    $name = $d[0]; $size = [int]$d[1]
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $wave = New-WavePath $size
    $k = ($size * 0.60) / 764.0

    foreach ($gl in @(@(46, 22), @(28, 45), @(16, 80))) {
        $gp = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($gl[1], 45, 212, 191), [single]($gl[0] * $k))
        $gp.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $gp.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $gp.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($gp, $wave)
        $gp.Dispose()
    }
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 66, 224, 189), [single](13 * $k))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($pen, $wave)
    $pen.Dispose()

    $g.Dispose()
    $dir = Join-Path $res "mipmap-$name"
    New-Item -ItemType Directory -Force $dir | Out-Null
    $bmp.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "foreground $name -> $size px"
}
Write-Output "OK"
