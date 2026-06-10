import { listCategories } from '@/parts/registry';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';

const CATEGORY_LABELS: Record<string, string> = {
  structure: 'Structure',
  transmission: 'Transmission',
  power: 'Power',
  mechanism: 'Mechanisms',
};

export function Palette() {
  const placingType = useEditorStore((s) => s.placing?.type ?? null);
  const editing = useSimStore((s) => s.mode === 'edit');

  return (
    <aside className="palette">
      <h2>Parts</h2>
      {listCategories().map(({ category, parts }) => (
        <section key={category}>
          <h3>{CATEGORY_LABELS[category] ?? category}</h3>
          {parts.map((def) => (
            <button
              key={def.type}
              className={`palette-item${placingType === def.type ? ' active' : ''}`}
              title={def.description}
              disabled={!editing}
              onClick={() =>
                useEditorStore.getState().startPlacing(def.type, { ...def.defaultProps })
              }
            >
              {def.label}
            </button>
          ))}
        </section>
      ))}
      <p className="palette-hint">
        Click a part, aim in the scene, click to place. Snap points glow.
        <br />
        Esc ends placement · Del removes · T/R move/rotate.
      </p>
    </aside>
  );
}
