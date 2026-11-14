#!/usr/bin/env bash
# The desktop app's version: the tag's (v1.2.3 -> 1.2.3) when building a release, otherwise
# 0.0.<run number> so test builds from the workflow can be told apart.
if [[ "${GITHUB_REF:-}" == refs/tags/v* ]]; then
  echo "${GITHUB_REF#refs/tags/v}"
else
  echo "0.0.${GITHUB_RUN_NUMBER:-0}"
fi
