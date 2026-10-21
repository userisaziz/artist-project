/** GET /users/me/addresses item (backend app/user). */
export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AddressInput { label: string; address: string }
