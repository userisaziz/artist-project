import type { ArtistProfile, ArtistStatus, Category, ServiceItem, UploadPurpose } from '../types';
import type { TransportResponse } from '../transport';

// Same rules as backend services/artist_service.py and schemas/artist.py — keep them in lockstep.
export const CITIES = ['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune']; // backend settings.cities
// The backend has no categories until an admin adds them; the mock seeds the design's six.
export const CATEGORIES: Category[] = ['Mehendi', 'Makeup', 'Hair', 'Photography', 'Decor', 'Tattoo']
  .map((name, i) => ({ id: i + 1, slug: name.toLowerCase(), name }));
const MIN_PHOTOS = 6;
const MAX_PHOTOS = 30;
const EDITABLE: ArtistStatus[] = ['draft', 'rejected'];

interface MockPhoto { id: string; key: string; width: number; height: number }
interface MockProfile {
  id: string; status: ArtistStatus; business_name: string; city: string; bio: string | null;
  photo_key: string | null; category_ids: number[]; services: ServiceItem[]; photos: MockPhoto[];
  rejection_reason: string | null; submitted_at: string | null; reviewed_at: string | null;
}

const err = (code: string, message: string, status: number, extra: object = {}): TransportResponse => ({ status, json: { code, message, ...extra } });
const isInt = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** In-memory artist profiles for MockTransport. `files` maps storage keys to local URIs for image URLs. */
export class MockArtists {
  private profiles = new Map<string, MockProfile>(); // user id → profile
  private seq = 0;
  constructor(private files: Map<string, string>) {}

  private id(kind: string) { return `mock-${kind}-${++this.seq}`; }
  private url(key: string) { return this.files.get(key) ?? `mock://${key}`; }
  private owns(key: string, userId: string, purpose: UploadPurpose) { return key.startsWith(`artists/${userId}/${purpose}/`); }

  private out(p: MockProfile): ArtistProfile {
    return {
      id: p.id, status: p.status, business_name: p.business_name, city: p.city, bio: p.bio,
      photo_key: p.photo_key, photo_url: p.photo_key ? this.url(p.photo_key) : null,
      categories: CATEGORIES.filter((c) => p.category_ids.includes(c.id)),
      services: p.services.map((s) => ({ ...s })),
      photos: p.photos.map((ph) => ({ ...ph, thumb_url: this.url(ph.key), card_url: this.url(ph.key), full_url: this.url(ph.key) })),
      rejection_reason: p.rejection_reason, submitted_at: p.submitted_at, reviewed_at: p.reviewed_at,
    };
  }

  private ok(p: MockProfile, status = 200): TransportResponse { return { status, json: this.out(p) }; }

  uploadTicket(userId: string, purpose: unknown): TransportResponse {
    if (purpose !== 'artist_photo' && purpose !== 'portfolio') return err('validation_error', 'purpose must be artist_photo or portfolio', 422);
    return { status: 200, json: { upload_url: 'mock://upload', fields: {}, key: `artists/${userId}/${purpose}/${++this.seq}` } };
  }

  /** Routes `/artists/me…` for a signed-in artist. */
  handle(userId: string, method: string, path: string, b: Record<string, unknown>): TransportResponse {
    const p = this.profiles.get(userId);
    if (method === 'GET' && path === '/artists/me') return p ? this.ok(p) : err('not_found', 'No artist profile yet', 404);
    if (method === 'PUT' && path === '/artists/me/profile') return this.saveProfile(userId, p, b);
    if (!p) return err('not_found', 'No artist profile yet', 404);
    if (!EDITABLE.includes(p.status)) return err('conflict', `Profile is ${p.status} and can't be edited`, 409);
    const id = path.split('/').pop() ?? '';
    if (method === 'POST' && path === '/artists/me/services') return this.addService(p, b);
    if (method === 'DELETE' && path.startsWith('/artists/me/services/')) return this.remove(p, 'services', id, 'Service not found');
    if (method === 'POST' && path === '/artists/me/photos') return this.addPhoto(userId, p, b);
    if (method === 'PUT' && path === '/artists/me/photos/order') return this.reorder(p, b.photo_ids);
    if (method === 'DELETE' && path.startsWith('/artists/me/photos/')) return this.remove(p, 'photos', id, 'Photo not found');
    if (method === 'POST' && path === '/artists/me/submit') return this.submit(p);
    return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
  }

