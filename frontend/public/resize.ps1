Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\icons\icon-192-v2.png"
$dest32 = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\favicon-32x32.png"
$dest16 = "c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\public\favicon-16x16.png"

$img = [System.Drawing.Image]::FromFile($sourcePath)

$bmp32 = New-Object System.Drawing.Bitmap(32, 32)
$graph32 = [System.Drawing.Graphics]::FromImage($bmp32)
$graph32.DrawImage($img, 0, 0, 32, 32)
$bmp32.Save($dest32, [System.Drawing.Imaging.ImageFormat]::Png)
$graph32.Dispose()
$bmp32.Dispose()

$bmp16 = New-Object System.Drawing.Bitmap(16, 16)
$graph16 = [System.Drawing.Graphics]::FromImage($bmp16)
$graph16.DrawImage($img, 0, 0, 16, 16)
$bmp16.Save($dest16, [System.Drawing.Imaging.ImageFormat]::Png)
$graph16.Dispose()
$bmp16.Dispose()

$img.Dispose()
Write-Host "Resizing complete!"
