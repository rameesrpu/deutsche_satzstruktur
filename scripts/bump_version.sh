#!/usr/bin/env bash
# Bump the cache-busting ?v= string on every module, the entry script and styles.css in index.html.
# Usage: scripts/bump_version.sh [version]   (default: current timestamp, e.g. 202610251530)
set -euo pipefail
cd "$(dirname "$0")/.."
new="${1:-$(date +%Y%m%d%H%M)}"
count=$(grep -o '?v=[A-Za-z0-9._-]*"' index.html | wc -l)
sed -i -E "s/\?v=[A-Za-z0-9._-]+\"/?v=${new}\"/g" index.html
echo "index.html: ${count} version strings -> ${new}"
