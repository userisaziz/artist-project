import { createCn } from "cn/config"

// The custom steps from the @theme block in index.css: without them cn() reads `text-label-lg` as a colour
// and drops it next to `text-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["eyebrow", "label-sm", "label-md", "label-lg"] }],
      rounded: [{ rounded: ["item", "control", "menu"] }],
      tracking: [{ tracking: ["caps"] }],
    },
  },
})
