import { render, screen } from '@testing-library/react'
import { CellLabel } from './cell-label'
import { GridHeader } from './grid-header'
import { GridRow } from './grid-row'

const COLUMNS = '2fr 1fr'

it('names a bare value for the phone card while keeping the value itself', () => {
  render(
    <GridRow columns={COLUMNS}>
      <span>Ayesha</span>
      <span><CellLabel>Bookings</CellLabel>12</span>
    </GridRow>,
  )
  expect(screen.getByText('Bookings')).toHaveClass('md:hidden')
  expect(screen.getByText('12', { exact: false })).toBeInTheDocument()
})

it('lays rows out as cards on phones and as the shared grid from tablet width up', () => {
  const { container } = render(
    <>
      <GridHeader columns={COLUMNS} labels={['Name', 'Bookings']} />
      <GridRow columns={COLUMNS}><span>Ayesha</span><span>12</span></GridRow>
    </>,
  )
  const [header, row] = Array.from(container.children)
  expect(header).toHaveClass('hidden', 'md:grid')
  expect(row).toHaveClass('flex', 'flex-wrap', 'md:grid')
  expect(row).toHaveStyle({ gridTemplateColumns: COLUMNS })
})
