$docxFile = Get-ChildItem -Path "docs" -Filter "*.docx" | Select-Object -First 1
if (-not $docxFile) {
    Write-Error "DOCX file not found in docs folder"
    exit 1
}

$docxPath = $docxFile.FullName
$pdfPath = [System.IO.Path]::ChangeExtension($docxPath, ".pdf")
$rootDocx = Join-Path (Get-Location) $docxFile.Name
$rootPdf = [System.IO.Path]::ChangeExtension($rootDocx, ".pdf")

Write-Host "Exporting DOCX to PDF using Word COM..."
Write-Host "Source: $docxPath"
Write-Host "Target: $pdfPath"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($docxPath, $false, $true)
    # wdExportFormatPDF = 17
    $doc.ExportAsFixedFormat($pdfPath, 17)
    $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSaveChanges)
    Write-Host "[OK] Successfully exported to $pdfPath"
    
    # Sync to root
    Copy-Item -Path $docxPath -Destination $rootDocx -Force
    Copy-Item -Path $pdfPath -Destination $rootPdf -Force
    Write-Host "[OK] Synchronized docx and pdf to root directory"
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
