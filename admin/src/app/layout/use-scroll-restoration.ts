import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** Scroll offsets per history entry, so Back/Forward land where the admin left off. */
const offsets = new Map<string, number>()

/**
 * Scroll handling for the shell's scrolling <main> (BrowserRouter has no ScrollRestoration):
 * a new page opens at the top, Back/Forward restore the old offset, and a search-param change
 * (filters, paging) keeps the position. Returns whether the area is scrolled, for the top bar's shadow.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>): boolean {
  const { key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const keyRef = useRef(key)
  const pathRef = useRef(pathname)
  const [scrolled, setScrolled] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    keyRef.current = key
    if (navigationType === 'POP') el.scrollTop = offsets.get(key) ?? 0
    else if (pathRef.current !== pathname) el.scrollTop = 0
    pathRef.current = pathname
    setScrolled(el.scrollTop > 0)
  }, [ref, key, pathname, navigationType])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      offsets.set(keyRef.current, el.scrollTop)
      setScrolled(el.scrollTop > 0) // same value: React skips the render
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])

  return scrolled
}
