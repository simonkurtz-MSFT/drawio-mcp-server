#!/usr/bin/env bash
# Build the multi-arch image, verify it succeeded, then push on confirmation.
#
# Flow:
#   1. Preflight — docker CLI present, daemon reachable, .env exists,
#      multi-platform builder bootstrapped.
#   2. Build    — `docker compose build` into the builder cache
#      (all platforms from compose > build.platforms). No push yet.
#   3. Report   — success/failure + resolved image tag.
#   4. Confirm  — interactive y/N prompt (or --force to skip).
#   5. Push     — `docker compose build --push`. 100% cache hit from
#      step 2, so this is just manifest assembly + upload.
#
# All config (REGISTRY, IMAGE_NAME, IMAGE_VERSION) lives in .env and is
# interpolated by compose itself — this script never parses it.
#
# Usage:
#   ./build-push.sh                  # build, confirm, push
#   ./build-push.sh --force          # build, push (no prompt — CI)
#   ./build-push.sh --clean          # fresh rebuild, confirm, push
#   ./build-push.sh --clean --force  # fresh rebuild, push — release

set -uo pipefail   # no `-e`: we want to inspect exit codes ourselves

usage() {
  cat <<'EOF'
build-push.sh — multi-arch build & push via docker compose

USAGE
  ./build-push.sh [--clean] [--force] [--help]

FLAGS
  --clean, -c   Rebuild from scratch. Ignores the BuildKit layer cache
                (--no-cache) and re-pulls base images (--pull). Slow —
                the QEMU-emulated arch alone takes several minutes. The
                subsequent push still cache-hits the fresh layers.
  --force, -f   Skip the "Push to registry? [y/N]" prompt. Use in CI.
  --help,  -h   Print this and exit.

FLOW
  preflight → build [→ confirm] → push

CONFIG
  All knobs live in .env (read by compose automatically):
    REGISTRY       ghcr.io/simonkurtz-msft   (required)
    IMAGE_NAME     drawio-mcp-server          (default)
    IMAGE_VERSION  3.0.2                      (also tagged :latest)
  Platforms are listed in docker-compose.yml > build.platforms.

EXAMPLES
  ./build-push.sh                  iterate: cached build, prompt
  ./build-push.sh --clean --force  release: cold build, no prompt
EOF
}

FORCE=0
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    -c|--clean) CLEAN=1 ;;
    -h|--help)  usage; exit 0 ;;
    *)          echo "unknown flag: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

