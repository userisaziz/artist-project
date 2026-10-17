import type { NamedRef } from '../../core/api/types';
import type { ArtistProfile, ArtistStatus, ServiceItem, UploadPurpose } from '../../types/artist-onboarding/artist-onboarding';
import type { CatalogCategory, Category, ServiceTemplate } from '../../types/catalog/catalog';
import type { ArtistCard, ArtistPublic, PublicService } from '../../types/directory/directory';
import type { TransportResponse } from '../../core/api/transport';
import { isValidAadhaar } from '../../utils/artist-onboarding/aadhaar';
import { PORTFOLIO_SIZE, seedAvatarUrl, seedPhotoUrl } from '../directory/seed';
import type { SeedArtist } from '../directory/seed';

// Same rules as backend services/artist_service.py and schemas/artist.py — keep them in lockstep.
export const CITIES = ['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune']; // backend settings.cities
// The backend has no catalog until an admin builds it; the mock seeds the design's six categories,
// with subcategories and services under Mehendi and Makeup (the rest are still being set up).
const SEED: Record<string, Record<string, string[]>> = {
  Mehendi: { Bridal: ['Bridal Classic', 'Bridal Full Arms'], Arabic: ['Arabic Hands', 'Arabic Feet', 'Arabic Party'] },
  Makeup: { Bridal: ['HD Bridal Makeup', 'Airbrush Bridal'], Party: ['Party Makeup', 'Engagement Look'] },
  Hair: {}, Photography: {}, Decor: {}, Tattoo: {},
};
let nextSubId = 100;
let nextTemplateId = 1000;
export const CATALOG: CatalogCategory[] = Object.entries(SEED).map(([name, subs], i) => {
  const slug = name.toLowerCase();
  return {
    id: i + 1, slug, name,
    subcategories: Object.entries(subs).map(([sub, services]) => ({
      id: ++nextSubId, slug: `${slug}-${sub.toLowerCase()}`, name: sub,
      services: services.map((s): ServiceTemplate => ({ id: ++nextTemplateId, name: s, description: null })),
    })),
  };
});
export const CATEGORIES: Category[] = CATALOG.map(({ id, slug, name }) => ({ id, slug, name }));

/** A template with its subcategory and top-level category, as backend ArtistService._template looks it up. */
function findTemplate(id: unknown) {
  for (const category of CATALOG) {
    for (const sub of category.subcategories) {
      const template = sub.services.find((t) => t.id === id);
      if (template) return { category, sub, template };
    }
  }
  return null;
}
/** Top-level category and subcategory refs for a service's subcategory id (ServiceItem.subcategory_id). */
function serviceRefs(subcategoryId: number): { category: NamedRef | null; subcategory: NamedRef | null } {
  for (const category of CATALOG) {
    if (category.id === subcategoryId) return { category: { id: category.id, name: category.name }, subcategory: null };
    const sub = category.subcategories.find((s) => s.id === subcategoryId);
    if (sub) return { category: { id: category.id, name: category.name }, subcategory: { id: sub.id, name: sub.name } };
  }
  return { category: null, subcategory: null };
}

function findTemplateByName(category: string, subcategory: string, name: string) {
  const sub = CATALOG.find((c) => c.name === category)?.subcategories.find((s) => s.name === subcategory);
  const template = sub?.services.find((t) => t.name === name);
  if (!sub || !template) throw new Error(`Seed service ${category} › ${subcategory} › ${name} is not in the catalog`);
  return { sub, template };
}

/** An active subcategory (not a top-level category), as backend ArtistService._subcategory checks it. */
function findSubcategory(id: unknown) {
  for (const category of CATALOG) {
    const sub = category.subcategories.find((s) => s.id === id);
    if (sub) return { category, sub };
  }
  return null;
}

/** Backend CustomServiceIn / CustomServicePatch field rules; `required` for the POST. */
function customFieldError(b: Record<string, unknown>, required: boolean): TransportResponse | null {
  const present = (k: string) => b[k] !== undefined && b[k] !== null;
  const need = (k: string) => required || present(k);
  if (need('subcategory_id') && !(typeof b.subcategory_id === 'number' && Number.isInteger(b.subcategory_id))) return err('validation_error', 'subcategory_id is required', 422);
  if (need('name') && (typeof b.name !== 'string' || b.name.length < 1 || b.name.length > MAX_NAME)) return err('validation_error', `name must be 1–${MAX_NAME} characters`, 422);
  if (need('price_paise') && !isInt(b.price_paise, MAX_PRICE_PAISE)) return err('validation_error', 'price_paise must be a positive whole number', 422);
  if (need('duration_minutes') && !isInt(b.duration_minutes, MAX_MINUTES)) return err('validation_error', `duration_minutes must be 1–${MAX_MINUTES}`, 422);
  if (typeof b.description === 'string' && b.description.length > MAX_DESCRIPTION) return err('validation_error', `description must be at most ${MAX_DESCRIPTION} characters`, 422);
  return null;
}

