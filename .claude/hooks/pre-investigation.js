const { execSync } = require('child_process');
const fs = require('fs');

console.log("🔍 Running Pre-Investigation Hook (Windows Compatible)...");

try {
    // Comando para reconstruir el grafo con Graphify
    const pythonCommand = `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`;

    execSync(pythonCommand, { stdio: 'inherit' });
    console.log("✅ Architecture graph ready.");
} catch (error) {
    console.warn("⚠️ Graphify refresh failed. Ensure Python and graphify are installed.");
}

process.exit(0);