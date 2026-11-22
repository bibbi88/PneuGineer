#!/usr/bin/env bash
# The desktop app's version: yy.mmdd.<workflow run number>, e.g. 26.1115.12 - always higher than
# the build before, which is what installed apps compare when they check for an update.
#
# A version tag (v26.1201.0 - named after the day it's made, see flathub/README.md) gives its own
# number instead: what that release and Flathub go by. It's never lower than the builds from main
# before it, and the next build from main (yy.mmdd.<run>, a higher run number) is higher again.
if [[ "${GITHUB_REF_TYPE:-}" == "tag" && "${GITHUB_REF_NAME:-}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "${BASH_REMATCH[1]}"
  exit 0
fi
month=$((10#$(date -u +%m)))
day=$((10#$(date -u +%d)))
echo "$(date -u +%y).$((month * 100 + day)).${GITHUB_RUN_NUMBER:-0}"
