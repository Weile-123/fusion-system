param([string]$OutputPath = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$distRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'dist')).Path
if (!(Test-Path -LiteralPath (Join-Path $distRoot 'index.html'))) { throw 'Build dist/index.html before packaging.' }
if (!$OutputPath) {
    $OutputPath = Join-Path $projectRoot ('artifacts/frontend-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath)) | Out-Null
if (Test-Path -LiteralPath $OutputPath) { throw 'Output archive already exists; choose a new path.' }
$archive = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $distRoot -File -Recurse) {
        $entryName = $file.FullName.Substring($distRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$archive = [System.IO.Compression.ZipFile]::OpenRead($OutputPath)
try {
    $names = @($archive.Entries | ForEach-Object { $_.FullName })
    if ($names -notcontains 'index.html') { throw 'index.html must be at archive root.' }
    if (@($names | Where-Object { $_.Contains('\') }).Count) { throw 'Archive paths must use forward slashes.' }
    $builtFiles = @(Get-ChildItem -LiteralPath $distRoot -File -Recurse)
    if ($names.Count -ne $builtFiles.Count) { throw 'Archive file count differs from dist.' }
    foreach ($file in $builtFiles) {
        $entryName = $file.FullName.Substring($distRoot.Length + 1).Replace('\', '/')
        $entry = $archive.GetEntry($entryName)
        if (!$entry) { throw "Missing packaged file: $entryName" }
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($file.FullName)
        $hash = [System.Security.Cryptography.SHA256]::Create()
        try {
            $packagedHash = [System.BitConverter]::ToString($hash.ComputeHash($entryStream))
            $sourceHash = [System.BitConverter]::ToString($hash.ComputeHash($fileStream))
            if ($packagedHash -ne $sourceHash) { throw "Packaged content differs: $entryName" }
        } finally { $entryStream.Dispose(); $fileStream.Dispose(); $hash.Dispose() }
    }
    [pscustomobject]@{ Zip = $OutputPath; Files = $names.Count; ForwardSlashPaths = $true; ContentsVerified = $true }
} finally { $archive.Dispose() }
