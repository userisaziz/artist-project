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

/** appointment: booked into a time slot. made_to_order: made and handed over later, so customers ask for a quote. */
export type Fulfilment = 'appointment' | 'made_to_order';
/** listing: the artist states it when offering a service. booking: the customer answers it when booking. */
export type FieldScope = 'listing' | 'booking';
export type FieldType = 'text' | 'long_text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'date';

/** An admin-defined service field (backend app/catalog/fields.py FieldDef). Answers are stored by `key`. */
export interface FieldDef {
  key: string;
  label: string;
  scope: FieldScope;
  type: FieldType;
  required: boolean;
  options: string[];
  min: number | null;
  max: number | null;
  unit: string | null;
  help: string | null;
}

export type FieldValue = string | number | boolean | string[];

/** package: the price is the whole service. per_unit: the price is per `QuantityUnit`, times the quantity. */
export type PricingUnit = 'package' | 'per_unit';
/** What a per-unit service is counted in: "₹300 per piece", "min 25 boxes". */
export type QuantityUnit = 'person' | 'piece' | 'box' | 'card' | 'hour' | 'set';

/** An answered field as shown and stored: the label as it read when answered. */
export interface FieldAnswer {
  key: string;
  label: string;
  value: FieldValue;
  unit: string | null;
}

/** Slug is `parent-child`, e.g. `makeup-bridal`. */
export interface Subcategory {
  id: number;
  slug: string;
  name: string;
  services: ServiceTemplate[];
  /** Effective: its own, else its parent's. */
  fulfilment: Fulfilment;
  /** Effective: what per-unit services here are counted in by default. */
  default_unit: QuantityUnit | null;
  /** Effective: the parent's fields first, then its own. */
  fields: FieldDef[];
}

/** GET /categories: the public tree, active items only (backend CatalogCategoryOut). */
export interface CatalogCategory extends Category {
  subcategories: Subcategory[];
  fulfilment: Fulfilment;
  default_unit: QuantityUnit | null;
  fields: FieldDef[];
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

/** A service's optional extras. On an edit, a list that is sent replaces the old one; an omitted one stays.
 *  `photo_key` likewise: a "service" upload's key replaces the photo, null removes it, omitted keeps it. */
export interface ServiceExtrasInput {
  included_items?: string[];
  addons?: ServiceAddonInput[];
  photo_key?: string | null;
}

/** GET /areas: a neighbourhood of an operating city ("BTM Layout", Bangalore) with its rough centre. */
export interface Area {
  id: number;
  city: string;
  name: string;
  latitude: number;
  longitude: number;
}
