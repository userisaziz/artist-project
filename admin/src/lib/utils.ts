import { createCn } from "cn/config"

import { themeClassNames } from "@/lib/brand"

// The custom steps from src/brand.css: without them cn() reads `text-label-lg` as a colour
// and drops it next to `text-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: themeClassNames.text }],
      rounded: [{ rounded: themeClassNames.radius }],
      tracking: [{ tracking: themeClassNames.tracking }],
    },
  },
})
