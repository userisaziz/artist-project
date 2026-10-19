// Mirrors backend app/platform/schemas.py. Phase 1: no fee or payout settings.
export type SettingsTab = 'policies' | 'cities' | 'team'

export interface Policy {
  key: string
  label: string
  value: string
  scope: string
  editable: boolean
}

export interface City {
  name: string
  artists: number
  bookings_30d: number
}

export interface TeamMember {
  id: string
  name: string
  phone: string
  email: string | null
  admin_since: string
  is_me: boolean
}
