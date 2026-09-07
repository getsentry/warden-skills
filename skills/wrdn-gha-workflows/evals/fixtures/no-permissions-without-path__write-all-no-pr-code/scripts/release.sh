#!/bin/bash
set -euo pipefail
echo "Releasing version"
gh release create "$GITHUB_REF_NAME" --generate-notes
