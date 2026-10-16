const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const rupees = (paise: number) => inr.format(paise / 100)

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ')
}

export const dateTime = (iso: string | null) => (iso ? when.format(new Date(iso)) : '—')

const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })
const LAKH_PAISE = 100_000 * 100

/** Full rupees below a lakh ("₹84,500"), then en-IN compact: "₹42.6L", "₹3.2Cr". */
export const rupeesShort = (paise: number) => (paise < LAKH_PAISE ? rupees(paise) : inrCompact.format(paise / 100))

const ist = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})
const istTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })

/** Bookings are scheduled in India, so they always read in IST whatever the admin's browser zone: "Tue, 20 Oct, 11:00 am". */
export const istDateTime = (iso: string | null | undefined) => (iso ? ist.format(new Date(iso)) : '—')
export const istTimeOnly = (iso: string) => istTime.format(new Date(iso))

const dayMonth = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** A YYYY-MM-DD calendar date (no time, so read as UTC to keep the day): "12 Oct". */
export const shortDate = (date: string) => dayMonth.format(new Date(date))
