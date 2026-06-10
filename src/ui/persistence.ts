/** Client-side persistence: debounced localStorage autosave + JSON file
 * export/import. No backend — the app is a static site. */

import { serializeDocument, parseDocument } from '@/model/serialization';
import type { MachineDocument } from '@/model/types';
import { knownPartTypes } from '@/parts/registry';
import { useDocumentStore } from '@/store/documentStore';

const AUTOSAVE_KEY = 'simulator.autosave.v1';

export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = useDocumentStore.subscribe((state, prev) => {
    if (state.doc === prev.doc) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, serializeDocument(state.doc));
      } catch {
        // Storage full/unavailable — autosave is best-effort.
      }
    }, 1000);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function loadAutosave(): MachineDocument | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    const result = parseDocument(json, knownPartTypes());
    return result.ok ? result.doc! : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function exportToFile(doc: MachineDocument): void {
  const blob = new Blob([serializeDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.meta.name.replace(/[^\w-]+/g, '_') || 'machine'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(): Promise<
  { ok: true; doc: MachineDocument } | { ok: false; errors: string[] } | null
> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      const result = parseDocument(text, knownPartTypes());
      if (result.ok) resolve({ ok: true, doc: result.doc! });
      else resolve({ ok: false, errors: result.errors });
    };
    // If the dialog is cancelled, onchange never fires; resolve(null) on focus
    // return is unreliable, so callers must tolerate a pending promise.
    input.click();
  });
}
