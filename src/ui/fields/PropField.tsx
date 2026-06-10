import type { PropFieldSpec, PropValue } from './types';

interface Props {
  spec: PropFieldSpec;
  value: PropValue;
  onChange: (value: PropValue) => void;
  disabled?: boolean;
}

export function PropField({ spec, value, onChange, disabled }: Props) {
  if (spec.type === 'boolean') {
    return (
      <label className="field field-bool">
        <span>{spec.label}</span>
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (spec.type === 'select') {
    return (
      <label className="field">
        <span>{spec.label}</span>
        <select
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const num = typeof value === 'number' ? value : Number(value);
  const commit = (raw: string) => {
    let v = Number(raw);
    if (!Number.isFinite(v)) return;
    if (spec.integer) v = Math.round(v);
    if (spec.min !== undefined) v = Math.max(spec.min, v);
    if (spec.max !== undefined) v = Math.min(spec.max, v);
    onChange(v);
  };

  const hasRange = spec.min !== undefined && spec.max !== undefined;
  return (
    <label className="field">
      <span>
        {spec.label}
        {spec.unit ? <em> {spec.unit}</em> : null}
      </span>
      <div className="field-number">
        {hasRange && (
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step ?? (spec.integer ? 1 : 0.1)}
            value={num}
            disabled={disabled}
            onChange={(e) => commit(e.target.value)}
          />
        )}
        <input
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step ?? (spec.integer ? 1 : 0.1)}
          value={Number.isFinite(num) ? num : ''}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
        />
      </div>
    </label>
  );
}
