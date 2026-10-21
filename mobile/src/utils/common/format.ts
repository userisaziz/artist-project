/** ₹ with Indian digit grouping; services are priced in whole rupees, stored as paise. */
export function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** A money field the server may withhold (e.g. the artist's earning on customer responses). */
export function formatMaybePrice(paise: number | null): string {
  return paise === null ? '—' : formatPrice(paise);
}

/** '480' or '1,200.50' (rupees, as typed) → paise; null when it isn't a positive amount. */
export function rupeesToPaise(text: string): number | null {
  const value = Number(text.replace(/[,\s₹]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Paise → rupees as typed into a field, for prefilled fields: 115000 → '1150', 115050 → '1150.50'. */
export function paiseToRupeesText(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
