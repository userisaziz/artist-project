import type { TransportResponse } from '../transport';
import type { MockArtists } from './artist';
import type { MockBookings } from './bookings';
import { CATALOG } from './artist';
import { availability, isBookableDate } from '../../bookings/pricing';

// Public directory (spec §1.3), same rules as backend api/v1/directory.py: approved artists only, no auth.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const err = (code: string, message: string, status: number): TransportResponse => ({ status, json: { code, message } });

export function handleDirectory(artists: MockArtists, bookings: MockBookings, now: number, path: string, query: Record<string, string>): TransportResponse {
  const [, , id, sub] = path.split('/');
  if (!id) return list(artists, query);
  const found = artists.byId(id);
  if (!found || found.profile.status !== 'approved') return err('not_found', 'Artist not found', 404);
  const { profile } = found;
  if (!sub) return { status: 200, json: artists.storefront(profile, bookings.completedCount(profile.id)) };
  if (sub !== 'availability') return err('not_found', `Mock has no handler for ${path}`, 404);
  const date = query.date ?? '';
  if (!isBookableDate(date, now)) return err('validation_error', 'Pick a date from today up to 60 days ahead', 422);
  const service = profile.services.find((s) => s.id === query.service_id && s.status === 'approved');
  if (!service) return err('validation_error', 'Unknown service', 422);
  return { status: 200, json: { date, slots: availability(date, service.duration_minutes, bookings.busy(profile.id), now) } };
}

function list(artists: MockArtists, query: Record<string, string>): TransportResponse {
  const q = (query.q ?? '').trim().toLowerCase();
  const categoryId = query.category_id ? Number(query.category_id) : null;
  if (categoryId !== null && !CATALOG.some((c) => c.id === categoryId)) return err('validation_error', 'Unknown category', 422);
  const rows = artists.approved().map((a) => a.profile).filter((p) =>
    (!query.city || p.city === query.city)
    && (categoryId === null || p.category_ids.includes(categoryId))
    && (!q || p.business_name.toLowerCase().includes(q) || p.services.some((s) => s.status === 'approved' && s.name.toLowerCase().includes(q))));
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Number(query.cursor) || 0;
  const items = rows.slice(offset, offset + limit).map((p) => artists.card(p));
  return { status: 200, json: { items, next_cursor: offset + limit < rows.length ? String(offset + limit) : null } };
}
