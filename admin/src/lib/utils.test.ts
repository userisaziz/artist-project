import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cn } from '@/lib/utils'

it('keeps a brand text size next to a text colour', () => {
  expect(cn('text-label-sm text-success')).toBe('text-label-sm text-success')
  expect(cn('w-full text-label-lg', 'text-muted-foreground')).toBe('w-full text-label-lg text-muted-foreground')
})

it('still lets a later size win over an earlier one', () => {
  expect(cn('text-xs text-label-sm')).toBe('text-label-sm')
  expect(cn('rounded-control rounded-lg')).toBe('rounded-lg')
})

it('has every shared UI component use the configured cn, not the bare package', () => {
  const dir = join(__dirname, '../components/ui')
  const bare = readdirSync(dir).filter((f) => /from ["']cn["']/.test(readFileSync(join(dir, f), 'utf8')))
  expect(bare).toEqual([])
})
