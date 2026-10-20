import { useQuery } from '@tanstack/react-query';
import * as catalogApi from '../../api/catalog/catalog';

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 });
}

export function useCities() {
  return useQuery({ queryKey: ['catalog', 'cities'], queryFn: catalogApi.listCities, staleTime: Infinity });
}
