#requires -Version 7.0

param(
    [string]$Configuration = "Release",
    [switch]$SkipInstall,
    [Alias("SkipWebBuild")]
    [switch]$SkipFrontendBuild,
    [switch]$SkipTauriBuild,
    [switch]$SkipPackage,
    [switch]$NoFrozenLockfile
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ToolDir = $PSScriptRoot
$RootDir = (Resolve-Path (Join-Path $ToolDir "..")).Path
$RepoRoot = (Resolve-Path (Join-Path $RootDir "../..")).Path
$ProjectPath = Join-Path $RootDir "MystiaStewardCompanion.BepInEx.csproj"
$PackageScript = Join-Path $ToolDir "package-release.ps1"

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Title)

    Write-Host ""
    Write-Host "==> $Title" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Step $Title
    Write-Host "    $FilePath $($Arguments -join ' ')"
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
    }
}

function Get-PnpmCommand {
    $Corepack = Get-Command "corepack" -ErrorAction SilentlyContinue
    if ($null -ne $Corepack) {
        return @{
            FilePath = $Corepack.Source
            Prefix = @("pnpm")
        }
    }

    $Pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
    if ($null -ne $Pnpm) {
        return @{
            FilePath = $Pnpm.Source
            Prefix = @()
        }
    }

    throw "Neither corepack nor pnpm was found. Install Node.js 20+ and run: corepack enable"
}

function Invoke-Pnpm {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $Command = Get-PnpmCommand
    Invoke-Checked -Title $Title -FilePath $Command.FilePath -Arguments @($Command.Prefix + $Arguments)
}

Push-Location $RepoRoot
try {
    if (-not $SkipInstall) {
        $InstallArgs = @("install")
        if (-not $NoFrozenLockfile) {
            $InstallArgs += "--frozen-lockfile"
        }

        Invoke-Pnpm -Title "Install companion frontend dependencies" -Arguments $InstallArgs
    }

    if (-not $SkipFrontendBuild) {
        Invoke-Pnpm -Title "Build companion frontend" -Arguments @("build")
    }

    if (-not $SkipTauriBuild) {
        Invoke-Pnpm -Title "Build companion window" -Arguments @("tauri:build")
    }

    $Dotnet = Get-Command "dotnet" -ErrorAction SilentlyContinue
    if ($null -eq $Dotnet) {
        throw "dotnet was not found. Install .NET 6 SDK or newer."
    }

    $DotnetBuildArgs = @("build", $ProjectPath, "-c", $Configuration)

    Invoke-Checked `
        -Title "Build BepInEx plugin" `
        -FilePath $Dotnet.Source `
        -Arguments $DotnetBuildArgs

    if (-not $SkipPackage) {
        Write-Step "Create release package"
        & $PackageScript -Configuration $Configuration
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Build completed." -ForegroundColor Green
