Add-Type -AssemblyName System.Drawing

$inputPath = Join-Path $PSScriptRoot "..\assets\icon.png"
$outputPath = Join-Path $PSScriptRoot "..\assets\icon.ico"

$img = [System.Drawing.Bitmap]::FromFile($inputPath)
$thumb = New-Object System.Drawing.Bitmap($img, 256, 256)
$hIcon = $thumb.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fileStream = New-Object System.IO.FileStream($outputPath, [System.IO.FileMode]::Create)
$icon.Save($fileStream)
$fileStream.Close()

$icon.Dispose()
$thumb.Dispose()
$img.Dispose()

Write-Host "assets/icon.ico generated successfully!"
