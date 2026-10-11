import { request } from '../client';
import type { Category } from '../types';

// Public catalog (backend api/v1/catalog.py): no auth.
export function listCategories() {
  return request<Category[]>('/categories', undefined, { method: 'GET' });
}
export function listCities() {
  return request<string[]>('/cities', undefined, { method: 'GET' });
}
