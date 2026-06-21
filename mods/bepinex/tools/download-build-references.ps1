#requires -Version 7.0

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/\s]+/[^/\s]+$')]
    [string]$Repository,
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Tag,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$ExpectedSha256,
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DestinationDir,
    [ValidatePattern('^[^\\/:*?"<>|]+\.zip$')]
    [string]$AssetName = "mystia-build-references.zip"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RequiredReferenceFiles = @(
    "BepInEx.Core.dll",
    "BepInEx.Unity.IL2CPP.dll",
    "0Harmony.dll",
    "Il2CppInterop.Runtime.dll",
    "Il2Cppmscorlib.dll",
    "UnityEngine.CoreModule.dll",
    "UnityEngine.InputLegacyModule.dll"
)

$Gh = Get-Command "gh" -ErrorAction SilentlyContinue
if ($null -eq $Gh) {
    throw "GitHub CLI was not found."
}
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
    throw "GH_TOKEN is required to download the private release asset."
}

$ArchivePath = Join-Path ([System.IO.Path]::GetTempPath()) ("mystia-build-references-{0}.zip" -f [guid]::NewGuid().ToString("N"))

try {
    & $Gh.Source release download $Tag `
        --repo $Repository `
        --pattern $AssetName `
        --output $ArchivePath `
        --clobber
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download $AssetName from $Repository release $Tag."
    }

    $ActualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArchivePath).Hash
    if (-not $ActualSha256.Equals($ExpectedSha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Build-reference checksum mismatch. Expected $ExpectedSha256, actual $ActualSha256."
    }

    if (Test-Path -LiteralPath $DestinationDir) {
        Remove-Item -LiteralPath $DestinationDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $DestinationDir -Force

    $MissingFiles = @($RequiredReferenceFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $DestinationDir $_) -PathType Leaf)
    })
    if ($MissingFiles.Count -gt 0) {
        throw "Reference bundle is incomplete. Missing: $($MissingFiles -join ', ')."
    }

    Write-Host "Verified build references: $DestinationDir"
}
finally {
    if (Test-Path -LiteralPath $ArchivePath) {
        Remove-Item -LiteralPath $ArchivePath -Force
    }
}
