import { describe, expect, it } from 'vitest';
import { parseDocument, serializeDocument } from './serialization';
import { emptyDocument, type MachineDocument } from './types';

const KNOWN = new Set(['spurGear', 'axle', 'baseplate']);

function sampleDoc(): MachineDocument {
  const doc = emptyDocument('Test rig');
  doc.parts.push(
    {
      id: 'p1',
      type: 'axle',
      name: 'Axle 1',
      props: { length: 8, radius: 0.4 },
      transform: { position: [0, 5, 0], rotation: [0, 0, 0, 1] },
    },
    {
      id: 'p2',
      type: 'spurGear',
      props: { teeth: 16, module: 0.5, width: 1, bore: 0.4, keyed: true },
      transform: { position: [0, 5, 0], rotation: [0, 0, 0, 1] },
    },
  );
  doc.connections.push({
    id: 'c1',
    kind: 'revolute',
    a: { partId: 'p2', anchorId: 'bore' },
    b: { partId: 'p1', anchorId: 'shaft_4' },
    props: { keyed: true },
  });
  return doc;
}

describe('serialization', () => {
  it('round-trips a document losslessly', () => {
    const doc = sampleDoc();
    const result = parseDocument(serializeDocument(doc), KNOWN);
    expect(result.ok).toBe(true);
    expect(result.doc).toEqual(doc);
  });

  it('rejects invalid JSON', () => {
    const r = parseDocument('{nope', KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Not valid JSON/);
  });

  it('rejects unknown part types', () => {
    const doc = sampleDoc();
    doc.parts[0].type = 'warpDrive';
    const r = parseDocument(serializeDocument(doc), KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Unknown part type: warpDrive/);
  });

  it('rejects dangling connection references', () => {
    const doc = sampleDoc();
    doc.connections[0].b.partId = 'ghost';
    const r = parseDocument(serializeDocument(doc), KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/missing part ghost/);
  });

  it('rejects wrong schema version', () => {
    const raw = JSON.parse(serializeDocument(sampleDoc()));
    raw.schemaVersion = 99;
    const r = parseDocument(JSON.stringify(raw), KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/schemaVersion/);
  });

  it('rejects duplicate part ids', () => {
    const doc = sampleDoc();
    doc.parts[1].id = 'p1';
    const r = parseDocument(serializeDocument(doc), KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/Duplicate part id/);
  });
});
