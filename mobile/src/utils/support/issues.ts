import type { SupportTopic, TicketStatus } from '../../types/support/support';

/** Which side of the app is asking: the issues and common questions differ. */
export type SupportSide = 'customer' | 'artist';

const ACCOUNT_ISSUES = [
  { value: 'cant_log_in', label: 'Can’t log in' },
  { value: 'change_number', label: 'Change my number' },
  { value: 'other', label: 'Something else' },
];

// The backend's issue codes (app/support/constants.py) with the app's wording. No payment issues in phase 1.
export const ISSUES: Record<SupportSide, Record<SupportTopic, { value: string; label: string }[]>> = {
  customer: {
    booking: [
      { value: 'artist_no_show', label: 'Artist didn’t show up' },
      { value: 'not_as_booked', label: 'Not what I booked' },
      { value: 'other', label: 'Something else' },
    ],
    account: ACCOUNT_ISSUES,
  },
  artist: {
    booking: [
      { value: 'customer_no_show', label: 'Customer didn’t show up' },
      { value: 'other', label: 'Something else' },
    ],
    account: ACCOUNT_ISSUES,
  },
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Open',
  open: 'Open',
  waiting_on_user: 'Replied',
  resolved: 'Resolved',
};

export const FAQ: Record<SupportSide, { question: string; answer: string }[]> = {
  customer: [
    { question: 'How do I pay?', answer: 'You pay the artist directly after the service. Nothing is paid in the app.' },
    { question: 'Can I change my booking time?', answer: 'Cancel the booking and pick a new slot, or report it below and we’ll help you move it.' },
    { question: 'What if the artist doesn’t show up?', answer: 'Report it below. We look into every no-show and follow up with the artist.' },
  ],
  artist: [
    { question: 'How do I get paid?', answer: 'Customers pay you directly after the service. Nothing is paid in the app yet.' },
    { question: 'What if a customer doesn’t show up?', answer: 'Report it below from that booking. We follow up with the customer.' },
    { question: 'How do I change my profile?', answer: 'Me → Edit profile. Your changes are reviewed before clients see them again.' },
  ],
};