# Anchor on docker-compose.yml. Lives at repo root alongside this
# script, but walking up means it still works if someone reorganizes
# later — no hardcoded `..` that breaks.
root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
while [[ -n "$root" && ! -f "$root/docker-compose.yml" ]]; do
  root=${root%/*}
done
[[ -n "$root" ]] || { echo "✗ Couldn't locate docker-compose.yml" >&2; exit 1; }
cd "$root"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }
die()   { red "✗ $*"; exit 1; }
ok()    { gray "  ✓ $*"; }
yel()   { printf '\033[33m%s\033[0m\n' "$*"; }

# Resolve the image ref through compose (which applies .env, or an
# exported REGISTRY override), then split off the registry host.
# Sets: IMAGE REGISTRY_HOST AUTH_KEY
resolve_target() {
  IMAGE="$(docker compose config --images 2>&1 | head -n1)"
  [[ $? -eq 0 ]] || die "compose config rejected .env: ${IMAGE}"
  local seg=${IMAGE%%/*}
  if [[ "$seg" == *[.:]* ]]; then
    REGISTRY_HOST=$seg; AUTH_KEY=$seg
  else
    REGISTRY_HOST=docker.io; AUTH_KEY='https://index.docker.io/v1/'
  fi
}

# Run the right login for the given host. GHCR = docker login + PAT.
# ACR = az acr login (AAD exchange, no password). Hub = bare docker login.
# Echoes the REGISTRY value to use going forward. Returns non-zero on fail.
login_for() {
  local host=$1 cur_reg=$2
  case "$host" in
    ghcr.io)
      gray "  GHCR wants your GitHub username and a PAT with 'write:packages' scope as the password." >&2
      docker login ghcr.io >&2 || return 1
      printf '%s' "$cur_reg"
      ;;
    *.azurecr.io)
      command -v az >/dev/null || die "Azure CLI not found. Install it, run 'az login', then retry."
      local acr=${host%.azurecr.io}
      gray "  az acr login --name $acr" >&2
      az acr login --name "$acr" >&2 || return 1
      printf '%s.azurecr.io' "$acr"   # ACR has no namespace suffix
      ;;
    *)
      docker login >&2 || return 1
      printf '%s' "$cur_reg"
      ;;
  esac
}

# ── 1. Preflight ───────────────────────────────────────────────
cyan "Preflight"

command -v docker >/dev/null || die "docker CLI not found on PATH."
ok "docker CLI"

# `docker info` hits the daemon socket. Fails fast if the engine is down.
docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 \
  || die "Docker daemon is not running. Start it and retry."
ok "docker daemon"

[[ -f .env ]] || die ".env not found. Copy .env.example → .env and set REGISTRY."
ok ".env"

# Let compose validate .env interpolation (catches missing REGISTRY via
# the ${REGISTRY:?…} guard in docker-compose.yml) and give us the fully
# resolved image tag for the confirmation prompt later.
resolve_target
ok "compose config (${IMAGE})"

# Registry auth. Do this BEFORE building — a --clean build is several
# minutes of QEMU, and finding out you forgot `docker login` only at push
# time is the most expensive possible failure mode.
#
# Docker Desktop (mac/win): ~/.docker/config.json has credsStore +
# {} markers in `auths` — real creds are in the OS keychain. Linux with
# `pass`/`secretservice` helpers works the same. Ask the helper directly;
# exit 0 = creds present, exit 1 = not.
CREDS_STORE=
if [[ -f "$HOME/.docker/config.json" ]]; then
  # Cheap jq-free pull — sed out the one key we need. Tolerates whitespace.
  CREDS_STORE=$(sed -n 's/.*"credsStore"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$HOME/.docker/config.json")
fi

have_creds() {
  [[ -n "$CREDS_STORE" ]] || return 2   # can't tell
  printf '%s' "$1" | "docker-credential-$CREDS_STORE" get >/dev/null 2>&1
}

if have_creds "$AUTH_KEY"; then
  ok "registry auth (${REGISTRY_HOST})"
elif [[ -z "$CREDS_STORE" ]]; then
  # No helper — can't verify cheaply. Warn and let push be the hard gate.
  gray "  ? registry auth (${REGISTRY_HOST}) — unverified (no credsStore). If push fails:  docker login ${REGISTRY_HOST}"
elif [[ $FORCE -eq 1 ]]; then
  # CI: missing creds is a config error, not an interactive moment.
  die "Not logged in to ${REGISTRY_HOST}. In CI, set creds before invoking (echo \$PAT | docker login ${REGISTRY_HOST} -u USER --password-stdin)."
else
  # Interactive picker. Option 1 = log into whatever .env already
  # targets. Options 2/3 retarget by exporting REGISTRY, which compose
  # prefers over .env — this run only, nothing on disk changes.
  echo
  yel "  No credentials found for ${REGISTRY_HOST}."
  echo
  echo  "    1) Log in to ${REGISTRY_HOST}   (keep .env target)"
  echo  "    2) Switch to Azure Container Registry   (az acr login — AAD, no password)"
  echo  "    3) Switch to Docker Hub"
  echo  "    4) Skip — build only, push will fail"
  echo
  read -r -p "  Pick [1]: " pick
  pick=${pick:-1}
  echo

  # REGISTRY as .env currently has it, so option 1 can hand it back.
  cur_reg=$(sed -n 's/^REGISTRY=//p' .env | head -n1)

  case "$pick" in
    1) new_reg=$(login_for "$REGISTRY_HOST" "$cur_reg") || die "Login failed." ;;
    2)
      read -r -p "  ACR name (just the name, not .azurecr.io): " acr
      [[ -n "$acr" ]] || die "No ACR name given."
      new_reg=$(login_for "${acr}.azurecr.io" "${acr}.azurecr.io") || die "Login failed."
      ;;
    3)
      read -r -p "  Docker Hub username: " hubuser
      [[ -n "$hubuser" ]] || die "No Docker Hub username given."
      new_reg=$(login_for docker.io "docker.io/${hubuser}") || die "Login failed."
      ;;
    4)
      yel "  Skipping auth. Build will succeed; push will fail."
      new_reg=
      ;;
    *) die "'$pick' isn't a thing. Pick 1–4." ;;
  esac

  if [[ "$pick" != 4 ]]; then
    # If they switched, retarget compose for this run only. Shell env
    # wins over .env in compose's variable precedence — no disk write.
    if [[ "$new_reg" != "$cur_reg" ]]; then
      export REGISTRY="$new_reg"
      yel "  → Retargeted (this run): REGISTRY=${new_reg}"
      resolve_target
    fi
    # Re-probe — confirm the login actually landed in the keychain.
    have_creds "$AUTH_KEY" || die "Login reported success but credential helper still says no for ${REGISTRY_HOST}. Try 'docker logout ${REGISTRY_HOST}' then retry."
    ok "registry auth (${REGISTRY_HOST})"
  fi
fi

# The default `docker` buildx driver can't emit multi-platform manifest
# lists. `docker-container` can. Idempotent.
BUILDER=multiarch
if ! docker buildx ls | grep -q "^${BUILDER}\b"; then
  printf '\033[33m  … creating buildx builder %s\033[0m\n' "${BUILDER}"
  docker buildx create --name "${BUILDER}" --driver docker-container --bootstrap >/dev/null \
    || die "failed to create buildx builder"
fi
# CRITICAL: `docker buildx use` does NOT bind `docker compose build` —
# compose has its own plumbing. BUILDX_BUILDER is the documented hook.
# Without this, compose silently falls back to the default daemon builder
# and every foreign-arch RUN step dies with `exec format error`.
export BUILDX_BUILDER="${BUILDER}"
ok "buildx builder (${BUILDER} via BUILDX_BUILDER)"

# QEMU binfmt_misc registration. Docker Desktop on x64 ships these for
# arm64; Docker Desktop on Windows-ARM64 does NOT ship the reverse.
# No handler → `exec /bin/sh: exec format error` on the first RUN step
# of the foreign arch. Kernel-scoped; wiped by `wsl --shutdown`, so run
# on every invocation. tonistiigi/binfmt with no --install just prints.
BINFMT="$(docker run --rm --privileged tonistiigi/binfmt 2>/dev/null)"
if [[ "$BINFMT" != *qemu-x86_64* || "$BINFMT" != *qemu-aarch64* ]]; then
  printf '\033[33m  … registering QEMU binfmt handlers (amd64, arm64)\033[0m\n'
  docker run --rm --privileged tonistiigi/binfmt --install amd64,arm64 >/dev/null \
    || die "failed to register QEMU binfmt handlers"
fi
ok "QEMU binfmt (amd64 + arm64)"

# ── 2. Build (cache only, no push) ─────────────────────────────
# --clean → --no-cache (ignore layer cache) + --pull (re-fetch base
# images even if present locally). We do NOT carry these to the push
# phase — the fresh layers we just built are the ones we want to ship.
BUILD_ARGS=()
if [[ $CLEAN -eq 1 ]]; then
  BUILD_ARGS=(--no-cache --pull)
  BUILD_DESC="CLEAN — no cache, re-pull base images"
else
  BUILD_DESC="all platforms → builder cache"
fi

echo
cyan "Build"
echo "  docker compose build ${BUILD_ARGS[*]}  (${BUILD_DESC})"
echo

# With a docker-container builder + compose build.platforms, this builds
# every arch into the builder cache and exits 0. The "No output
# specified" warning is expected and harmless — we're intentionally not
# loading or pushing yet.
docker compose build "${BUILD_ARGS[@]}"
BUILD_EXIT=$?

# ── 3. Report ──────────────────────────────────────────────────
echo
if [[ $BUILD_EXIT -ne 0 ]]; then
  die "Build FAILED (exit ${BUILD_EXIT}). Nothing was pushed."
fi
green "✓ Build succeeded"
echo
echo "  Will push:"
echo "    ${IMAGE}"
echo "    ${IMAGE%:*}:latest"
echo "  Platforms: linux/amd64, linux/arm64  (see docker-compose.yml)"
echo

# ── 4. Confirm ─────────────────────────────────────────────────
if [[ $FORCE -eq 0 ]]; then
  read -r -p "Push to registry? [y/N] " ans
  if [[ ! "$ans" =~ ^[yY]$ ]]; then
    printf '\033[33mAborted. Build is cached — re-run with --force to push without rebuilding.\033[0m\n'
    exit 0
  fi
fi

# ── 5. Push ────────────────────────────────────────────────────
echo
cyan "Push"
echo "  docker compose build --push  (cache hit → manifest + upload)"
echo

docker compose build --push || die "Push FAILED. Check 'docker login'."

echo
green "✓ Pushed"
echo
echo "Verify:"
echo "  docker buildx imagetools inspect ${IMAGE}"
