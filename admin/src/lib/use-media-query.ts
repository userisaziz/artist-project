import { useSyncExternalStore } from 'react'

/** Tailwind's `md` breakpoint: tablets and up. */
export const MD_UP = '(min-width: 48rem)'

/**
 * Whether `query` matches now, re-rendering when it flips. Use it only where a control must exist once
 * (hiding with CSS would leave a second copy in the page); without matchMedia it assumes it matches.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? true,
  )
}
