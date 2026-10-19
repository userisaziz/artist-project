import type { ReactNode } from 'react'

/** The pink italic word in a design title, e.g. Verification <Accent>queue</Accent>. */
export function Accent({ children }: { children: ReactNode }) {
  return <i className="text-primary">{children}</i>
}
