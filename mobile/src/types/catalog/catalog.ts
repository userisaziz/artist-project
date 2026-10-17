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
