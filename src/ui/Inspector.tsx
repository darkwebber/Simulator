import { connectionsOfPart, getPart } from '@/model/document';
import { getPartDef } from '@/parts/registry';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import {
  deleteConnection,
  deletePart,
  movePart,
  renamePart,
  updateConnectionProps,
  updatePartProps,
} from '@/editor/commands';
import { gearDims } from '@/geometry/gearProfile';
import { num } from '@/parts/partDefinition';
import type { Vec3 } from '@/model/types';
import { PropField } from './fields/PropField';

const KIND_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  revolute: 'Pivot',
  prismatic: 'Slider',
  spring: 'Spring',
};

const AXES: Array<{ label: string; index: 0 | 1 | 2 }> = [
  { label: 'X', index: 0 },
  { label: 'Y', index: 1 },
  { label: 'Z', index: 2 },
];

function MachineSummary() {
  const doc = useDocumentStore((s) => s.doc);
  const editing = useSimStore((s) => s.mode === 'edit');

  return (
    <>
      <p className="inspector-empty">
        {editing
          ? 'Select a part to edit it, or pick one from the palette to build.'
          : 'Simulation running — press Reset to edit.'}
      </p>
      <h3>Machine</h3>
      <dl className="summary">
        <div>
          <dt>Parts</dt>
          <dd>{doc.parts.length}</dd>
        </div>
        <div>
          <dt>Connections</dt>
          <dd>{doc.connections.length}</dd>
        </div>
      </dl>
      <h3>World</h3>
      <PropField
        spec={{ key: 'g', label: 'Gravity', type: 'number', min: -2000, max: 0, step: 1, unit: 'cm/s²' }}
        value={doc.settings.gravity[1]}
        disabled={!editing}
        onChange={(v) =>
          useDocumentStore.getState().mutate((d) => ({
            ...d,
            settings: { ...d.settings, gravity: [0, Number(v), 0] },
          }))
        }
      />
      <PropField
        spec={{ key: 'grid', label: 'Grid snap', type: 'number', min: 0.25, max: 2, step: 0.25, unit: 'cm' }}
        value={doc.settings.gridSize}
        disabled={!editing}
        onChange={(v) =>
          useDocumentStore.getState().mutate((d) => ({
            ...d,
            settings: { ...d.settings, gridSize: Number(v) },
          }))
        }
      />
      <h3>Keys</h3>
      <ul className="keys">
        <li><kbd>Space</kbd> run / pause</li>
        <li><kbd>Esc</kbd> cancel / deselect</li>
        <li><kbd>T</kbd>/<kbd>R</kbd> move / rotate</li>
        <li><kbd>R</kbd> spin ghost while placing</li>
        <li><kbd>Del</kbd> delete selection</li>
        <li><kbd>Ctrl+Z</kbd> undo</li>
      </ul>
    </>
  );
}

export function Inspector() {
  const doc = useDocumentStore((s) => s.doc);
  const selectedPartId = useEditorStore((s) => s.selectedPartId);
  const editing = useSimStore((s) => s.mode === 'edit');

  const part = selectedPartId ? getPart(doc, selectedPartId) : undefined;

  if (!part) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <MachineSummary />
      </aside>
    );
  }

  const def = getPartDef(part.type);
  const connections = connectionsOfPart(doc, part.id);
  const isGear = def.simTags?.includes('gear');
  const dims = isGear
    ? gearDims(Math.round(num(part.props, 'teeth', 16)), num(part.props, 'module', 0.5))
    : null;

  const setPosition = (index: 0 | 1 | 2, value: number) => {
    if (!Number.isFinite(value)) return;
    const position = [...part.transform.position] as Vec3;
    position[index] = value;
    movePart(part.id, { ...part.transform, position });
  };

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={part.name ?? ''}
          disabled={!editing}
          onChange={(e) => renamePart(part.id, e.target.value)}
        />
      </label>
      <p className="inspector-type">
        {def.label}
        <em>{def.description}</em>
      </p>

      <h3>Position</h3>
      <div className="position-row">
        {AXES.map(({ label, index }) => (
          <label key={label} className="position-field">
            <span>{label}</span>
            <input
              type="number"
              step={doc.settings.gridSize}
              value={Number(part.transform.position[index].toFixed(3))}
              disabled={!editing}
              onChange={(e) => setPosition(index, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <h3>Properties</h3>
      {def.propSchema.map((spec) => (
        <PropField
          key={spec.key}
          spec={spec}
          value={part.props[spec.key] ?? ''}
          disabled={!editing}
          onChange={(value) =>
            updatePartProps(part.id, { ...part.props, [spec.key]: value })
          }
        />
      ))}

      {dims && (
        <p className="inspector-derived">
          Pitch ⌀ {(dims.rPitch * 2).toFixed(2)} cm · outer ⌀{' '}
          {(dims.rOuter * 2).toFixed(2)} cm
        </p>
      )}

      <h3>Connections</h3>
      {connections.length === 0 && (
        <p className="inspector-empty">None — this part is loose.</p>
      )}
      <ul className="connection-list">
        {connections.map((c) => {
          const otherId = c.a.partId === part.id ? c.b.partId : c.a.partId;
          const other = getPart(doc, otherId);
          const showKeyed = c.kind === 'revolute' && 'keyed' in c.props;
          return (
            <li key={c.id}>
              <span>
                <span className={`kind-badge kind-${c.kind}`}>
                  {KIND_LABELS[c.kind] ?? c.kind}
                </span>
                {other?.name ?? otherId}
              </span>
              <span className="connection-actions">
                {showKeyed && (
                  <label title="Keyed: locked to the shaft (rotates with it). Unkeyed: spins freely.">
                    <input
                      type="checkbox"
                      checked={c.props.keyed === true}
                      disabled={!editing}
                      onChange={(e) =>
                        updateConnectionProps(c.id, { ...c.props, keyed: e.target.checked })
                      }
                    />
                    keyed
                  </label>
                )}
                <button
                  disabled={!editing}
                  title="Disconnect"
                  onClick={() => deleteConnection(c.id)}
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <button className="danger" disabled={!editing} onClick={() => deletePart(part.id)}>
        Delete part
      </button>
    </aside>
  );
}
