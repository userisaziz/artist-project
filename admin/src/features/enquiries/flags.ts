/** What the contact filter caught (backend app/review/filters.py review_flag). */
export const FLAG_LABEL: Record<string, string> = {
  contact_info: 'Contact details shared',
  blocked_word: 'Blocked word',
}

export const flagLabel = (flag: string | null) => (flag ? FLAG_LABEL[flag] ?? flag : '—')
