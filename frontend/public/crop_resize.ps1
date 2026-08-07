Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\icons\icon-192-v2.png"
$dest32 = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\favicon-32x32.png"
$dest16 = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\favicon-16x16.png"

$img = [System.Drawing.Image]::FromFile($sourcePath)

# Source area to crop (zooming in to remove transparent padding)
$cropX = 35
$cropY = 35
$cropWidth = 122
$cropHeight = 122

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropWidth, $cropHeight)

# Create 32x32
$bmp32 = New-Object System.Drawing.Bitmap(32, 32)
$graph32 = [System.Drawing.Graphics]::FromImage($bmp32)
$graph32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$destRect32 = New-Object System.Drawing.Rectangle(0, 0, 32, 32)
$graph32.DrawImage($img, $destRect32, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp32.Save($dest32, [System.Drawing.Imaging.ImageFormat]::Png)
$graph32.Dispose()
$bmp32.Dispose()

# Create 16x16
$bmp16 = New-Object System.Drawing.Bitmap(16, 16)
$graph16 = [System.Drawing.Graphics]::FromImage($bmp16)
$graph16.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$destRect16 = New-Object System.Drawing.Rectangle(0, 0, 16, 16)
$graph16.DrawImage($img, $destRect16, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp16.Save($dest16, [System.Drawing.Imaging.ImageFormat]::Png)
$graph16.Dispose()
$bmp16.Dispose()

$img.Dispose()
Write-Host "Cropping and Resizing complete!"
