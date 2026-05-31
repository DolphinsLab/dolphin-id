#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is not installed. Install it and run 'gh auth login' first." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

repo="DolphinsLab/dolphin-id"

upsert_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  gh label create "$name" --repo "$repo" --color "$color" --description "$description" --force >/dev/null
}

upsert_milestone() {
  local title="$1"
  local description="$2"
  if ! gh api "repos/$repo/milestones" --jq '.[].title' | grep -Fxq "$title"; then
    gh api "repos/$repo/milestones" \
      --method POST \
      -f title="$title" \
      -f description="$description" >/dev/null
  fi
}

upsert_label "type:feature" "0E8A16" "New product capability"
upsert_label "type:bug" "D73A4A" "Defect or regression"
upsert_label "type:docs" "0075CA" "Documentation work"
upsert_label "type:security" "B60205" "Security-sensitive work"
upsert_label "type:release" "5319E7" "Release preparation"

upsert_label "area:core" "1D76DB" "Core contracts and shared types"
upsert_label "area:react" "1D76DB" "React integration"
upsert_label "area:ui" "1D76DB" "Default UI"
upsert_label "area:adapter" "1D76DB" "Chain adapters"
upsert_label "area:server" "1D76DB" "Server SDK and auth"
upsert_label "area:examples" "1D76DB" "Example apps"
upsert_label "area:dx" "1D76DB" "Developer experience"
upsert_label "area:hosted" "1D76DB" "Hosted service"

upsert_label "priority:p0" "B60205" "MVP blocker"
upsert_label "priority:p1" "D93F0B" "Stable release priority"
upsert_label "priority:p2" "FBCA04" "Future priority"

upsert_label "status:ready" "0E8A16" "Ready for development"
upsert_label "status:blocked" "D73A4A" "Blocked"
upsert_label "slice:afk" "C5DEF5" "Can be implemented independently"
upsert_label "slice:hitl" "F9D0C4" "Requires human review or decision"

upsert_milestone "v0.1" "MVP: EVM + Sui login, self-hosted auth, React SDK, default UI, Next.js example"
upsert_milestone "v0.2" "Beta: mobile, Solana, multi-wallet identity, refresh tokens, middleware"
upsert_milestone "v1.0" "Stable: docs site, adapter spec, hosted service, multi-language SDKs, audit"

echo "GitHub tracker labels and milestones are ready for $repo."
