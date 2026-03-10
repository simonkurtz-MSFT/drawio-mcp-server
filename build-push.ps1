#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build the multi-arch image, verify it succeeded, then push on confirmation.

.DESCRIPTION
  Flow:
    1. Preflight — docker CLI present, daemon reachable, .env exists,
       multi-platform builder bootstrapped.
    2. Build    — `docker compose build` into the builder cache
       (all platforms from compose > build.platforms). No push yet.
    3. Report   — success/failure + resolved image tag.
    4. Confirm  — interactive y/N prompt (or -Force to skip).
    5. Push     — `docker compose build --push`. 100% cache hit from
       step 2, so this is just manifest assembly + upload.

  All config (REGISTRY, IMAGE_NAME, IMAGE_VERSION) lives in .env and
  is interpolated by compose itself — this script never parses it.

.PARAMETER Force
  Skip all prompts (yes-to-all). Auto-starts Docker Desktop if the
  daemon is down; pushes without asking. Use in CI.

.PARAMETER Clean
  Build from scratch: ignore the layer cache (--no-cache) and re-pull
  base images (--pull). Applied to the build phase only — the push
  phase intentionally re-uses the just-produced layers so push is
  still fast. Use after a Deno/distroless security patch, or when you
  suspect a poisoned cache layer.

.PARAMETER Help
  Print usage and exit. `-?` also works (routes to Get-Help).

.EXAMPLE
  ./build-push.ps1                # build, confirm, push
  ./build-push.ps1 -Force         # build, push (no prompt — CI)
  ./build-push.ps1 -Clean         # fresh rebuild, confirm, push
  ./build-push.ps1 -Clean -Force  # fresh rebuild, push — release
