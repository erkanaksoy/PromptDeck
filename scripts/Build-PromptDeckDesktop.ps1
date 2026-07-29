[CmdletBinding()]
param(
    [string]$TargetDirectory = 'C:\tmp\promptdeck-desktop-release',
    [switch]$DebugBuild
)

$ErrorActionPreference = 'Stop'
$Repository = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$TargetTriple = 'x86_64-pc-windows-msvc'
$DesktopProfile = if ($DebugBuild) { 'debug' } else { 'release' }
$HostSource = Join-Path $TargetDirectory 'release\promptdeck-native-host.exe'
$SidecarDirectory = Join-Path $Repository 'apps\desktop\src-tauri\binaries'
$Sidecar = Join-Path $SidecarDirectory "promptdeck-native-host-$TargetTriple.exe"
$ArtifactDirectory = Join-Path $Repository 'artifacts\windows'
$VisualStudioEnvironment = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat'

if (-not (Test-Path -LiteralPath $VisualStudioEnvironment -PathType Leaf)) {
    throw 'Visual Studio 2022 Build Tools with the C++ workload are required.'
}

$environmentLines = & cmd.exe /d /s /c "call `"$VisualStudioEnvironment`" -arch=x64 >nul && set"
foreach ($line in $environmentLines) {
    $separator = $line.IndexOf('=')
    if ($separator -gt 0) {
        $name = $line.Substring(0, $separator)
        $value = $line.Substring($separator + 1)
        Set-Item -Path "Env:$name" -Value $value
    }
}
$env:CARGO_TARGET_DIR = $TargetDirectory
$env:PATH = "C:\Users\$env:USERNAME\.cargo\bin;$env:PATH"

Push-Location $Repository
try {
    cargo build --release -p promptdeck-native-host
    if ($LASTEXITCODE -ne 0) {
        throw 'Native host release build failed.'
    }
    if (-not (Test-Path -LiteralPath $HostSource -PathType Leaf)) {
        throw "Native host build did not produce $HostSource"
    }
    New-Item -ItemType Directory -Force -Path $SidecarDirectory | Out-Null
    Copy-Item -LiteralPath $HostSource -Destination $Sidecar -Force
    $tauriArguments = @('--filter', '@promptdeck/desktop', 'exec', 'tauri', 'build', '--bundles', 'msi')
    if ($DebugBuild) {
        $tauriArguments += '--debug'
    }
    pnpm @tauriArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Tauri $DesktopProfile build failed."
    }
    New-Item -ItemType Directory -Force -Path $ArtifactDirectory | Out-Null
    Copy-Item -LiteralPath $HostSource -Destination (Join-Path $ArtifactDirectory 'promptdeck-native-host.exe') -Force
    $desktopName = if ($DebugBuild) { 'promptdeck-desktop-debug.exe' } else { 'promptdeck-desktop.exe' }
    Copy-Item -LiteralPath (Join-Path $TargetDirectory "$DesktopProfile\promptdeck-desktop.exe") -Destination (Join-Path $ArtifactDirectory $desktopName) -Force
    $installer = Get-ChildItem -LiteralPath (Join-Path $TargetDirectory "$DesktopProfile\bundle\msi") -Filter '*.msi' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $installer) {
        throw 'Tauri did not produce an MSI installer.'
    }
    Copy-Item -LiteralPath $installer.FullName -Destination (Join-Path $ArtifactDirectory $installer.Name) -Force
    Write-Output "Windows artifacts: $ArtifactDirectory"
} finally {
    Pop-Location
}
