import { listCategories } from '@/parts/registry';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';

const CATEGORY_LABELS: Record<string, string> = {
  structure: 'Structure',
  transmission: 'Transmission',
  power: 'Power',
  mechanism: 'Mechanisms',
};

/** Compact glyph per part type — quick visual scanning of the palette. */
const PART_GLYPHS: Record<string, string> = {
  baseplate: '▦',
  frameBeam: '╿',
  axle: '┃',
  spurGear: '✱',
  disc: '●',
  motor: '◙',
  inputDial: '◔',
  hinge: '⌐',
  spring: '∿',
  differential: 'Σ',
  indicatorDrum: '◍',
  pointerMarker: '▾',
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
              <span className="palette-glyph">{PART_GLYPHS[def.type] ?? '◆'}</span>
              {def.label}
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}