#>
[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$Clean,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Drain any stdin someone piped at us (e.g. `'n' | ./build-push.ps1` in CI).
# Read-Host the prompt, not a pipeline-bound param, so pending input would
# otherwise surface as a spurious "cannot bind pipeline input" error.
$null = @($input)

function Show-Usage {
  @'
build-push.ps1 — multi-arch build & push via docker compose

USAGE
  ./build-push.ps1 [-Clean] [-Force] [-Help]

FLAGS
  -Clean   Rebuild from scratch. Ignores the BuildKit layer cache
           (--no-cache) and re-pulls base images (--pull). Slow —
           the QEMU-emulated arch alone takes several minutes. The
           subsequent push still cache-hits the fresh layers.
  -Force   Yes-to-all. Auto-starts Docker if the daemon is down,
           pushes without asking. Use in CI.
  -Help    Print this and exit. `-?` shows the full comment block.

FLOW
  preflight → build [→ confirm] → push

CONFIG
  All knobs live in .env (read by compose automatically):
    REGISTRY       ghcr.io/simonkurtz-msft   (required)
    IMAGE_NAME     drawio-mcp-server          (default)
    IMAGE_VERSION  3.0.2                      (also tagged :latest)
  Platforms are listed in docker-compose.yml > build.platforms.

EXAMPLES
  ./build-push.ps1                iterate: cached build, prompt
  ./build-push.ps1 -Clean -Force  release: cold build, no prompt
'@ | Write-Host
}

if ($Help) { Show-Usage; exit 0 }

function Die([string]$msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Ok ([string]$msg) { Write-Host "  ✓ $msg" -ForegroundColor DarkGray }

# Resolve the image ref through compose (which applies .env, or
# $env:REGISTRY if we've overridden it), then split off the registry
# host. Called once up front and again if the user retargets at the
# login menu.
function Resolve-Target {
  $img = (docker compose config --images 2>&1 | Select-Object -First 1)
  if ($LASTEXITCODE) { Die "compose config rejected .env: $img" }

  # First path segment is a registry/port. Single-segment refs (no /) and
  # first-seg-without-a-dot both fall through to Hub, which docker stores
  # under the legacy v1 index URL for reasons nobody likes.
  $seg = ($img -split '/', 2)[0]
  if ($seg -match '[.:]') { $regHost = $seg;        $key = $seg }
  else                    { $regHost = 'docker.io'; $key = 'https://index.docker.io/v1/' }

  # Docker Hub written out explicitly (REGISTRY=docker.io/user) has a dot,
  # so the heuristic above misfiles it as a custom registry. `docker login`
  # with no host still stores under the v1 index URL — normalize.
  if ($regHost -in 'docker.io', 'index.docker.io', 'registry-1.docker.io') {
    $regHost = 'docker.io'
    $key     = 'https://index.docker.io/v1/'
  }

  [pscustomobject]@{ Image = $img; RegHost = $regHost; AuthKey = $key }
}

# Run the right login flow for whatever kind of registry $regHost is.
# Returns the (possibly new) REGISTRY value to use going forward, or
# $null if the user skipped. Note the REGISTRY env var includes the
# namespace (ghcr.io/OWNER), not just the host — that's how compose
# composes the image ref.
#
# All login calls pipe through Out-Host: the user still sees interactive
# output (device-code URL, prompts, "Login Succeeded") but it doesn't leak
# into this function's return value. In PowerShell, any uncaptured stdout
# inside a function *becomes part of its output* — so a bare `docker login`
# writing "Login Succeeded" would turn our string return into a two-element
# array, and `$env:REGISTRY = $newReg` would stringify that as
# "Login Succeeded docker.io/user". Ask me how I know.
function Invoke-RegistryLogin([string]$regHost, [string]$currentRegistry) {
  switch -Regex ($regHost) {

    '^ghcr\.io$' {
      Write-Host "  GHCR wants your GitHub username and a PAT with 'write:packages' scope as the password." -ForegroundColor DarkGray
      Write-Host "  (Fine-grained PAT: Packages → read+write on this repo.)" -ForegroundColor DarkGray
      docker login ghcr.io | Out-Host
      if ($LASTEXITCODE) { return $null }
      return $currentRegistry   # keep .env's ghcr.io/<owner>
    }

    '\.azurecr\.io$' {
      # `az acr login` exchanges your already-authenticated az session
      # for a 3-hour registry token and calls `docker login` for you.
      # No password prompt. Dramatically better than raw docker login.
      if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        Die "Azure CLI not found. Install it, run 'az login', then retry."
      }
      $acrName = $regHost -replace '\.azurecr\.io$'
      Write-Host "  az acr login --name $acrName" -ForegroundColor DarkGray
      az acr login --name $acrName | Out-Host
      if ($LASTEXITCODE) { return $null }
      # ACR has no namespace suffix — the registry *is* the namespace.
      return "$acrName.azurecr.io"
    }

    default {
      # Docker Hub — bare `docker login`, no host arg.
      docker login | Out-Host
      if ($LASTEXITCODE) { return $null }
      return $currentRegistry
    }
  }
}

# Anchor on docker-compose.yml. Lives at repo root alongside this
# script, but walking up means it still works if someone reorganizes
# later — no hardcoded assumptions about `$PSScriptRoot` being the root.
$root = $PSScriptRoot
while ($root -and -not (Test-Path (Join-Path $root 'docker-compose.yml'))) {
  $root = Split-Path -Parent $root
}
if (-not $root) { Die "Couldn't locate docker-compose.yml above $PSScriptRoot" }

# Snapshot so finally can restore. $env: assignments outlive the script, so
# a retarget (option 2/3 below) would otherwise leak into the next run —
# including when that run was aborted with a broken value. $null here means
# "was unset", and `$env:X = $null` removes the var, so restore is symmetric.
$origRegistry = $env:REGISTRY

Push-Location $root
try {
  # ── 1. Preflight ─────────────────────────────────────────────
  Write-Host "Preflight" -ForegroundColor Cyan

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Die "docker CLI not found on PATH."
  }
  Ok "docker CLI"

  # `docker info` hits the daemon socket — the only honest readiness
  # signal. Docker Desktop's tray icon can show "running" while the
  # engine inside WSL2 is still booting.
  docker info --format '{{.ServerVersion}}' 2>&1 | Out-Null
  if ($LASTEXITCODE) {
    # -Force = yes-to-all, consistent with the push prompt. In CI this
    # branch never fires (Docker is a service or dind), so "auto-start
    # a desktop app under -Force" is a local-only convenience.
    # Default is YES here: you're running a build script — the intent is
    # clear. Contrast with the push prompt later, which stays default-no
    # (pushing is public, starting a local app isn't).
    if (-not $Force) {
      $ans = Read-Host "Docker daemon not running. Start Docker Desktop? [Y/n]"
      if ($ans -match '^[nN]') { Die "Docker daemon is not running." }
    }

    $ddExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $ddExe)) {
      Die "Docker Desktop not found at: $ddExe"
    }

    Write-Host "  … launching Docker Desktop" -ForegroundColor Yellow
    # Launching a second instance while Docker Desktop is already
    # starting is a no-op — it's a single-instance app. Safe to re-run.
    Start-Process -FilePath $ddExe

    # Cold start on WSL2 = distro boot + engine init + vpnkit. 30–90s
    # is normal, longer right after `wsl --shutdown`. The poll *is* the
    # readiness check — no separate state flag to trust.
    $deadline = [DateTime]::Now.AddSeconds(120)
    $spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; $i = 0
    do {
      Write-Host "`r  $($spin[$i++ % $spin.Length]) waiting for engine…  " -NoNewline -ForegroundColor DarkGray
      Start-Sleep -Seconds 2
      docker info --format '{{.ServerVersion}}' 2>&1 | Out-Null
    } while ($LASTEXITCODE -and [DateTime]::Now -lt $deadline)
    Write-Host "`r$(' ' * 40)`r" -NoNewline   # wipe spinner line

    if ($LASTEXITCODE) {
      Die "Docker Desktop did not become ready within 120s. Check the tray icon / WSL state."
    }
  }
  Ok "docker daemon"

  if (-not (Test-Path '.env')) {
    Die ".env not found. Copy .env.example → .env and set REGISTRY."
  }
  Ok ".env"

  # Let compose validate .env interpolation (catches missing REGISTRY
  # via the ${REGISTRY:?…} guard in docker-compose.yml) and give us the
  # fully-resolved image tag for the confirmation prompt later.
  $t = Resolve-Target
  $image    = $t.Image
  $registry = $t.RegHost
  $authKey  = $t.AuthKey
  Ok "compose config ($image)"

  # Registry auth. Do this BEFORE building — a -Clean build is several
  # minutes of QEMU, and finding out you forgot `docker login` only at
  # push time is the most expensive possible failure mode.
  #
  # Docker Desktop: ~/.docker/config.json has credsStore: "desktop"
  # and `auths` entries are just {} markers — real secrets live in the
  # OS keychain. We ask the credential helper directly; it answers
  # exit 0 + JSON if creds exist, exit 1 + "credentials not found" if
  # not. This catches `docker logout` too (the auths marker can linger
  # after logout, but the helper won't lie).
  $dockerCfg = Join-Path $env:USERPROFILE '.docker/config.json'
  $credsStore = $null
  if (Test-Path $dockerCfg) {
    $credsStore = (Get-Content $dockerCfg -Raw | ConvertFrom-Json).credsStore
  }

  $haveCreds = $false
  if ($credsStore) {
    $authKey | & "docker-credential-$credsStore" get 2>&1 | Out-Null
    $haveCreds = ($LASTEXITCODE -eq 0)
  }

  if ($haveCreds) {
    Ok "registry auth ($registry)"
  }
  elseif (-not $credsStore) {
    # No credential helper — bare engine, or config.json missing.
    # Can't verify cheaply. Warn and let push be the hard gate.
    Write-Host "  ? registry auth ($registry) — unverified (no credsStore). If push fails:  docker login $registry" -ForegroundColor DarkYellow
  }
  elseif ($Force) {
    # CI mode: missing creds is a config error, not an interactive moment.
    Die "Not logged in to $registry. In CI, set creds before invoking (e.g. echo `$PAT | docker login $registry -u USER --password-stdin)."
  }
  else {
    # Interactive picker. Option 1 = log into whatever .env already
    # targets (the common case: you just need to auth). Options 2/3
    # retarget by setting $env:REGISTRY, which compose prefers over
    # the .env file — this run only, nothing on disk changes.
    Write-Host ""
    Write-Host "  No credentials found for $registry." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    1) Log in to $registry" -NoNewline
    Write-Host "   (keep .env target)" -ForegroundColor DarkGray
    Write-Host "    2) Switch to Azure Container Registry   (az acr login — AAD, no password)"
    Write-Host "    3) Switch to Docker Hub"
    Write-Host "    4) Skip — build only, push will fail"
    Write-Host ""
    $pick = Read-Host "  Pick [1]"
    if (-not $pick) { $pick = '1' }
    Write-Host ""

    # What REGISTRY value are we starting from? compose read it from
    # .env; we grab it so option 1 can hand it back unchanged.
    $curReg = (Get-Content .env | Where-Object { $_ -match '^REGISTRY=' } | Select-Object -First 1) -replace '^REGISTRY='

    $newReg = switch ($pick) {
      '1' { Invoke-RegistryLogin $registry $curReg }
      '2' {
        $acr = Read-Host "  ACR name (just the name, not .azurecr.io)"
        if (-not $acr) { Die "No ACR name given." }
        Invoke-RegistryLogin "$acr.azurecr.io" "$acr.azurecr.io"
      }
      '3' {
        $hubUser = Read-Host "  Docker Hub username"
        if (-not $hubUser) { Die "No Docker Hub username given." }
        Invoke-RegistryLogin 'docker.io' "docker.io/$hubUser"
      }
      '4' {
        Write-Host "  Skipping auth. Build will succeed; push will fail." -ForegroundColor DarkYellow
        $null
      }
      default { Die "'$pick' isn't a thing. Pick 1–4." }
    }

    if ($pick -ne '4') {
      if (-not $newReg) { Die "Login failed." }

      # If they switched, retarget compose for this run only. Shell env
      # wins over .env in compose's variable precedence — no disk write.
      if ($newReg -ne $curReg) {
        $env:REGISTRY = $newReg
        Write-Host "  → Retargeted (this run): REGISTRY=$newReg" -ForegroundColor Yellow
        $t = Resolve-Target
        $image    = $t.Image
        $registry = $t.RegHost
        $authKey  = $t.AuthKey
      }

      # Re-probe — confirm the login actually landed in the keychain.
      $authKey | & "docker-credential-$credsStore" get 2>&1 | Out-Null
      if ($LASTEXITCODE) { Die "Login reported success but credential helper still says no for $registry. Try 'docker logout $registry' then retry." }
      Ok "registry auth ($registry)"
    }
  }

  # The default `docker` buildx driver can't emit multi-platform
  # manifest lists. `docker-container` can. Idempotent.
  $builder = 'multiarch'
  if (-not (docker buildx ls | Select-String -Pattern "^$builder\b" -Quiet)) {
    Write-Host "  … creating buildx builder '$builder'" -ForegroundColor Yellow
    docker buildx create --name $builder --driver docker-container --bootstrap | Out-Null
    if ($LASTEXITCODE) { Die "failed to create buildx builder" }
  }
  # CRITICAL: `docker buildx use` does NOT bind `docker compose build` —
  # compose has its own plumbing. BUILDX_BUILDER is the documented hook.
  # Without this, compose silently falls back to the default daemon
  # builder and every foreign-arch RUN step dies with `exec format error`.
  $env:BUILDX_BUILDER = $builder
  Ok "buildx builder ($builder via `$env:BUILDX_BUILDER)"

  # QEMU binfmt_misc registration. Docker Desktop on x64 ships these for
  # arm64; Docker Desktop on Windows-ARM64 does NOT ship the reverse
  # (amd64). No handler → `exec /bin/sh: exec format error` on the first
  # RUN step of the foreign arch. Also: registrations are kernel-scoped
  # and wiped by `wsl --shutdown`, so this check must run every time.
  # tonistiigi/binfmt with no --install flag just prints the current set.
  $binfmt = docker run --rm --privileged tonistiigi/binfmt 2>$null | Out-String
  if ($binfmt -notmatch 'qemu-x86_64' -or $binfmt -notmatch 'qemu-aarch64') {
    Write-Host "  … registering QEMU binfmt handlers (amd64, arm64)" -ForegroundColor Yellow
    docker run --rm --privileged tonistiigi/binfmt --install amd64,arm64 | Out-Null
    if ($LASTEXITCODE) { Die "failed to register QEMU binfmt handlers" }
  }
  Ok "QEMU binfmt (amd64 + arm64)"

  # ── 2. Build (cache only, no push) ───────────────────────────
  # -Clean → --no-cache (ignore layer cache) + --pull (re-fetch base
  # images even if present locally). We do NOT carry these to the push
  # phase — the fresh layers we just built are the ones we want to ship.
  $buildArgs = @()
  if ($Clean) {
    $buildArgs = '--no-cache', '--pull'
    $buildDesc = 'CLEAN — no cache, re-pull base images'
  } else {
    $buildDesc = 'all platforms → builder cache'
  }

  Write-Host ""
  Write-Host "Build" -ForegroundColor Cyan
  Write-Host "  docker compose build $($buildArgs -join ' ')  ($buildDesc)"
  Write-Host ""

  # With a docker-container builder + compose build.platforms, this
  # builds every arch into the builder cache and exits 0. The
  # "No output specified" warning is expected and harmless — we're
  # intentionally not loading or pushing yet.
  docker compose build @buildArgs
  $buildExit = $LASTEXITCODE

  # ── 3. Report ────────────────────────────────────────────────
  Write-Host ""
  if ($buildExit) {
    Die "Build FAILED (exit $buildExit). Nothing was pushed."
  }
  Write-Host "✓ Build succeeded" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Will push:"
  Write-Host "    $image"
  Write-Host "    $($image -replace ':[^:]+$', ':latest')"
  Write-Host "  Platforms: linux/amd64, linux/arm64  (see docker-compose.yml)"
  Write-Host ""

  # ── 4. Confirm ───────────────────────────────────────────────
  if (-not $Force) {
    $ans = Read-Host "Push to registry? [y/N]"
    if ($ans -notmatch '^[yY]') {
      Write-Host "Aborted. Build is cached — re-run with -Force to push without rebuilding." -ForegroundColor Yellow
      # Explicit, because $global:LASTEXITCODE may still hold a non-zero
      # from a tolerated prior docker call and we don't want that leaking
      # out as the script's own exit.
      exit 0
    }
  }

  # ── 5. Push ──────────────────────────────────────────────────
  Write-Host ""
  Write-Host "Push" -ForegroundColor Cyan
  Write-Host "  docker compose build --push  (cache hit → manifest + upload)"
  Write-Host ""

  docker compose build --push
  if ($LASTEXITCODE) { Die "Push FAILED (exit $LASTEXITCODE). Check 'docker login'." }

  Write-Host ""
  Write-Host "✓ Pushed" -ForegroundColor Green

  # ── 6. Verify ────────────────────────────────────────────────
  # Prove the manifest list is actually there. imagetools inspect hits
  # the registry (not local cache) and shows one entry per platform —
  # if the multi-arch push were broken you'd see only one arch or a 404.
  # Non-fatal: verification failing after a successful push usually
  # means registry indexing lag, not a broken publish.
  Write-Host ""
  Write-Host "Verify" -ForegroundColor Cyan
  Write-Host "  docker buildx imagetools inspect $image"
  Write-Host ""

  docker buildx imagetools inspect $image
  if ($LASTEXITCODE) {
    Write-Host ""
    Write-Host "  ? Verification failed (exit $LASTEXITCODE). Push did succeed — likely registry indexing lag. Retry manually in a few seconds." -ForegroundColor DarkYellow
  }
}
finally {
  $env:REGISTRY = $origRegistry
  Pop-Location
}
