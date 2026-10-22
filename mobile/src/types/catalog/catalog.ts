/** A top-level category, flat: what an artist's own `categories` lists (backend CategoryOut). */
export interface Category {
  id: number;
  slug: string;
  name: string;
}

/** One service on the admin's list; artists pick it and set their own price and duration. */
export interface ServiceTemplate {
  id: number;
  name: string;
  description: string | null;
}

/** Slug is `parent-child`, e.g. `makeup-bridal`. */
export interface Subcategory {
  id: number;
  slug: string;
  name: string;
  services: ServiceTemplate[];
}

/** GET /categories: the public tree, active items only (backend CatalogCategoryOut). */
export interface CatalogCategory extends Category {
  subcategories: Subcategory[];
}

/** A priced extra on an artist's service ("Guest mehendi +₹500 / person"); backend AddonOut. */
export interface ServiceAddon {
  id: string;
  name: string;
  price_paise: number;
  per_person: boolean;
}

/** What an artist sends for an add-on; the server gives it an id. */
export type ServiceAddonInput = Omit<ServiceAddon, 'id'>;

/** A service's optional extras. On an edit, a list that is sent replaces the old one; an omitted one stays. */
export interface ServiceExtrasInput {
  included_items?: string[];
  addons?: ServiceAddonInput[];
}

/** GET /areas: a neighbourhood of an operating city ("BTM Layout", Bangalore) with its rough centre. */
export interface Area {
  id: number;
  city: string;
  name: string;
  latitude: number;
  longitude: number;
}
