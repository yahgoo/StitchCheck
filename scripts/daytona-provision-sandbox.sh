#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# daytona-provision-sandbox.sh
#
# STATUS: DRAFT ONLY — Approval Gate 1 presentation artifact (Expert C).
# This script has NOT been executed. It is intended to run LATER, INSIDE a
# Daytona sandbox (image: node:20-slim), only after explicit human approval
# at Approval Gate 1 and only via the serial Lead Agent (Phase 3).
#
# Purpose: provision the `atlas-flight` CLI (atlas-flight-booking==0.3.12)
# inside the sandbox so the read-only worker (workers/daytona-atlas-worker/)
# can execute Atlas Search + Verify. Read-only provisioning: this script
# performs no Atlas calls, no auth, no booking/write operations.
#
# Aligned with documented usage in:
#   - docs/stitchcheck-atlas-skill-audit.md §1.2/§1.4:
#       curl -LsSf https://astral.sh/uv/install.sh | sh
#       uv tool install --force --python 3.12 atlas-flight-booking==0.3.12
#       smoke checks: atlas-flight --version / atlas-flight doctor --json
#   - docs/stitchcheck-opus-nosana-atlas-resolution-plan.md (auto-provisioning)
#   - Spec: .qoder/specs/Daytona_Atlas_Live_Animation_Spec_task-fbd.md §1(a), §5
#
# Credentials: the official CLI does NOT use env vars for credentials
# (OS keyring via `keyring`; see audit §2). The orchestrator may inject
# ATLAS_BASE_URL / ATLAS_CLIENT_ID / ATLAS_CLIENT_SECRET by NAME only —
# this script never reads, prints, or persists any credential value.
#
# Exit codes:
#   0  success
#   2  prerequisite installation failed (curl/ca-certificates)
#   3  uv installation failed
#   4  Python 3.12 installation/selection failed
#   5  atlas-flight-booking package installation failed
#   6  PATH configuration failed
#   7  CLI smoke check failed
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_PREREQS=2
readonly EXIT_UV=3
readonly EXIT_PYTHON=4
readonly EXIT_PACKAGE=5
readonly EXIT_PATH=6
readonly EXIT_SMOKE=7

readonly PYTHON_VERSION="3.12"
readonly ATLAS_PACKAGE="atlas-flight-booking==0.3.12"

log()  { printf '[provision] %s\n' "$*"; }
fail() {
  local code="$1"; shift
  printf '[provision][ERROR] %s (exit code %s)\n' "$*" "${code}" >&2
  exit "${code}"
}

log "Starting Daytona sandbox provisioning (uv + Python ${PYTHON_VERSION} + ${ATLAS_PACKAGE})"

# ── Step 0: Prerequisites ────────────────────────────────────────────────────
# node:20-slim is Debian-based and does not ship curl by default; the official
# uv installer requires curl + CA certificates. Idempotent: skip if present.
if ! command -v curl >/dev/null 2>&1; then
  log "Step 0: installing curl + ca-certificates via apt-get"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update >/dev/null \
      || fail "${EXIT_PREREQS}" "apt-get update failed"
    DEBIAN_FRONTEND=noninteractive \
      apt-get install -y --no-install-recommends curl ca-certificates >/dev/null \
      || fail "${EXIT_PREREQS}" "apt-get install curl ca-certificates failed"
  else
    fail "${EXIT_PREREQS}" "curl not found and apt-get unavailable; cannot fetch uv installer"
  fi
else
  log "Step 0: curl already present — skipping"
fi

# ── Step 1: Install uv (astral.sh) ───────────────────────────────────────────
# Official standalone installer. Idempotent: skip if uv is already on PATH.
# Default install location is $HOME/.local/bin.
export PATH="${HOME}/.local/bin:${PATH}"
if command -v uv >/dev/null 2>&1; then
  log "Step 1: uv already present: $(command -v uv) — skipping install"
else
  log "Step 1: installing uv via official astral.sh installer"
  curl -LsSf https://astral.sh/uv/install.sh | sh \
    || fail "${EXIT_UV}" "uv installer failed"
fi
command -v uv >/dev/null 2>&1 || fail "${EXIT_UV}" "uv not found on PATH after install"
log "Step 1: uv ready: $(uv --version 2>/dev/null || echo 'uv (version unknown)')"

