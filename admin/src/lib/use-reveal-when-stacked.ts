import { useEffect, useRef } from 'react'

/** Below this width a list's side pane stacks under the list instead of sitting beside it (Tailwind's `xl`). */
const STACKED_QUERY = '(max-width: 1279.98px)'

/**
 * Ref for a side pane that stacks under its list on smaller screens: whenever `key` changes to a value,
 * the pane scrolls into view, so tapping a row visibly opens it instead of opening it out of sight.
 */
export function useRevealWhenStacked<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (key == null || !window.matchMedia?.(STACKED_QUERY).matches) return
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [key])
  return ref
}
