#!/usr/bin/env bash
# Double-click (or run ./start-mac-linux.sh) to start CertiFlow
cd "$(dirname "$0")/server" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org and run this again."
  exit 1
fi

if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)"; then
  echo "Your Node.js is too old. CertiFlow needs version 20.19 or newer. Install the LTS from https://nodejs.org."
  exit 1
fi

echo "Checking packages (the first time takes a few minutes)..."
if ! npm install --no-audit --no-fund; then
  if [ -d node_modules ]; then
    echo "Could not check for package updates, probably no internet. Starting with what is installed."
  else
    echo "Install failed. Connect to the internet and try again."
    exit 1
  fi
fi

echo "Starting CertiFlow. Keep this window open while you use it."
OPEN_BROWSER=1 npm start
