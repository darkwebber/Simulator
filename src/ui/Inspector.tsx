import { connectionsOfPart, getPart } from '@/model/document';
import { getPartDef } from '@/parts/registry';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import {
  deleteConnection,
  deletePart,
  renamePart,
  updateConnectionProps,
  updatePartProps,
} from '@/editor/commands';
import { gearDims } from '@/geometry/gearProfile';
import { num } from '@/parts/partDefinition';
import { PropField } from './fields/PropField';

const KIND_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  revolute: 'Pivot',
  prismatic: 'Slider',
  spring: 'Spring',
};

export function Inspector() {
  const doc = useDocumentStore((s) => s.doc);
  const selectedPartId = useEditorStore((s) => s.selectedPartId);
  const editing = useSimStore((s) => s.mode === 'edit');

  const part = selectedPartId ? getPart(doc, selectedPartId) : undefined;

  if (!part) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p className="inspector-empty">
          {editing
            ? 'Select a part to edit its properties.'
            : 'Simulation running — press Reset to edit.'}
        </p>
      </aside>
    );
  }

  const def = getPartDef(part.type);
  const connections = connectionsOfPart(doc, part.id);
  const isGear = def.simTags?.includes('gear');
  const dims = isGear
    ? gearDims(Math.round(num(part.props, 'teeth', 16)), num(part.props, 'module', 0.5))
    : null;

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
      <p className="inspector-type">{def.label}</p>

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
      {connections.length === 0 && <p className="inspector-empty">None — loose part.</p>}
      <ul className="connection-list">
        {connections.map((c) => {
          const otherId = c.a.partId === part.id ? c.b.partId : c.a.partId;
          const other = getPart(doc, otherId);
          const showKeyed = c.kind === 'revolute' && 'keyed' in c.props;
          return (
            <li key={c.id}>
              <span>
                {KIND_LABELS[c.kind] ?? c.kind} → {other?.name ?? otherId}
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

      <button
        className="danger"
        disabled={!editing}
        onClick={() => deletePart(part.id)}
      >
        Delete part
      </button>
    </aside>
  );
}
