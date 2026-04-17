# Approved Patterns: GrapesJS + React in elearn-studio

## Pattern 1: Editor Wrapper with Full Cleanup

```typescript
// ✅ CORRECT: EditorCanvas.tsx (excerpt)
export function EditorCanvas({ courseId, slideId }: Props) {
  const editorRef = useRef<Editor | null>(null);
  
  useEffect(() => {
    let editor: Editor | null = null;
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
    
    const init = async () => {
      editor = await initEditor({ /* config */ });
      editorRef.current = editor;
      
      // Subscribe to updates for syncing with React
      editor.on('component:update', handleComponentUpdate);
    };
    
    init();
    
    return () => {
      // Cleanup 
      if (autosaveTimer) clearTimeout(autosaveTimer);
      if (editor) {
        editor.off('component:update', handleComponentUpdate);
        editor.destroy();
      }
      editorRef.current = null;
    };
  }, [courseId, slideId]); // Explicit dependencies
  
  return <div ref={containerRef} className="grapesjs-container" />;
}
```
## Pattern 2: Hook for Component Property Subscription

```typescript
// ✅ CORRECT: useComponentProperty.ts
export function useComponentProperty<T>(
  editor: Editor | null,
  propertyPath: string,
  defaultValue: T
): T {
  const [value, setValue] = useState<T>(defaultValue);
  
  useEffect(() => {
    if (!editor) return;
    
    const component = editor.getSelected();
    if (!component) return;
    
    // Initial reading
    setValue(component.get(propertyPath) ?? defaultValue);
    
    // Subscription to changes
    const handleChange = () => {
      setValue(component.get(propertyPath) ?? defaultValue);
    };
    
    component.on(`change:${propertyPath}`, handleChange);
    return () => component.off(`change:${propertyPath}`, handleChange);
  }, [editor, propertyPath, defaultValue]);
  
  return value;
}
```


## Pattern 3: Centralized Persistence with UI Feedback

```typescript
// ✅ CORRECT: useEditorPersistence.ts
export function useEditorPersistence(editor: Editor | null) {
  const { setIsSaving, setSaveError } = useEditorStore();
  
  const save = useCallback(async () => {
    if (!editor) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Respect existing debounce in initEditor
      await triggerAutosave(editor);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [editor, setIsSaving, setSaveError]);
  
  return { save, isSaving: useEditorStore(s => s.isSaving) };
}
```


## Forbidden Anti-Patterns

```typescript
// ❌ PROHIBITED: Direct store without state sync
function handleSave() {
  editor.store(); // Bypasea debounce, UI state not updated
}

// ❌ PROHIBITED: Reading without a subscription
function MyPanel() {
  const props = editor.getSelected()?.get('extendedProperties'); // Stale data
  return <input value={props?.title} />;
}

// ❌ PROHIBITED: Listener without cleanup
useEffect(() => {
  document.addEventListener('dragstart', handler); // Cumulative leak
  // missing: return () => document.removeEventListener(...)
}, []);
```

⚠️  Implementation Note: In the current state (pre-T646), `autosaveTimer`
resides in `initEditor.ts` as a module variable. Cleanup must call
`cancelAutosave()` exported from `initEditor.ts` until T646 migrates it
within useEffect.