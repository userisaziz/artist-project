import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouteErrorBoundary } from './route-error-boundary'

let shouldThrow = true
function FlakyPage() {
  if (shouldThrow) throw new Error('render exploded')
  return <h1>Bookings</h1>
}

beforeEach(() => {
  shouldThrow = true
  // React reports caught render errors to console.error; keep the run output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it('shows a fallback with Retry when a page throws, and Retry renders it again', async () => {
  const user = userEvent.setup()
  render(<RouteErrorBoundary resetKey="/bookings"><FlakyPage /></RouteErrorBoundary>)
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(/this page couldn’t be shown/i)
  expect(screen.queryByRole('heading', { name: 'Bookings' })).not.toBeInTheDocument()

  shouldThrow = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('clears the fallback when the reset key changes (navigating away)', () => {
  const { rerender } = render(<RouteErrorBoundary resetKey="/bookings"><FlakyPage /></RouteErrorBoundary>)
  expect(screen.getByRole('alert')).toBeInTheDocument()
  shouldThrow = false
  rerender(<RouteErrorBoundary resetKey="/reviews"><FlakyPage /></RouteErrorBoundary>)
  expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
})
