/** Save-file (de)serialization and validation. The save format is the document itself. */

import type { MachineDocument } from './types';

export function serializeDocument(doc: MachineDocument): string {
  return JSON.stringify(doc, null, 2);
}

export interface ParseResult {
  ok: boolean;
  doc?: MachineDocument;
  errors: string[];
}

function isVec3(v: unknown): boolean {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number');
}

function isQuat(v: unknown): boolean {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number');
}

/** Migration hook: raise schemaVersion here as the format evolves. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

/**
 * Parse and validate a saved machine. `knownPartTypes` comes from the part
 * registry (the model layer itself has no registry dependency).
 */
export function parseDocument(json: string, knownPartTypes: Set<string>): ParseResult {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Save file must be a JSON object'] };
  }
  const data = migrate(raw as Record<string, unknown>);

  if (data.schemaVersion !== 1) {
    errors.push(`Unsupported schemaVersion: ${String(data.schemaVersion)}`);
  }
  const parts = Array.isArray(data.parts) ? data.parts : null;
  const connections = Array.isArray(data.connections) ? data.connections : null;
  if (!parts) errors.push('Missing parts array');
  if (!connections) errors.push('Missing connections array');
  if (errors.length > 0) return { ok: false, errors };

  const partIds = new Set<string>();
  for (const p of parts!) {
    if (typeof p?.id !== 'string' || typeof p?.type !== 'string') {
      errors.push('Part missing id/type');
      continue;
    }
    if (partIds.has(p.id)) errors.push(`Duplicate part id: ${p.id}`);
    partIds.add(p.id);
    if (!knownPartTypes.has(p.type)) errors.push(`Unknown part type: ${p.type}`);
    if (!isVec3(p?.transform?.position) || !isQuat(p?.transform?.rotation)) {
      errors.push(`Part ${p.id} has invalid transform`);
    }
    if (typeof p?.props !== 'object' || p.props === null) {
      errors.push(`Part ${p.id} has invalid props`);
    }
  }
  for (const c of connections!) {
    if (typeof c?.id !== 'string') {
      errors.push('Connection missing id');
      continue;
    }
    for (const end of [c?.a, c?.b]) {
      if (typeof end?.partId !== 'string' || typeof end?.anchorId !== 'string') {
        errors.push(`Connection ${c.id} has invalid endpoints`);
      } else if (!partIds.has(end.partId)) {
        errors.push(`Connection ${c.id} references missing part ${end.partId}`);
      }
    }
    if (!['fixed', 'revolute', 'prismatic', 'spring'].includes(c?.kind)) {
      errors.push(`Connection ${c.id} has unknown kind: ${String(c?.kind)}`);
    }
  }

  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  if (errors.length > 0) return { ok: false, errors };

  const doc: MachineDocument = {
    schemaVersion: 1,
    meta: {
      name: typeof meta.name === 'string' ? meta.name : 'Imported machine',
      createdAt:
        typeof meta.createdAt === 'string' ? meta.createdAt : new Date().toISOString(),
      modifiedAt:
        typeof meta.modifiedAt === 'string' ? meta.modifiedAt : new Date().toISOString(),
    },
    settings: {
      gravity: isVec3(settings.gravity) ? (settings.gravity as never) : [0, -981, 0],
      gridSize: typeof settings.gridSize === 'number' ? settings.gridSize : 0.5,
    },
    parts: parts as MachineDocument['parts'],
    connections: connections as MachineDocument['connections'],
  };
  return { ok: true, doc, errors: [] };
}
