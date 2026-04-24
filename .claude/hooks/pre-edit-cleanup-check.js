const fs = require('fs');
const filePath = process.argv[2];

if (!filePath || !fs.existsSync(filePath)) process.exit(0);

const content = fs.readFileSync(filePath, 'utf8');
console.log(`\n🛠️  Hook: Verificando patrones en ${filePath}...`);

// Solo analizar si parece un componente de GrapesJS o tiene useEffect
if (content.includes('useEffect')) {
    const hasEditor = content.includes('editor');
    const hasCleanup = content.includes('return () =>');

    if (hasEditor && !hasCleanup) {
        console.warn("⚠️ ADVERTENCIA: useEffect detectado sin función de cleanup.");
        console.warn("👉 El editor de GrapesJS debe ser destruido: .claude/skills/grapesjs-react-lifecycle/SKILL.md");
    }

    // Conteo básico de listeners
    const addCount = (content.match(/addEventListener/g) || []).length;
    const remCount = (content.match(/removeEventListener/g) || []).length;

    if (addCount > remCount) {
        console.warn(`⚠️ ADVERTENCIA: Posible fuga de memoria. Listeners: ${addCount} add vs ${remCount} remove.`);
    }
}

process.exit(0);