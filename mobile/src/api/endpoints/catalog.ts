import { request } from '../client';
import type { CatalogCategory } from '../types';

// Public catalog (backend api/v1/catalog.py): no auth.
export function listCategories() {
  return request<CatalogCategory[]>('/categories', undefined, { method: 'GET' });
}
export function listCities() {
  return request<string[]>('/cities', undefined, { method: 'GET' });
}