const MIN_PHOTOS = 6;
const MAX_NAME = 120;
const MAX_PRICE_PAISE = 100_000_000;
const MAX_MINUTES = 1440;
const MAX_DESCRIPTION = 1000;
const MAX_PHOTOS = 30;
const EDITABLE: ArtistStatus[] = ['draft', 'rejected'];
const PURPOSES: UploadPurpose[] = ['artist_photo', 'portfolio', 'aadhaar']; // backend UploadRequest.purpose

interface MockPhoto { id: string; key: string; width: number; height: number }
interface MockKyc { last4: string; front_key: string; back_key: string } // like artist_kyc, minus the (encrypted) number
export interface MockProfile {
  id: string; status: ArtistStatus; business_name: string; city: string; bio: string | null;
  photo_key: string | null; category_ids: number[]; services: ServiceItem[]; photos: MockPhoto[];
  kyc: MockKyc | null;
  rejection_reason: string | null; submitted_at: string | null; reviewed_at: string | null;
}

/** `rating` and `review_count`, computed on read from public reviews (MockReviews.stats). */
export interface RatingStats { rating: number | null; review_count: number }

const err = (code: string, message: string, status: number, extra: object = {}): TransportResponse => ({ status, json: { code, message, ...extra } });
const NOT_APPROVED = () => err('conflict', 'Custom services open once your profile is approved', 409);
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
      kyc: p.kyc ? { aadhaar_last4: p.kyc.last4 } : null,
      rejection_reason: p.rejection_reason, submitted_at: p.submitted_at, reviewed_at: p.reviewed_at,
    };
  }

  private ok(p: MockProfile, status = 200): TransportResponse { return { status, json: this.out(p) }; }

  uploadTicket(userId: string, purpose: unknown): TransportResponse {
    if (!PURPOSES.includes(purpose as UploadPurpose)) return err('validation_error', 'purpose must be artist_photo, portfolio or aadhaar', 422);
    return { status: 200, json: { upload_url: 'mock://upload', fields: {}, key: `artists/${userId}/${purpose as UploadPurpose}/${++this.seq}` } };
  }

  /** Routes `/artists/me…` for a signed-in artist. */
  handle(userId: string, method: string, path: string, b: Record<string, unknown>): TransportResponse {
    const p = this.profiles.get(userId);
    if (method === 'GET' && path === '/artists/me') return p ? this.ok(p) : err('not_found', 'No artist profile yet', 404);
    if (method === 'PUT' && path === '/artists/me/profile') return this.saveProfile(userId, p, b);
    if (!p) return err('not_found', 'No artist profile yet', 404);
    if (path === '/artists/me/custom-services' || path.startsWith('/artists/me/custom-services/')) return this.customService(p, method, path, b);
    if (!EDITABLE.includes(p.status)) return err('conflict', `Profile is ${p.status} and can't be edited`, 409);
    const id = path.split('/').pop() ?? '';
    if (method === 'POST' && path === '/artists/me/services') return this.addService(p, b);
    if (method === 'DELETE' && path.startsWith('/artists/me/services/')) return this.remove(p, 'services', id, 'Service not found');
    if (method === 'POST' && path === '/artists/me/photos') return this.addPhoto(userId, p, b);
    if (method === 'PUT' && path === '/artists/me/photos/order') return this.reorder(p, b.photo_ids);
    if (method === 'PUT' && path === '/artists/me/kyc') return this.saveKyc(userId, p, b);
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
      category_ids: [], services: [], photos: [], kyc: null, rejection_reason: null, submitted_at: null, reviewed_at: null,
    };
    Object.assign(p, { business_name: name, city: b.city, category_ids: [...new Set(ids as number[])], photo_key: photoKey, bio: typeof b.bio === 'string' ? b.bio : null });
    this.profiles.set(userId, p);
    return this.ok(p);
  }

  private addService(p: MockProfile, b: Record<string, unknown>): TransportResponse {
    if (!isInt(b.price_paise, 100_000_000)) return err('validation_error', 'price_paise must be a positive whole number', 422);
    if (!isInt(b.duration_minutes, 1440)) return err('validation_error', 'duration_minutes must be 1–1440', 422);
    if (typeof b.description === 'string' && b.description.length > 1000) return err('validation_error', 'description must be at most 1000 characters', 422);
    const found = findTemplate(b.template_id);
    if (!found) return err('validation_error', 'Unknown service', 422);
    if (!p.category_ids.includes(found.category.id)) return err('validation_error', 'Pick that category on your profile first', 422);
    if (p.services.some((s) => s.template_id === found.template.id)) return err('conflict', "You've already added this service", 409);
    p.services.push({
      id: this.id('service'), category_id: found.sub.id, subcategory_id: found.sub.id, template_id: found.template.id,
      name: found.template.name, price_paise: b.price_paise, duration_minutes: b.duration_minutes,
      description: typeof b.description === 'string' ? b.description : null, status: 'approved', rejection_reason: null,
    });
    return this.ok(p, 201);
  }

  // ---- Custom services (catalog Part 2): approved artists only, each waits for admin review ----

  private customService(p: MockProfile, method: string, path: string, b: Record<string, unknown>): TransportResponse {
    const id = path.split('/')[4];
    if (method === 'POST' && !id) return this.addCustom(p, b);
    if (method === 'PATCH' && id) return this.updateCustom(p, id, b);
    if (method === 'DELETE' && id) return this.deleteCustom(p, id);
    return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
  }

  /** Field checks first (FastAPI validates the body before the service runs), then approval, then the subcategory. */
  private addCustom(p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const invalid = customFieldError(b, true);
    if (invalid) return invalid;
    if (p.status !== 'approved') return NOT_APPROVED();
    if (!findSubcategory(b.subcategory_id)) return err('validation_error', 'Unknown subcategory', 422);
    const name = text(b.name);
    if (!name) return err('validation_error', 'Name is required', 422);
    p.services.push({
      id: this.id('service'), category_id: b.subcategory_id as number, subcategory_id: b.subcategory_id as number, template_id: null, name,
      price_paise: b.price_paise as number, duration_minutes: b.duration_minutes as number,
      description: typeof b.description === 'string' ? b.description : null, status: 'pending', rejection_reason: null,
    });
    return this.ok(p, 201);
  }

  /** Any field; null leaves a required field as it is. Any edit sends the service back to review. */
  private updateCustom(p: MockProfile, id: string, b: Record<string, unknown>): TransportResponse {
    const invalid = customFieldError(b, false);
    if (invalid) return invalid;
    if (p.status !== 'approved') return NOT_APPROVED();
    const i = p.services.findIndex((s) => s.id === id && s.template_id === null);
    if (i < 0) return err('not_found', 'Service not found', 404);
    const item = p.services[i];
    const has = (k: string) => b[k] !== undefined && b[k] !== null;
    if (has('subcategory_id') && !findSubcategory(b.subcategory_id)) return err('validation_error', 'Unknown subcategory', 422);
    const name = has('name') ? text(b.name) : item.name;
    if (!name) return err('validation_error', 'Name is required', 422);
    const subId = has('subcategory_id') ? (b.subcategory_id as number) : item.subcategory_id;
    p.services[i] = {
      ...item, name, category_id: subId, subcategory_id: subId,
      price_paise: has('price_paise') ? (b.price_paise as number) : item.price_paise,
      duration_minutes: has('duration_minutes') ? (b.duration_minutes as number) : item.duration_minutes,
      description: 'description' in b ? (typeof b.description === 'string' ? b.description : null) : item.description,
      status: 'pending', rejection_reason: null,
    };
    return this.ok(p);
  }

  private deleteCustom(p: MockProfile, id: string): TransportResponse {
    if (p.status !== 'approved') return NOT_APPROVED();
    if (!p.services.some((s) => s.id === id && s.template_id === null)) return err('not_found', 'Service not found', 404);
    p.services = p.services.filter((s) => s.id !== id);
    return this.ok(p);
  }

  /** Test/dev stand-in for the admin's custom-service approve and reject. */
  reviewCustomService(userId: string, serviceId: string, decision: 'approved' | 'rejected', reason: string | null) {
    const p = this.profiles.get(userId);
    const i = p?.services.findIndex((s) => s.id === serviceId && s.template_id === null) ?? -1;
    if (!p || i < 0) throw new Error('reviewCustomService() needs a custom service');
    p.services[i] = { ...p.services[i], status: decision, rejection_reason: decision === 'rejected' ? reason : null };
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

  /** Backend ArtistService.save_kyc checks 3–5, in order; only the last 4 digits and the keys are kept. */
  private saveKyc(userId: string, p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const number = typeof b.aadhaar_number === 'string' ? b.aadhaar_number.replace(/ /g, '') : '';
    if (!isValidAadhaar(number)) return err('validation_error', 'Invalid Aadhaar number', 422);
    const front = typeof b.front_key === 'string' ? b.front_key : '';
    const back = typeof b.back_key === 'string' ? b.back_key : '';
    if (![front, back].every((key) => this.owns(key, userId, 'aadhaar'))) return err('validation_error', 'Invalid photo key', 422);
    if (front === back) return err('validation_error', 'Front and back must be different photos', 422);
    p.kyc = { last4: number.slice(-4), front_key: front, back_key: back };
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
    if (!p.kyc) missing.push('kyc');
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

  /** Seeded directory artist (spec §5): approved, with services, portfolio and Aadhaar on file. */
  seed(userId: string, a: SeedArtist, reviewedAt: string): MockProfile {
    const photoKey = `artists/${userId}/artist_photo/seed`;
    this.files.set(photoKey, seedAvatarUrl(a.slug));
    const photos = Array.from({ length: PORTFOLIO_SIZE }, (_, n) => {
      const key = `artists/${userId}/portfolio/seed-${n + 1}`;
      this.files.set(key, seedPhotoUrl(a.slug, n + 1));
      return { id: this.id('photo'), key, width: 600, height: 800 };
    });
    const services = a.services.map((s): ServiceItem => {
      const { sub, template } = findTemplateByName(s.category, s.subcategory, s.name);
      return {
        id: this.id('service'), category_id: sub.id, subcategory_id: sub.id, template_id: template.id, name: template.name,
        price_paise: s.rupees * 100, duration_minutes: s.minutes, description: s.description, status: 'approved', rejection_reason: null,
      };
    });
    const p: MockProfile = {
      id: this.id('artist'), status: 'approved', business_name: a.business_name, city: a.city, bio: a.bio, photo_key: photoKey,
      category_ids: CATEGORIES.filter((c) => a.categories.includes(c.name)).map((c) => c.id), services, photos,
      kyc: { last4: '2346', front_key: `artists/${userId}/aadhaar/seed-front`, back_key: `artists/${userId}/aadhaar/seed-back` },
      rejection_reason: null, submitted_at: reviewedAt, reviewed_at: reviewedAt,
    };
    this.profiles.set(userId, p);
    return p;
  }

  // ---- Read side for the public directory and bookings ----

  profileOf(userId: string): MockProfile | undefined {
    return this.profiles.get(userId);
  }

  /** Approved profiles with their owner's user id, newest approval first (then id), like GET /artists. */
  approved(): { userId: string; profile: MockProfile }[] {
    return [...this.profiles.entries()]
      .filter(([, p]) => p.status === 'approved')
      .map(([userId, profile]) => ({ userId, profile }))
      .sort((a, b) => (b.profile.reviewed_at ?? '').localeCompare(a.profile.reviewed_at ?? '') || a.profile.id.localeCompare(b.profile.id));
  }

  /** Any profile by its id, with the owner's user id. */
  byId(profileId: string): { userId: string; profile: MockProfile } | undefined {
    for (const [userId, profile] of this.profiles) if (profile.id === profileId) return { userId, profile };
    return undefined;
  }

  photoUrl(p: MockProfile): string | null {
    return p.photo_key ? this.url(p.photo_key) : null;
  }

  card(p: MockProfile, stats: RatingStats): ArtistCard {
    const prices = p.services.filter((s) => s.status === 'approved').map((s) => s.price_paise);
    return {
      id: p.id, business_name: p.business_name, city: p.city, photo_url: this.photoUrl(p),
      cover_url: p.photos.length ? this.url(p.photos[0].key) : null,
      categories: CATEGORIES.filter((c) => p.category_ids.includes(c.id)).map(({ id, name }) => ({ id, name })),
      from_price_paise: prices.length ? Math.min(...prices) : null,
      ...stats,
    };
  }

  /** The storefront: approved services only; never KYC, phone or the rejection reason. */
  storefront(p: MockProfile, completedBookings: number, stats: RatingStats): ArtistPublic {
    const services = p.services.filter((s) => s.status === 'approved').map((s): PublicService => ({
      id: s.id, name: s.name, description: s.description, price_paise: s.price_paise, duration_minutes: s.duration_minutes,
      ...serviceRefs(s.subcategory_id),
    }));
    return {
      ...this.card(p, stats), bio: p.bio, services,
      photos: p.photos.map((ph) => ({ id: ph.id, url: this.url(ph.key), thumb_url: this.url(ph.key) })),
      member_since: p.reviewed_at, completed_bookings: completedBookings,
    };
  }
}
