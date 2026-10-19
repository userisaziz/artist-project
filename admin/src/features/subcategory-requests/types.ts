/** Mirrors backend app/subcategory_request/schemas.py. */
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface SubcategoryRequest {
  id: string
  name: string
  description: string | null
  parent: { id: number; name: string }
  artist: { id: string; business_name: string }
  services_waiting: number
  status: RequestStatus
  rejection_reason: string | null
  subcategory_id: number | null // the catalog subcategory it became
  created_at: string
  reviewed_at: string | null
}

export interface SubcategoryRequestPage {
  items: SubcategoryRequest[]
  next_cursor: string | null
}

export interface SubcategoryRequestSummary {
  counts: Record<RequestStatus, number>
  approved_30d: number
  admin_defaults: number // active subcategories in the catalog
  oldest_pending_at: string | null
}
