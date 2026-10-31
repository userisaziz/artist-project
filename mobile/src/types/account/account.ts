export interface AccountDetails {
  first_name: string;
  last_name: string | null;
  /** ISO date (YYYY-MM-DD). Required: the backend answers 422 without it, and rejects anyone under 18. */
  date_of_birth: string;
  email: string | null;
  whatsapp_booking_updates: boolean;
}
