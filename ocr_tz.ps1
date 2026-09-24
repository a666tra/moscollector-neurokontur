Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null

$lang = New-Object Windows.Globalization.Language('ru')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)

function AwaitTask($task) {
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | 
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' } | 
        Select-Object -First 1
    $netTask = $asTaskGeneric.Invoke($null, @($task))
    $netTask.Wait()
    return $netTask.Result
}

$sb = New-Object System.Text.StringBuilder

for ($i = 1; $i -le 16; $i++) {
    $num = $i.ToString('00')
    $pngPath = (Resolve-Path "tz_pages/page_$num.png").Path
    $file = AwaitTask ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pngPath))
    $stream = AwaitTask ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read))
    $decoder = AwaitTask ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
    $bitmap = AwaitTask ($decoder.GetSoftwareBitmapAsync())
    $result = AwaitTask ($engine.RecognizeAsync($bitmap))
    
    $sb.AppendLine("=== PAGE $i ===") | Out-Null
    $sb.AppendLine($result.Text) | Out-Null
    $sb.AppendLine("") | Out-Null
    Write-Host "Processed page $i"
}

[System.IO.File]::WriteAllText("tz_ocr_text.txt", $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "OCR complete! Output saved to tz_ocr_text.txt"
