#!/usr/bin/env bash
# Démarre Green Clean hors du Bureau (évite les blocages iCloud / page blanche).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${GREEN_CLEAN_DEV_DIR:-$HOME/Projects/green-clean}"

echo "→ Synchronisation vers $DEST"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude ".git" \
  "$SRC/" "$DEST/"

cd "$DEST"
if [[ ! -d node_modules ]]; then
  echo "→ npm install"
  npm install
fi

echo "→ Arrêt des anciens serveurs Next"
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo "→ Démarrage sur http://localhost:3000"
echo "   Code d'accès : /acces (défaut 157294386)"
npm run dev
