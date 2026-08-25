<#
.SYNOPSIS
  Windows-native installer for the academic-project-management skill.
  Requires git on PATH (ships with Git for Windows, GitHub Desktop,
  or VS Code). No bash dependency.

.DESCRIPTION
  Native PowerShell installer. Clones the academic-project-management
  repo to one of the standard targets (codex, agents, claude, openclaw)
  or a custom directory, checks out the requested ref (default: moving
  v1 branch), and seeds ~/.config/academic-pm/projects.json from the
  template.

  Mirrors install.sh on the bash side. The two installers are
  siblings: install.sh is the source of truth for bash / WSL /
  Git Bash environments; install.ps1 is the source of truth for
  native PowerShell. Both produce the same installed directory.

  This script uses a param() block, so it must be invoked as a
  downloaded .ps1 file -- not piped through `irm | iex`. PowerShell
  rejects param() blocks in iex-evaluated script blocks. The
  standard two-step is:
      $installer = Join-Path $env:TEMP "academic-project-management-install.ps1"
      Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.ps1" -OutFile $installer
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Target agents -Yes

  Downloading to $env:TEMP avoids protected-current-directory failures
  such as C:\WINDOWS\system32. The execution-policy bypass is scoped to
  this installer process.

  Failure modes:
    - git not on PATH: the installer prints a one-line error
      pointing at the Git for Windows download and exits 1.
    - existing checkout with local changes: the installer refuses to
      update; commit, stash, or remove the changes first.
#>
[CmdletBinding()]
param(
    [ValidateSet("codex", "agents", "claude", "openclaw")]
    [string] $Target,

    [ValidateSet("v1", "main")]
    [string] $Channel,

    [string] $Ref,

    [string] $Dest,

    [string] $Name = "academic-project-management",

    [string] $Repo = "https://github.com/SYU8384/academic-project-management.git",

    # Accepted for install.sh parity; existing installs always update.
    [switch] $Update,

    [switch] $Yes
)

$ErrorActionPreference = 'Stop'

function Die([string] $Message) {
    Write-Host "Error: $Message" -ForegroundColor Red
    exit 1
}

function Normalize-RepoUrl([string] $Url) {
    $u = $Url.Trim()
    if ($u.EndsWith('.git')) { $u = $u.Substring(0, $u.Length - 4) }
    if ($u.StartsWith('git@github.com:')) {
        $u = 'https://github.com/' + $u.Substring('git@github.com:'.Length)
    }
    return $u
}

# --- Resolve target -> install directory ----------------------------------

if ($PSBoundParameters.ContainsKey('Target') -and $PSBoundParameters.ContainsKey('Dest')) {
    Die "Use either -Target or -Dest, not both."
}

if (-not $PSBoundParameters.ContainsKey('Target') -and -not $PSBoundParameters.ContainsKey('Dest')) {
    Write-Host "Choose where to install academic-project-management:"
    Write-Host "  1) Agents  (~/.agents/skills)"
    Write-Host "  2) Codex   (~/.codex/skills)"
    Write-Host "  3) Claude  (~/.claude/skills)"
    Write-Host "  4) OpenClaw (~/.openclaw/skills)"
    Write-Host "  5) Custom skills directory"
    $choice = Read-Host "Enter 1-5"
    switch ($choice) {
        '1' { $Target = 'agents' }
        '2' { $Target = 'codex' }
        '3' { $Target = 'claude' }
        '4' { $Target = 'openclaw' }
        '5' { $Dest = Read-Host "Parent skills directory" }
        default { Die "Invalid choice: $choice" }
    }
}

if ($Dest) {
    $installDir = Join-Path $Dest $Name
} elseif ($Target) {
    $map = @{
        'codex'    = Join-Path $env:USERPROFILE '.codex\skills'
        'agents'   = Join-Path $env:USERPROFILE '.agents\skills'
        'claude'   = Join-Path $env:USERPROFILE '.claude\skills'
        'openclaw' = Join-Path $env:USERPROFILE '.openclaw\skills'
    }
    $installDir = Join-Path $map[$Target] $Name
} else {
    Die "No destination selected."
}

if ($Name -match '[/\\]' -or $Name -eq '.' -or $Name -eq '..') {
    Die "Invalid skill name: $Name"
}

$resolvedRef = if ($Ref) { $Ref } elseif ($Channel) { $Channel } else { 'v1' }

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
    Write-Error "git not found. Install Git for Windows: https://git-scm.com/download/win"
    exit 1
}

if (-not $Yes) {
    $confirm = Read-Host "Install or update academic-project-management at: $installDir`nContinue? [y/N]"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') { Die "Canceled." }
}

# --- Install or update ------------------------------------------------------

$parentDir = Split-Path $installDir -Parent
if (-not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}

if (Test-Path $installDir) {
    if (-not (Test-Path (Join-Path $installDir '.git'))) {
        Die "$installDir already exists but is not a git checkout."
    }
    $existingUrl = (git -C $installDir config --get remote.origin.url 2>$null)
    if (-not $existingUrl) {
        Die "$installDir exists but has no origin remote."
    }
    if ((Normalize-RepoUrl $existingUrl) -ne (Normalize-RepoUrl $Repo)) {
        Die "$installDir exists but does not point at $Repo."
    }
    if (git -C $installDir status --porcelain) {
        Die "$installDir has local changes. Commit, stash, or remove them before updating."
    }
    Write-Host "==> Updating existing install at $installDir"
    git -C $installDir fetch origin | Out-Null
    git -C $installDir checkout $resolvedRef | Out-Null
    git -C $installDir pull --ff-only origin $resolvedRef | Out-Null
} else {
    Write-Host "==> Cloning $Repo ($resolvedRef) to $installDir"
    git clone --depth 1 --branch $resolvedRef $Repo $installDir | Out-Null
}

if (-not (Test-Path (Join-Path $installDir 'SKILL.md'))) {
    Die "Installed directory is missing SKILL.md."
}

# --- Seed ~/.config/academic-pm/projects.json --------------------------------

$configDir = Join-Path $env:USERPROFILE '.config\academic-pm'
$configFile = Join-Path $configDir 'projects.json'
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}
if (-not (Test-Path $configFile)) {
    Write-Host "==> Creating projects.json template..."
    $template = Join-Path $installDir 'templates\projects.template.json'
    Copy-Item $template $configFile
    Write-Host "    Edit $configFile to add your projects"
}

$installedVersion = 'unknown'
$versionFile = Join-Path $installDir 'VERSION'
if (Test-Path $versionFile) {
    $installedVersion = (Get-Content $versionFile -Raw).Trim()
}
Write-Host "==> Installed version: $installedVersion"

Write-Host @"

Installation complete!

Installed or updated academic-project-management at:
  $installDir

Config location: ~/.config/academic-pm/projects.json

Next steps:
  1. Restart your agent so it discovers the skill.
  2. Say: "set up this project" or "setup this project"
     The agent will ask for project name, PM folder path, research
     phase, optional manuscript home, and confirmation before
     creating anything.
  3. Or for OpenClaw PM agents, say: "set up OpenClaw PM"
     to get a copy-paste prompt for full OpenClaw workspace setup.

Quick commands (after setup):
  - "log this" or "I just finished the regression"
  - "verify setup" or "check PM"
  - "repair PM" or "fix indexes"
"@
