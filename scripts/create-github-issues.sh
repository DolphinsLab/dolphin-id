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

create_issue() {
  local file="$1"
  local title
  local labels
  local milestone
  local existing_url
  title="$(sed -n '1s/^# //p' "$file")"
  labels="$(sed -n '3s/^Labels: //p' "$file" | tr -d '`' | tr -d ' ')"
  milestone="$(sed -n '5s/^Milestone: //p' "$file")"
  existing_url="$(
    gh issue list \
      --repo "$repo" \
      --state all \
      --limit 1000 \
      --json title,url \
      --jq ".[] | select(.title == \"$title\") | .url"
  )"

  if [[ -n "$existing_url" ]]; then
    echo "Skip existing issue: $title ($existing_url)"
    return
  fi

  gh issue create \
    --repo "$repo" \
    --title "$title" \
    --body-file "$file" \
    --label "$labels" \
    --milestone "$milestone"
}

echo "Tip: run ./scripts/setup-github-tracker.sh once before creating issues."

for file in docs/issues/DID-*.md; do
  create_issue "$file"
done
