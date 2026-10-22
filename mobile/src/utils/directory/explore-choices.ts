import type { Choice } from '../../components/common/ChoiceSheet';
import type { DirectorySort } from '../../types/directory/directory';
import { formatPrice } from '../common/format';
import { addDays, formatDay } from '../common/time';

const PRICE_CAPS_PAISE = [200000, 500000, 1000000, 2000000];
const DATE_DAYS = 14; // the next two weeks, today included

export const SORT_LABELS: Record<DirectorySort, string> = {
  recommended: 'Recommended',
  nearest: 'Nearest',
  rating: 'Top rated',
  price: 'Price: low to high',
  recent: 'Newest',
};

/** "Nearest" only makes sense once "Near me" has a point. */
export function sortChoices(hasPoint: boolean): Choice<DirectorySort>[] {
  const order: DirectorySort[] = ['recommended', ...(hasPoint ? (['nearest'] as const) : []), 'rating', 'price', 'recent'];
  return order.map((value) => ({ value, label: SORT_LABELS[value] }));
}

export function priceChoices(): Choice<number | null>[] {
  return [{ value: null, label: 'Any price' }, ...PRICE_CAPS_PAISE.map((p) => ({ value: p, label: `Under ${formatPrice(p)}` }))];
}

/** Any date, then today, tomorrow and the rest of the next two weeks (IST date keys). */
export function dateChoices(todayKey: string): Choice<string | null>[] {
  const days = Array.from({ length: DATE_DAYS }, (_, i) => addDays(todayKey, i));
  const label = (key: string, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDay(key));
  return [{ value: null, label: 'Any date' }, ...days.map((key, i) => ({ value: key, label: label(key, i) }))];
}
