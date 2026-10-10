#!/bin/bash
# ==============================================================================
# RexaCloud Panel — Production Upgrade Script
# Safely updates RexaCloud to the latest release, preserves configuration & database,
# rebuilds assets, and restarts the systemd application daemon.
# ==============================================================================

set -e

CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_PURPLE="\033[38;2;139;92;246m"
CLR_GREEN="\033[32m"
CLR_CYAN="\033[36m"
CLR_RED="\033[31m"

echo -e "\n${CLR_PURPLE}${CLR_BOLD}RexaCloud Panel — Upgrade Utility${CLR_RESET}"
echo "=================================================="

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${CLR_RED}Please run this upgrade script with sudo or as root.${CLR_RESET}"
    exit 1
fi

INSTALL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$INSTALL_DIR"

echo -e "${CLR_CYAN}[1/5] Backing up configuration...${CLR_RESET}"
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
mkdir -p "$INSTALL_DIR/backups"
if [ -f .env ]; then
    cp .env "$INSTALL_DIR/backups/.env.backup.$BACKUP_TIME"
    echo -e "${CLR_GREEN}Saved backup to $INSTALL_DIR/backups/.env.backup.$BACKUP_TIME${CLR_RESET}"
fi

echo -e "${CLR_CYAN}[2/5] Updating repository source code...${CLR_RESET}"
if [ -d .git ]; then
    if [[ "$CURRENT_REMOTE" == *"rexacloud/panel"* || "$CURRENT_REMOTE" == *"Rexa-dash-test"* || -z "$CURRENT_REMOTE" ]]; then
        echo "Updating Git remote origin to https://github.com/jukgamer200-gif/testdash.git..."
        git remote set-url origin https://github.com/jukgamer200-gif/testdash.git 2>/dev/null || git remote add origin https://github.com/jukgamer200-gif/testdash.git
    fi
    git fetch origin main || git fetch --all
    git reset --hard origin/main || git pull
else
    echo "Notice: Non-git installation directory. Preserving current source files."
fi

echo -e "${CLR_CYAN}[3/5] Updating Node.js dependencies...${CLR_RESET}"
npm install || npm install --legacy-peer-deps

echo -e "${CLR_CYAN}[4/5] Recompiling production frontend bundle...${CLR_RESET}"
npm run build

echo -e "${CLR_CYAN}[5/5] Restarting RexaCloud service daemon...${CLR_RESET}"
if systemctl is-active --quiet rexacloud; then
    systemctl restart rexacloud
    echo -e "${CLR_GREEN}[✔] RexaCloud service restarted successfully.${CLR_RESET}"
else
    echo "Notice: systemd service not currently running. Start it with: systemctl start rexacloud"
fi

echo "=================================================="
echo -e "${CLR_GREEN}${CLR_BOLD}RexaCloud Panel upgraded successfully!${CLR_RESET}\n"
