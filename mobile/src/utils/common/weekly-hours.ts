// An artist's week, as the backend sends it (artist schedule and the public storefront): 7 items, weekday 0 = Monday.
export interface WeeklyHour {
  weekday: number;
  is_open: boolean;
  open_hour: number;
  close_hour: number;
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** 8 → '8:00', 20 → '20:00', 24 → '24:00' (midnight close). */
export function formatHour(hour: number): string {
  return `${hour}:00`;
}

function dayRange(h: WeeklyHour): string {
  return h.is_open ? `${formatHour(h.open_hour)}–${formatHour(h.close_hour)}` : 'Closed';
}

/** Consecutive days with the same hours merged: ['Mon–Sat 9:00–19:00', 'Sun Closed']. */
export function hoursSummary(hours: WeeklyHour[]): string[] {
  const sorted = [...hours].sort((a, b) => a.weekday - b.weekday);
  const lines: { from: number; to: number; range: string }[] = [];
  for (const h of sorted) {
    const range = dayRange(h);
    const last = lines.at(-1);
    if (last && last.range === range && last.to === h.weekday - 1) lines[lines.length - 1] = { ...last, to: h.weekday };
    else lines.push({ from: h.weekday, to: h.weekday, range });
  }
  return lines.map(({ from, to, range }) =>
    `${from === to ? WEEKDAY_SHORT[from] : `${WEEKDAY_SHORT[from]}–${WEEKDAY_SHORT[to]}`} ${range}`);
}
