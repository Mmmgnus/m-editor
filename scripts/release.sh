#!/usr/bin/env bash
set -euo pipefail

VERSION_ARG=${1:-}

if [[ -z "${VERSION_ARG}" ]]; then
  echo "Usage: $0 <version>\nExample: $0 0.1.0" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git not found" >&2
  exit 1
fi

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  git status --short
  exit 1
fi

# Optional: bump package.json version using npm without publishing
if command -v npm >/dev/null 2>&1; then
  npm --version >/dev/null 2>&1 || true
  echo "Bumping package.json version to ${VERSION_ARG}"
  npm version "${VERSION_ARG}" -m "chore: release v%s" --git-tag-version=false >/dev/null 2>&1 || true
fi

TAG="v${VERSION_ARG}"
echo "Tagging ${TAG}"
git tag -a "${TAG}" -m "${TAG}"

echo "Pushing tag ${TAG}"
git push origin "${TAG}"

echo "Done. Created and pushed tag ${TAG}."
