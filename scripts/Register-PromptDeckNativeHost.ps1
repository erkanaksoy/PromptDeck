[CmdletBinding(DefaultParameterSetName = 'Register')]
param(
    [Parameter(ParameterSetName = 'Register')]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [Parameter(ParameterSetName = 'Register')]
    [string]$HostExecutable,

    [Parameter(ParameterSetName = 'Register')]
    [string]$ManifestPath,

    [Parameter(ParameterSetName = 'Unregister', Mandatory)]
    [switch]$Unregister,

    [Parameter(ParameterSetName = 'Validate', Mandatory)]
    [switch]$Validate
)

$ErrorActionPreference = 'Stop'
$HostName = 'com.promptdeck.desktop'
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
$NativeDirectory = Join-Path $env:LOCALAPPDATA 'PromptDeck\NativeHost'
$DefaultManifestPath = Join-Path $NativeDirectory "$HostName.json"

function Test-ExtensionId {
    param([string]$Value)
    return $Value -match '^[a-p]{32}$'
}

function Get-RegisteredManifestPath {
    if (-not (Test-Path -LiteralPath $RegistryPath)) {
        return $null
    }
    return (Get-Item -LiteralPath $RegistryPath).GetValue('')
}

function Test-PromptDeckRegistration {
    $registeredManifest = Get-RegisteredManifestPath
    if (-not $registeredManifest) {
        throw "Native Messaging registry key is missing: $RegistryPath"
    }
    if (-not (Test-Path -LiteralPath $registeredManifest -PathType Leaf)) {
        throw "Registered native-host manifest is missing: $registeredManifest"
    }
    $manifest = Get-Content -Raw -LiteralPath $registeredManifest | ConvertFrom-Json
    if ($manifest.name -ne $HostName -or $manifest.type -ne 'stdio') {
        throw 'Native-host manifest name or type is invalid.'
    }
    if (-not [System.IO.Path]::IsPathRooted([string]$manifest.path)) {
        throw 'Native-host executable path must be absolute.'
    }
    if (-not (Test-Path -LiteralPath $manifest.path -PathType Leaf)) {
        throw "Native-host executable is missing: $($manifest.path)"
    }
    if ($manifest.allowed_origins.Count -ne 1) {
        throw 'Native-host manifest must contain exactly one allowed origin.'
    }
    $origin = [string]$manifest.allowed_origins[0]
    if ($origin -notmatch '^chrome-extension://([a-p]{32})/$') {
        throw 'Native-host allowed origin is invalid.'
    }
    Write-Output "Registration valid"
    Write-Output "  Host: $HostName"
    Write-Output "  Manifest: $registeredManifest"
    Write-Output "  Executable: $($manifest.path)"
    Write-Output "  Allowed origin: $origin"
}

if ($Unregister) {
    if (Test-Path -LiteralPath $RegistryPath) {
        Remove-Item -LiteralPath $RegistryPath -Recurse -Force
        Write-Output "Removed registry key: $RegistryPath"
    } else {
        Write-Output "Registry key is already absent: $RegistryPath"
    }
    exit 0
}

if ($Validate) {
    Test-PromptDeckRegistration
    exit 0
}

if (-not $ExtensionId) {
    throw 'ExtensionId is required. Retrieve it from chrome://extensions and pass -ExtensionId <32-character-id>.'
}
if (-not (Test-ExtensionId $ExtensionId)) {
    throw 'ExtensionId must be exactly 32 lowercase characters in the range a-p.'
}

if (-not $HostExecutable) {
    $HostExecutable = Join-Path $PSScriptRoot '..\target\release\promptdeck-native-host.exe'
}
$resolvedHost = (Resolve-Path -LiteralPath $HostExecutable -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $resolvedHost -PathType Leaf)) {
    throw "Native-host executable is missing: $resolvedHost"
}

if (-not $ManifestPath) {
    $ManifestPath = $DefaultManifestPath
}
$manifestDirectory = Split-Path -Parent $ManifestPath
New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
$absoluteManifest = [System.IO.Path]::GetFullPath($ManifestPath)

$manifest = [ordered]@{
    name = $HostName
    description = 'PromptDeck desktop communication bridge'
    path = $resolvedHost
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($absoluteManifest, $manifestJson, $utf8WithoutBom)

New-Item -Path $RegistryPath -Force | Out-Null
Set-Item -LiteralPath $RegistryPath -Value $absoluteManifest

Write-Output 'PromptDeck Native Messaging host registered for the current Windows user.'
Write-Output "  Registry: $RegistryPath"
Write-Output "  Manifest: $absoluteManifest"
Write-Output "  Executable: $resolvedHost"
Write-Output "  Extension ID: $ExtensionId"
Test-PromptDeckRegistration
