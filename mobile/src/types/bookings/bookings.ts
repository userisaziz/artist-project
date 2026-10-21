import type { BookingReview } from '../reviews/reviews';

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'completed';

export type CancelledBy = 'customer' | 'artist' | 'admin';

export interface BookingInput {
  artist_id: string;
  service_id: string;
  start_at: string;
  address: string;
  note?: string | null;
}

/** BookingOut: money is integer paise, copied onto the booking when it is created. */
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  address: string;
  note: string | null;
  service_name: string;
  duration_minutes: number;
  artist: { id: string; business_name: string; photo_url: string | null; city: string };
  customer: { id: string; first_name: string | null; last_name: string | null };
  subtotal_paise: number;
  platform_fee_paise: number;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  /** Artist and admin responses only: customer-facing responses carry null. */
  commission_paise: number | null;
  artist_earning_paise: number | null;
  deposit_paid_at: string | null;
  /** min(created + 3h, start_at): a request close to its start must be answered before it begins. */
  expires_at: string;
  responded_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  cancelled_by: CancelledBy | null;
  refund_due: boolean | null;
  created_at: string;
  /** Increment 6: the review of this booking. Customers see their own in any state; artists only a public one. */
  review: BookingReview | null;
  /** Completed, not reviewed yet and within 30 days of completion. */
  can_review: boolean;
}

export type CustomerBookingScope = 'upcoming' | 'past';

export type ArtistBookingScope = 'requests' | 'upcoming' | 'past';

/** GET /artists/me/dashboard */
export interface ArtistDashboard {
  requests: number;
  upcoming: number;
  completed_this_month: number;
  earnings_this_month_paise: number;
  today: Booking[];
}

/** GET /artists/me/earnings: one IST month. */
export interface MonthEarnings {
  month: string; // 'YYYY-MM'
  bookings: number;
  earnings_paise: number;
}
