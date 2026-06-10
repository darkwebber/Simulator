import type { PartDefinition } from './partDefinition';

const registry = new Map<string, PartDefinition>();

export function registerPart(def: PartDefinition): void {
  if (registry.has(def.type)) {
    throw new Error(`Part type already registered: ${def.type}`);
  }
  registry.set(def.type, def);
}

export function getPartDef(type: string): PartDefinition {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown part type: ${type}`);
  return def;
}

export function hasPartDef(type: string): boolean {
  return registry.has(type);
}

export function knownPartTypes(): Set<string> {
  return new Set(registry.keys());
}

export function listPartDefs(): PartDefinition[] {
  return [...registry.values()];
}

export function listCategories(): Array<{
  category: PartDefinition['category'];
  parts: PartDefinition[];
}> {
  const order: PartDefinition['category'][] = [
    'structure',
    'transmission',
    'power',
    'mechanism',
  ];
  return order
    .map((category) => ({
      category,
      parts: listPartDefs().filter((d) => d.category === category),
    }))
    .filter((g) => g.parts.length > 0);
}
