const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const rupees = (paise: number) => inr.format(paise / 100)

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ')
}

export const dateTime = (iso: string | null) => (iso ? when.format(new Date(iso)) : '—')
