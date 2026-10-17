import type { CatalogCategory, ServiceItem, ServiceStatus } from '../../core/api/types';
import type { PillTone } from '../../components/common/StatusPill';

/** "Mehendi › Bridal"; a row pointing at a top-level category (from before subcategories) reads "Mehendi". */
export function groupTitle(tree: CatalogCategory[], subcategoryId: number): string {
  for (const category of tree) {
    if (category.id === subcategoryId) return category.name;
    const sub = category.subcategories.find((s) => s.id === subcategoryId);
    if (sub) return `${category.name} › ${sub.name}`;
  }
  return 'Other';
}

/** Services grouped by "Category › Subcategory", in menu order. */
export function groupMyServices(tree: CatalogCategory[], services: ServiceItem[]): [string, ServiceItem[]][] {
  const groups = new Map<string, ServiceItem[]>();
  for (const s of services) {
    const title = groupTitle(tree, s.subcategory_id);
    groups.set(title, [...(groups.get(title) ?? []), s]);
  }
  return [...groups.entries()];
}

/** Spec §2.2 pills on custom services. */
export const CUSTOM_STATUS_PILL: Record<ServiceStatus, { label: string; tone: PillTone }> = {
  approved: { label: 'Live', tone: 'confirmed' },
  pending: { label: 'In review', tone: 'pending' },
  rejected: { label: 'Not approved', tone: 'danger' },
};
