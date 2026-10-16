@echo off
title CertiFlow
cd /d "%~dp0server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Download the LTS version from https://nodejs.org, install it, then double-click this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)"
if errorlevel 1 (
  echo.
  echo  Your Node.js is too old. CertiFlow needs version 20.19 or newer.
  echo  Install the LTS version from https://nodejs.org, then double-click this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo Checking packages (the first time takes a few minutes)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  if exist node_modules (
    echo Could not check for package updates, probably no internet. Starting with what is installed.
  ) else (
    echo Install failed. Connect to the internet and try again.
    pause
    exit /b 1
  )
)

set OPEN_BROWSER=1
echo Starting CertiFlow. Keep this window open while you use it.
call npm start
pause
