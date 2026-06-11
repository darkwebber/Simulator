import { useState } from 'react';
import { useStore } from 'zustand';
import { emptyDocument } from '@/model/types';
import { gearReductionDemo } from '@/examples/gearReduction';
import { fourBitAdderDemo } from '@/examples/fourBitAdder';
import { mnistClassifierDemo } from '@/examples/mnistClassifier';
import { docTemporal, redo, undo, useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { exportToFile, importFromFile } from './persistence';

const MODE_LABEL = { edit: 'Edit', running: 'Running', paused: 'Paused' } as const;

export function Toolbar() {
  const doc = useDocumentStore((s) => s.doc);
  const mode = useSimStore((s) => s.mode);
  const speed = useSimStore((s) => s.speed);
  const stats = useSimStore((s) => s.stats);
  const warnings = useSimStore((s) => s.warnings);
  const showDebug = useSimStore((s) => s.showDebug);
  const canUndo = useStore(docTemporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(docTemporal, (s) => s.futureStates.length > 0);
  const [importError, setImportError] = useState<string | null>(null);

  const sim = useSimStore.getState();

  const loadDoc = (make: () => ReturnType<typeof emptyDocument>) => {
    sim.reset();
    useEditorStore.getState().select(null);
    useDocumentStore.getState().setDoc(make());
  };

  const newMachine = () => {
    if (!window.confirm('Start a new machine? You can undo to get the current one back.')) {
      return;
    }
    loadDoc(emptyDocument);
  };

  const doImport = async () => {
    setImportError(null);
    const result = await importFromFile();
    if (!result) return;
    if (result.ok) {
      sim.reset();
      useDocumentStore.getState().setDoc(result.doc);
    } else {
      setImportError(result.errors.slice(0, 3).join(' · '));
    }
  };

  return (
    <header className="toolbar-wrap">
      <div className="toolbar">
        <span className="toolbar-left">
          <strong className="app-title">⚙ Mechanical Simulator</strong>
          <input
            className="machine-name"
            type="text"
            value={doc.meta.name}
            disabled={mode !== 'edit'}
            title="Machine name"
            onChange={(e) =>
              useDocumentStore.getState().mutate((d) => ({
                ...d,
                meta: { ...d.meta, name: e.target.value },
              }))
            }
          />
        </span>

        <span className="toolbar-center">
          <span className={`mode-chip mode-${mode}`}>{MODE_LABEL[mode]}</span>
          {mode === 'edit' && (
            <button className="primary" onClick={sim.run} title="Build physics and run (Space)">
              ▶ Run
            </button>
          )}
          {mode === 'running' && (
            <button onClick={sim.pause} title="Pause (Space)">
              ⏸ Pause
            </button>
          )}
          {mode === 'paused' && (
            <button className="primary" onClick={sim.resume} title="Resume (Space)">
              ▶ Resume
            </button>
          )}
          {mode !== 'edit' && (
            <button onClick={sim.reset} title="Stop and return to editing">
              ⏹ Reset
            </button>
          )}
          <label className="speed" title="Simulation speed">
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={speed}
              onChange={(e) => sim.setSpeed(Number(e.target.value))}
            />
            {speed.toFixed(1)}×
          </label>
          <span className="toolbar-divider" />
          <button onClick={undo} disabled={mode !== 'edit' || !canUndo} title="Undo (Ctrl+Z)">
            ↩
          </button>
          <button onClick={redo} disabled={mode !== 'edit' || !canRedo} title="Redo (Ctrl+Shift+Z)">
            ↪
          </button>
        </span>

        <span className="toolbar-right">
          <button onClick={newMachine} disabled={mode !== 'edit'}>
            New
          </button>
          <button
            disabled={mode !== 'edit'}
            title="Load the 3:1 gear-reduction example"
            onClick={() => loadDoc(gearReductionDemo)}
          >
            Gears demo
          </button>
          <button
            disabled={mode !== 'edit'}
            title="Load the mechanical 4-bit adder. Set values on the input dials, press Run, read the answer off the drum tower."
            onClick={() => loadDoc(() => fourBitAdderDemo())}
          >
            4-bit adder
          </button>
          <button
            disabled={mode !== 'edit'}
            title="Load the mechanical MNIST classifier: feelers read the punched card, cords lace the scores, the falling bar names the digit. Press Run."
            onClick={() => loadDoc(() => mnistClassifierDemo())}
          >
            MNIST classifier
          </button>
          <span className="toolbar-divider" />
          <button onClick={() => exportToFile(doc)} title="Download as JSON">
            Export
          </button>
          <button onClick={doImport} disabled={mode !== 'edit'} title="Load a machine JSON">
            Import
          </button>
          <button
            className={showDebug ? 'active' : ''}
            onClick={sim.toggleDebug}
            title="Debug HUD"
          >
            ⌗
          </button>
        </span>
      </div>

      {importError && <div className="banner error">Import failed: {importError}</div>}
      {warnings.length > 0 && (
        <div className="banner warn">
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}
      {showDebug && stats && (
        <div className="banner debug">
          bodies {stats.bodies} · joints {stats.joints} · couplings {stats.couplings} ·
          drives {stats.motors} · max drift {stats.maxGearDrift.toExponential(2)}
        </div>
      )}
    </header>
  );
}
