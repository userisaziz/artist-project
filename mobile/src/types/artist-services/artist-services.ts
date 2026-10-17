/** POST /artists/me/custom-services: the approved artist's own service, which waits for admin review. */
export interface CustomServiceInput {
  subcategory_id: number;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description?: string | null;
}

/** PATCH /artists/me/custom-services/{id}: any field; any edit sends the service back to review. */
export type CustomServicePatch = Partial<CustomServiceInput>;
