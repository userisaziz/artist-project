// Mirrors backend app/platform/schemas.py and app/requirement/schemas.py. Phase 1: no fee or payout settings.
export type SettingsTab = 'policies' | 'requirements' | 'cities' | 'team'

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

/** A profile requirement artists can be asked to meet after approval (GET /admin/settings/requirements). */
export interface ProfileRequirement {
  key: string
  title: string
  body: string
  mandatory: boolean
  grace_days: number
  /** When it became mandatory; null while optional. */
  effective_from: string | null
}

export interface RequirementInput {
  mandatory: boolean
  grace_days: number
}
