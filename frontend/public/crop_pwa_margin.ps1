Add-Type -AssemblyName System.Drawing

$iconsDir = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\icons"
$publicDir = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public"
$sourcePath = "$iconsDir\icon-512-v2.png"

$bytes = [System.IO.File]::ReadAllBytes($sourcePath)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)

# We leave a small margin this time so it doesn't touch the edges
$cropX = 50
$cropY = 50
$cropSize = 412

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

function Save-CroppedIcon {
    param(
        [int]$size,
        [string]$destPath
    )
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    
    $graph.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graph.Dispose()
    $bmp.Dispose()
}

Save-CroppedIcon -size 512 -destPath "$iconsDir\icon-512-v2.png"
Save-CroppedIcon -size 512 -destPath "$iconsDir\icon-512-maskable-v2.png"
Save-CroppedIcon -size 192 -destPath "$iconsDir\icon-192-v2.png"
Save-CroppedIcon -size 192 -destPath "$iconsDir\icon-192-maskable-v2.png"
Save-CroppedIcon -size 180 -destPath "$iconsDir\apple-touch-icon-v2.png"

# And the favicons
Save-CroppedIcon -size 32 -destPath "$publicDir\favicon-32x32.png"
Save-CroppedIcon -size 16 -destPath "$publicDir\favicon-16x16.png"

$img.Dispose()
$ms.Dispose()

Write-Host "New cropping complete!"
