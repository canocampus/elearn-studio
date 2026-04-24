#!/bin/bash
echo "🔍 Running Pre-Investigation Hook..."
# Forzar la actualización del grafo si no existe o es viejo
if [ ! -d "graphify-out" ]; then
  python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
fi
echo "✅ Architecture graph ready. Use /graphify before proposing changes."