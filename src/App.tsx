import { useEffect } from 'react';
import { Palette } from './ui/Palette';
import { Toolbar } from './ui/Toolbar';
import { Inspector } from './ui/Inspector';
import { Viewport } from './viewport/Viewport';
import { useDocumentStore, undo, redo, docTemporal } from './store/documentStore';
import { useEditorStore } from './store/editorStore';
import { useSimStore } from './store/simStore';
import { deletePart } from './editor/commands';
import { loadAutosave, startAutosave } from './ui/persistence';

export default function App() {
  // Restore autosave once on boot, then start autosaving.
  useEffect(() => {
    const saved = loadAutosave();
    if (saved && saved.parts.length > 0) {
      useDocumentStore.getState().setDoc(saved);
      docTemporal.getState().clear();
    }
    return startAutosave();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }
      const editor = useEditorStore.getState();
      const sim = useSimStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (sim.mode !== 'edit') return;
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (sim.mode === 'edit') redo();
        return;
      }
      switch (e.key) {
        case 'Escape':
          if (editor.placing) editor.cancelPlacing();
          else editor.select(null);
          break;
        case 'Delete':
        case 'Backspace':
          if (sim.mode === 'edit' && editor.selectedPartId) {
            deletePart(editor.selectedPartId);
          }
          break;
        case 't':
        case 'T':
          editor.setGizmoMode('translate');
          break;
        case 'r':
        case 'R':
          // While placing, R spins the ghost a quarter turn instead.
          if (editor.placing) editor.rotateGhost();
          else editor.setGizmoMode('rotate');
          break;
        case ' ':
          e.preventDefault();
          if (sim.mode === 'edit') sim.run();
          else if (sim.mode === 'running') sim.pause();
          else sim.resume();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <Palette />
        <Viewport />
        <Inspector />
      </div>
    </div>
  );
}
