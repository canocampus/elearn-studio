# Patrones Aprobados: GrapesJS + React en elearn-studio

## Patrón 1: Wrapper de Editor con Cleanup Completo

```typescript
// ✅ CORRECTO: EditorCanvas.tsx (extracto)
export function EditorCanvas({ courseId, slideId }: Props) {
  const editorRef = useRef<Editor | null>(null);
  
  useEffect(() => {
    let editor: Editor | null = null;
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
    
    const init = async () => {
      editor = await initEditor({ /* config */ });
      editorRef.current = editor;
      
      // Suscribirse a cambios para sync con React
      editor.on('component:update', handleComponentUpdate);
    };
    
    init();
    
    return () => {
      // Cleanup ordenado
      if (autosaveTimer) clearTimeout(autosaveTimer);
      if (editor) {
        editor.off('component:update', handleComponentUpdate);
        editor.destroy();
      }
      editorRef.current = null;
    };
  }, [courseId, slideId]); // Dependencias explícitas
  
  return <div ref={containerRef} className="grapesjs-container" />;
}