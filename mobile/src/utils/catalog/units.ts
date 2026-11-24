import type { QuantityUnit } from '../../types/catalog/catalog';

export const QUANTITY_UNITS: QuantityUnit[] = ['person', 'piece', 'box', 'card', 'hour', 'set'];
export const MAX_QUANTITY = 1000; // backend app/artist/constants.py MAX_QUANTITY

const PLURAL: Record<QuantityUnit, string> = { person: 'people', piece: 'pieces', box: 'boxes', card: 'cards', hour: 'hours', set: 'sets' };

/** The unit's word for `count`: "box" for 1, "boxes" otherwise. */
export function unitWord(unit: QuantityUnit | null, count: number): string {
  if (!unit) return count === 1 ? 'unit' : 'units';
  return count === 1 ? unit : PLURAL[unit];
}

/** "30 boxes", "1 person". */
export function countLabel(count: number, unit: QuantityUnit | null): string {
  return `${count} ${unitWord(unit, count)}`;
}

/** "Box" for a chip or heading. */
export function unitTitle(unit: QuantityUnit): string {
  return unit[0].toUpperCase() + unit.slice(1);
}
