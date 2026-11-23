import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GridMessage } from './grid-message'
import { KpiTile } from './kpi-tile'

it('offers Retry on an error and re-runs the query when clicked', async () => {
  const onRetry = vi.fn()
  render(<GridMessage state="error" onRetry={onRetry}>Couldn’t load bookings.</GridMessage>)

  expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load bookings.')
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(onRetry).toHaveBeenCalledOnce()
})

it('shows no Retry when the caller has nothing to retry', () => {
  render(<GridMessage state="error">Couldn’t load bookings.</GridMessage>)
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
})

it('says a KPI couldn’t load instead of shimmering forever', () => {
  render(<KpiTile label="Bookings" value={undefined} note="Last 30 days" error />)
  const tile = screen.getByRole('group', { name: 'Bookings' })
  expect(tile).toHaveTextContent('—')
  expect(tile).toHaveTextContent('Couldn’t load')
  expect(tile).not.toHaveTextContent('Last 30 days')
  expect(tile.querySelector('[data-slot="skeleton"]')).toBeNull()
})
