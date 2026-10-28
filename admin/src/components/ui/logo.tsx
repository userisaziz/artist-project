import { cva, type VariantProps } from "class-variance-authority"

import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

const logoVariants = cva("font-semibold tracking-heading", {
  variants: {
    size: { md: "text-logo-md", lg: "text-logo-lg" },
    tone: { default: "", inverse: "text-white" },
  },
  defaultVariants: { size: "md", tone: "default" },
})

type LogoProps = VariantProps<typeof logoVariants> & {
  /** Italic tag after the name, e.g. "admin" in the sidebar. */
  suffix?: string
  className?: string
}

/** The brand wordmark: text in the heading face until logo files land in brand/logos/. */
export function Logo({ size, tone, suffix, className }: LogoProps) {
  return (
    <div className={cn(logoVariants({ size, tone }), className)}>
      {brand.wordmark}
      {suffix ? (
        <>
          {" "}
          <i className="text-primary">{suffix}</i>
        </>
      ) : null}
    </div>
  )
}
