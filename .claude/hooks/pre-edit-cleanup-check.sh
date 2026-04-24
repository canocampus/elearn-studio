#!/bin/bash
# .claude/hooks/pre-edit-cleanup-check.sh

FILE_PATH=$1
echo "🛠️ Hook: Verificando patrones de limpieza en $FILE_PATH..."

# Si el archivo usa useEffect y GrapesJS, pero no parece tener cleanup
if grep -q "useEffect" "$FILE_PATH" && grep -q "editor" "$FILE_PATH"; then
    if ! grep -q "return () =>" "$FILE_PATH"; then
        echo "⚠️ ADVERTENCIA: Se ha detectado un useEffect que maneja el editor sin función de cleanup."
        echo "👉 Consulta la Skill: .claude/skills/grapesjs-react-lifecycle/SKILL.md"
    fi
fi

# Verificar si hay listeners sin removeEventListener (conteo básico)
ADD_COUNT=$(grep -c "addEventListener" "$FILE_PATH")
REM_COUNT=$(grep -c "removeEventListener" "$FILE_PATH")

if [ "$ADD_COUNT" -gt "$REM_COUNT" ]; then
    echo "⚠️ ADVERTENCIA: Hay más addEventListener ($ADD_COUNT) que removeEventListener ($REM_COUNT)."
fi

exit 0