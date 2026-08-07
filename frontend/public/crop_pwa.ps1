Add-Type -AssemblyName System.Drawing

$iconsDir = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\icons"
$sourcePath = "$iconsDir\icon-512-v2.png"

# Read into memory so we don't lock the file, allowing us to overwrite it
$bytes = [System.IO.File]::ReadAllBytes($sourcePath)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)

$cropX = 93
$cropY = 93
$cropSize = 326

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

function Save-CroppedIcon {
    param(
        [int]$size,
        [string]$destFile
    )
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    
    $graph.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save("$iconsDir\$destFile", [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graph.Dispose()
    $bmp.Dispose()
}

Save-CroppedIcon -size 512 -destFile "icon-512-v2.png"
Save-CroppedIcon -size 512 -destFile "icon-512-maskable-v2.png"
Save-CroppedIcon -size 192 -destFile "icon-192-v2.png"
Save-CroppedIcon -size 192 -destFile "icon-192-maskable-v2.png"
Save-CroppedIcon -size 180 -destFile "apple-touch-icon-v2.png"

$img.Dispose()
$ms.Dispose()

Write-Host "PWA icons cropped and updated successfully!"