# ── Step 2: Install/select Python 3.12 via uv ────────────────────────────────
# The package pins Python >=3.12,<3.13; uv downloads and manages the runtime.
# `uv python install` is idempotent (no-op if the version is present).
log "Step 2: ensuring Python ${PYTHON_VERSION} via uv"
uv python install "${PYTHON_VERSION}" \
  || fail "${EXIT_PYTHON}" "uv python install ${PYTHON_VERSION} failed"
if command -v uv >/dev/null 2>&1 && uv python find "${PYTHON_VERSION}" >/dev/null 2>&1; then
  log "Step 2: Python ${PYTHON_VERSION} available: $(uv python find "${PYTHON_VERSION}")"
else
  fail "${EXIT_PYTHON}" "Python ${PYTHON_VERSION} not resolvable via uv after install"
fi

# ── Step 3: Install atlas-flight-booking==0.3.12 ─────────────────────────────
# Exact command documented by the Atlas Flight Booking Skill (audit §1.2/§1.4):
#   uv tool install --force --python 3.12 atlas-flight-booking==0.3.12
# --force makes re-runs idempotent (reinstalls to a consistent state).
log "Step 3: installing ${ATLAS_PACKAGE} via uv tool"
uv tool install --force --python "${PYTHON_VERSION}" "${ATLAS_PACKAGE}" \
  || fail "${EXIT_PACKAGE}" "uv tool install ${ATLAS_PACKAGE} failed"

# ── Step 4: Configure PATH for the atlas-flight entrypoint ───────────────────
# uv tool installs entrypoint shims into uv's tool bin directory (typically
# $HOME/.local/bin on Linux). Persist it for subsequent exec sessions.
log "Step 4: configuring PATH"
UV_TOOL_BIN="$(uv tool dir --bin 2>/dev/null || true)"
if [ -z "${UV_TOOL_BIN}" ]; then
  UV_TOOL_BIN="${HOME}/.local/bin"
fi
export PATH="${UV_TOOL_BIN}:${PATH}"

PROFILE_SNIPPET="export PATH=\"${UV_TOOL_BIN}:\$PATH\""
if [ -d /etc/profile.d ] && [ -w /etc/profile.d ]; then
  printf '%s\n' "${PROFILE_SNIPPET}" > /etc/profile.d/daytona-atlas-cli.sh
  log "Step 4: persisted PATH in /etc/profile.d/daytona-atlas-cli.sh"
elif [ -w "${HOME}/.bashrc" ] || [ -w "${HOME}" ]; then
  if ! grep -qsF "${UV_TOOL_BIN}" "${HOME}/.bashrc" 2>/dev/null; then
    printf '%s\n' "${PROFILE_SNIPPET}" >> "${HOME}/.bashrc"
  fi
  log "Step 4: persisted PATH in ~/.bashrc"
else
  log "Step 4: PATH exported for this session only (no writable profile file)"
fi

command -v atlas-flight >/dev/null 2>&1 \
  || fail "${EXIT_PATH}" "atlas-flight entrypoint not found on PATH (looked in ${UV_TOOL_BIN})"
log "Step 4: atlas-flight entrypoint resolved: $(command -v atlas-flight)"

# ── Step 5: Smoke check (tolerant of the CLI's actual flags) ────────────────
# Preferred check per audit §1.4 is `atlas-flight --version`; fall back to
# `--help` in case the CLI's flag surface differs. Neither flag performs any
# network write or booking operation.
log "Step 5: running CLI smoke check"
SMOKE_OK=0
if atlas-flight --version >/dev/null 2>&1; then
  log "Step 5: 'atlas-flight --version' succeeded"
  SMOKE_OK=1
elif atlas-flight --help >/dev/null 2>&1; then
  log "Step 5: 'atlas-flight --help' succeeded (--version not available)"
  SMOKE_OK=1
fi
[ "${SMOKE_OK}" -eq 1 ] \
  || fail "${EXIT_SMOKE}" "atlas-flight smoke check failed (both --version and --help)"

# ── Done ─────────────────────────────────────────────────────────────────────
log "Provisioning complete: uv + Python ${PYTHON_VERSION} + ${ATLAS_PACKAGE}"
log "CLI available at: $(command -v atlas-flight)"
log "Note: authorization/environment selection ('atlas-flight auth status',"
log "      'atlas-flight environment use sandbox --json') is handled by the"
log "      read-only call phase, not by provisioning. No credentials touched."
exit "${EXIT_OK}"
