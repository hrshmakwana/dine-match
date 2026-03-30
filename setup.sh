#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# DineMatch — One-command setup script
# Run once after extracting:  bash setup.sh
# ═══════════════════════════════════════════════════════════════════════════
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ____  _            __  __       _       _     "
echo " |  _ \(_)_ __   ___|  \/  | __ _| |_ ___| |__  "
echo " | | | | | '_ \ / _ \ |\/| |/ _\` | __/ __| '_ \ "
echo " | |_| | | | | |  __/ |  | | (_| | || (__| | | |"
echo " |____/|_|_| |_|\___|_|  |_|\__,_|\__\___|_| |_|"
echo -e "${NC}"
echo -e "${YELLOW}Setting up DineMatch...${NC}\n"

# ── Check Node ────────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org (v18+)${NC}"; exit 1
fi
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node.js v18+ required. You have $(node -v)${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# ── Install app dependencies ──────────────────────────────────────────────────
echo -e "\n${BLUE}[2/5] Installing app dependencies...${NC}"
npm install
echo -e "${GREEN}✓ App dependencies installed${NC}"

# ── Install Functions dependencies ───────────────────────────────────────────
echo -e "\n${BLUE}[3/5] Installing Cloud Functions dependencies...${NC}"
cd functions && npm install && cd ..
echo -e "${GREEN}✓ Functions dependencies installed${NC}"

# ── .env ──────────────────────────────────────────────────────────────────────
echo -e "\n${BLUE}[4/5] Setting up .env...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠  Created .env — open it and fill in your Firebase + Google Maps keys${NC}"
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi

# ── Firebase native config files ──────────────────────────────────────────────
echo -e "\n${BLUE}[5/5] Checking Firebase native config files...${NC}"
if grep -q "REPLACE" google-services.json 2>/dev/null; then
  echo -e "${YELLOW}⚠  google-services.json is a placeholder${NC}"
  echo -e "   → Firebase Console > Project Settings > Android app > Download file"
else
  echo -e "${GREEN}✓ google-services.json OK${NC}"
fi
if grep -q "REPLACE" GoogleService-Info.plist 2>/dev/null; then
  echo -e "${YELLOW}⚠  GoogleService-Info.plist is a placeholder${NC}"
  echo -e "   → Firebase Console > Project Settings > iOS app > Download file"
else
  echo -e "${GREEN}✓ GoogleService-Info.plist OK${NC}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Dependencies installed successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "Before you can run the app, do these 3 things:\n"
echo -e "  ${YELLOW}1.${NC} Edit ${BLUE}.env${NC} — add your Firebase project keys"
echo -e "  ${YELLOW}2.${NC} Replace ${BLUE}google-services.json${NC} with the real file from Firebase"
echo -e "  ${YELLOW}3.${NC} Replace ${BLUE}GoogleService-Info.plist${NC} with the real file from Firebase"
echo ""
echo -e "Then run:\n"
echo -e "  ${BLUE}npx expo prebuild${NC}        — generate /android and /ios folders (run once)"
echo -e "  ${BLUE}npx expo run:android${NC}     — build and launch on Android emulator / device"
echo -e "  ${BLUE}npx expo run:ios${NC}         — build and launch on iOS Simulator (Mac only)"
echo ""
