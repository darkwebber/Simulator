import { emptyDocument } from '@/model/types';
import { getPartDef } from '@/parts/registry';
import { gearReductionDemo } from '@/examples/gearReduction';
import { fourBitAdderDemo } from '@/examples/fourBitAdder';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { useGearAnalysis } from './useGearAnalysis';

/** Contextual one-line help, bottom center of the viewport. */
export function HintBar() {
  const mode = useSimStore((s) => s.mode);
  const placing = useEditorStore((s) => s.placing);
  const selectedPartId = useEditorStore((s) => s.selectedPartId);
  const hasParts = useDocumentStore((s) => s.doc.parts.length > 0);

  let hint: React.ReactNode = null;
  if (mode === 'running') {
    hint = (
      <>
        <kbd>Space</kbd> pause · <b>Reset</b> to edit
      </>
    );
  } else if (mode === 'paused') {
    hint = (
      <>
        <kbd>Space</kbd> resume · <b>Reset</b> to edit
      </>
    );
  } else if (placing) {
    hint = (
      <>
        Placing <b>{getPartDef(placing.type).label}</b> — click to place ·{' '}
        <kbd>R</kbd> rotate · <kbd>Esc</kbd> done
      </>
    );
  } else if (selectedPartId) {
    hint = (
      <>
        Drag the gizmo · <kbd>T</kbd> move · <kbd>R</kbd> rotate · <kbd>Del</kbd> delete ·{' '}
        <kbd>Esc</kbd> deselect
      </>
    );
  } else if (hasParts) {
    hint = (
      <>
        Click a part to select it · pick from the palette to add · <kbd>Space</kbd> run
      </>
    );
  }

  if (!hint) return null;
  return <div className="hint-bar">{hint}</div>;
}

/** Live "does it fit" feedback: lists gear pairs that almost mesh. */
export function MechanismIssues() {
  const mode = useSimStore((s) => s.mode);
  const doc = useDocumentStore((s) => s.doc);
  const { nearMisses } = useGearAnalysis();

  if (mode !== 'edit' || nearMisses.length === 0) return null;
  const nameOf = (id: string) => doc.parts.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="issues-overlay">
      {nearMisses.slice(0, 3).map((nm, i) => (
        <div key={i}>
          ⚠{' '}
          {nm.reason === 'module'
            ? `${nameOf(nm.aPartId)} and ${nameOf(nm.bPartId)} have different modules — they can't mesh`
            : `${nameOf(nm.aPartId)} and ${nameOf(nm.bPartId)} almost mesh — nudge them together`}
        </div>
      ))}
    </div>
  );
}

/** First-run onboarding when the scene is empty. */
export function EmptyState() {
  const mode = useSimStore((s) => s.mode);
  const empty = useDocumentStore((s) => s.doc.parts.length === 0);
  const placing = useEditorStore((s) => s.placing !== null);

  if (mode !== 'edit' || !empty || placing) return null;

  const load = (make: () => ReturnType<typeof emptyDocument>) => {
    useEditorStore.getState().select(null);
    useDocumentStore.getState().setDoc(make());
  };

  return (
    <div className="empty-state">
      <h1>⚙ Build a machine</h1>
      <p>
        Start with a <b>Baseplate</b> from the palette, then snap on posts, axles,
        gears, springs and motors — or open an example:
      </p>
      <div className="empty-actions">
        <button onClick={() => load(gearReductionDemo)}>3:1 gear reduction</button>
        <button onClick={() => load(() => fourBitAdderDemo())}>Mechanical 4-bit adder</button>
      </div>
    </div>
  );
}