  private saveProfile(userId: string, existing: MockProfile | undefined, b: Record<string, unknown>): TransportResponse {
    const name = text(b.business_name);
    if (!name || name.length > 120) return err('validation_error', 'business_name must be 1–120 characters', 422);
    if (typeof b.city !== 'string' || !CITIES.includes(b.city)) return err('validation_error', 'Unknown city', 422);
    const ids = Array.isArray(b.category_ids) ? (b.category_ids as unknown[]) : [];
    if (ids.length < 1 || ids.length > 6 || !ids.every((id) => CATEGORIES.some((c) => c.id === id))) return err('validation_error', 'Unknown category', 422);
    const photoKey = typeof b.photo_key === 'string' && b.photo_key ? b.photo_key : null;
    if (photoKey && !this.owns(photoKey, userId, 'artist_photo')) return err('validation_error', 'Invalid photo key', 422);
    if (existing && !EDITABLE.includes(existing.status)) return err('conflict', `Profile is ${existing.status} and can't be edited`, 409);
    const p: MockProfile = existing ?? {
      id: this.id('artist'), status: 'draft', business_name: '', city: '', bio: null, photo_key: null,
      category_ids: [], services: [], photos: [], rejection_reason: null, submitted_at: null, reviewed_at: null,
    };
    Object.assign(p, { business_name: name, city: b.city, category_ids: [...new Set(ids as number[])], photo_key: photoKey, bio: typeof b.bio === 'string' ? b.bio : null });
    this.profiles.set(userId, p);
    return this.ok(p);
  }

  private addService(p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const name = text(b.name);
    if (!CATEGORIES.some((c) => c.id === b.category_id)) return err('validation_error', 'Unknown category', 422);
    if (!name || name.length > 120) return err('validation_error', 'name must be 1–120 characters', 422);
    if (!isInt(b.price_paise, 100_000_000)) return err('validation_error', 'price_paise must be a positive whole number', 422);
    if (!isInt(b.duration_minutes, 1440)) return err('validation_error', 'duration_minutes must be 1–1440', 422);
    p.services.push({
      id: this.id('service'), category_id: b.category_id as number, name,
      price_paise: b.price_paise, duration_minutes: b.duration_minutes,
      description: typeof b.description === 'string' ? b.description : null,
    });
    return this.ok(p, 201);
  }

  private addPhoto(userId: string, p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const key = typeof b.key === 'string' ? b.key : '';
    if (!this.owns(key, userId, 'portfolio')) return err('validation_error', 'Invalid photo key', 422);
    if (p.photos.some((ph) => ph.key === key)) return err('conflict', 'Photo already added', 409);
    if (p.photos.length >= MAX_PHOTOS) return err('validation_error', `A portfolio holds at most ${MAX_PHOTOS} photos`, 422);
    if (!isInt(b.width, 20_000) || !isInt(b.height, 20_000)) return err('validation_error', 'width and height must be positive', 422);
    p.photos.push({ id: this.id('photo'), key, width: b.width, height: b.height });
    return this.ok(p, 201);
  }

  private reorder(p: MockProfile, ids: unknown): TransportResponse {
    const list = Array.isArray(ids) ? (ids as string[]) : [];
    const known = new Set(p.photos.map((ph) => ph.id));
    if (list.length !== known.size || new Set(list).size !== list.length || !list.every((id) => known.has(id))) {
      return err('validation_error', 'photo_ids must list every portfolio photo exactly once', 422);
    }
    p.photos.sort((a, b) => list.indexOf(a.id) - list.indexOf(b.id));
    return this.ok(p);
  }

  private remove(p: MockProfile, field: 'services' | 'photos', id: string, missing: string): TransportResponse {
    const i = p[field].findIndex((item) => item.id === id);
    if (i < 0) return err('not_found', missing, 404);
    p[field].splice(i, 1);
    return this.ok(p);
  }

  private submit(p: MockProfile): TransportResponse {
    const missing: string[] = [];
    if (!p.photo_key) missing.push('photo');
    if (!p.category_ids.length) missing.push('categories');
    if (!p.services.length) missing.push('services');
    if (p.photos.length < MIN_PHOTOS) missing.push('portfolio');
    if (missing.length) return err('validation_error', 'Profile is incomplete', 422, { missing, min_photos: MIN_PHOTOS });
    Object.assign(p, { status: 'pending', submitted_at: new Date().toISOString(), rejection_reason: null });
    return this.ok(p);
  }

  /** Test/dev stand-in for the admin app's approve and reject. */
  review(userId: string, decision: 'approved' | 'rejected', reason: string | null) {
    const p = this.profiles.get(userId);
    if (!p || p.status !== 'pending') throw new Error('review() needs a pending profile');
    Object.assign(p, { status: decision, rejection_reason: decision === 'rejected' ? reason : null, reviewed_at: new Date().toISOString() });
  }

  /** Demo artist (+15550009999): already approved, so the returning-artist path lands on the home. */
  seedApproved(userId: string) {
    const now = new Date().toISOString();
    this.profiles.set(userId, {
      id: this.id('artist'), status: 'approved', business_name: 'Priya Bridal Studio', city: 'Bangalore', bio: null,
      photo_key: null, category_ids: [1, 2], services: [], photos: [], rejection_reason: null, submitted_at: now, reviewed_at: now,
    });
  }
}
