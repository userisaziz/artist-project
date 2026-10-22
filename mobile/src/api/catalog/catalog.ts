import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Area, CatalogCategory } from '../../types/catalog/catalog';

// Public catalog (backend api/v1/catalog.py): no auth.
export function listCategories() {
  return request<CatalogCategory[]>('/categories', undefined, { method: 'GET' });
}
export function listCities() {
  return request<string[]>('/cities', undefined, { method: 'GET' });
}
/** A city's areas, by name. */
export function listAreas(city: string) {
  return request<Area[]>(withQuery('/areas', { city }), undefined, { method: 'GET' });
}
/** The area a map pin is in; null outside every known area. */
export function nearestArea(lat: number, lng: number) {
  return request<Area | null>(withQuery('/areas/nearest', { lat, lng }), undefined, { method: 'GET' });
}
