/** A subcategory the artist suggests while adding a service; only they see it until an admin approves it. */
export interface SuggestedSubcategoryInput {
  parent_id: number;
  name: string;
  description?: string | null;
}

/**
 * POST /artists/me/custom-services: the approved artist's own service, which waits for admin review.
 * Exactly one of `subcategory_id` and `suggested_subcategory` (adding only; editing picks an existing one).
 */
export interface CustomServiceInput {
  subcategory_id?: number;
  suggested_subcategory?: SuggestedSubcategoryInput;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description?: string | null;
}

/** PATCH /artists/me/custom-services/{id}: any field; any edit sends the service back to review. */
export type CustomServicePatch = Partial<CustomServiceInput>;
