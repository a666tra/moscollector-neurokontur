$pptxFile = Get-ChildItem -Path "presentation" -Filter "*.pptx" | Select-Object -First 1
if (-not $pptxFile) {
    Write-Error "PPTX file not found in presentation folder"
    exit 1
}

$resolvedPptx = $pptxFile.FullName
$resolvedPdf = [System.IO.Path]::ChangeExtension($resolvedPptx, ".pdf")

Write-Host "Exporting PPTX to PDF..."
Write-Host "Input:  $resolvedPptx"
Write-Host "Output: $resolvedPdf"

$ppApp = New-Object -ComObject PowerPoint.Application
try {
    # Open(FileName, ReadOnly, Untitled, WithWindow)
    $presentation = $ppApp.Presentations.Open($resolvedPptx, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    # ppSaveAsPDF = 32
    $presentation.SaveAs($resolvedPdf, 32)
    $presentation.Close()
    Write-Host "Successfully exported PPTX to PDF: $resolvedPdf"
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    $ppApp.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppApp) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
