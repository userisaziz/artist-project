# Atelier Admin - building with this library

Components for the Atelier admin console (shadcn/ui on Base UI, Tailwind v4, Plus Jakarta Sans). All exports live on `window.AtelierAdmin`.

## Setup
- No provider or theme wrapper is needed. Components style themselves from `styles.css`, which carries the tokens, the font and the component CSS.
- The page background and text colour come from `body { background: var(--background); color: var(--foreground) }`, so build on the body directly; don't paint your own page background.
- Toasts: render `<Toaster />` once at the root of the page, then call `toast.success("...")` / `toast.error("...")` from handlers.
- Overlays (`Dialog`, `AlertDialog`, `DropdownMenu`) render into a portal, so they are composed from parts:
  `Dialog > DialogTrigger + DialogContent > DialogHeader (DialogTitle, DialogDescription) + body + DialogFooter (DialogClose)`.

## Styling idiom
Style with the components' own props first: `Button variant` = default | outline | secondary | ghost | destructive | link, and `size` = default | xs | sm | lg | page | icon. `Badge variant` adds the status tones success | warning | brand | danger | neutral.

For your own layout glue, Tailwind utility classes work **only if the app already uses them**, because the stylesheet is compiled, not the full Tailwind set. These are verified present:
- Layout: `flex`, `flex-col`, `grid`, `items-center`, `justify-between`, `gap-1`, `gap-2`, `gap-3`, `gap-4`, `w-full`, `min-w-0`, `max-w-md`, `truncate`
- Spacing: `p-4`, `p-6`, `px-4`, `py-2`, `mt-1`
- Type: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `font-medium`, `font-semibold`, `font-bold`
- Colour: `bg-background`, `bg-card`, `bg-primary`, `bg-blush`, `text-primary`, `text-muted-foreground`, `text-subtle-foreground`, `border-border`, `border-line`
- Shape: `rounded-xl`, `rounded-2xl`

For anything else, use inline `style` with the design tokens rather than inventing classes: `var(--primary)`, `--primary-foreground`, `--background`, `--foreground`, `--card`, `--blush`, `--accent`, `--muted-foreground`, `--subtle-foreground`, `--border`, `--line`, `--line-soft`, `--success` / `--success-soft`, `--warning` / `--warning-soft`, `--destructive` / `--danger-soft`, and `--radius`. Never hard-code hex colours.

## Where the truth lives
- `styles.css` and its imports (`_ds_bundle.css`, `fonts/fonts.css`) hold every token and compiled class. Grep them before using a class that isn't listed above.
- Each component's `components/ui/<Name>/<Name>.prompt.md` and `<Name>.d.ts` give its parts and props.

## Example
```jsx
const { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, Button, Badge, Field, FieldLabel, Input } = window.AtelierAdmin;

<Card>
  <CardHeader>
    <CardTitle>Pending approvals</CardTitle>
    <CardDescription>Artists waiting for KYC review</CardDescription>
    <CardAction><Button variant="outline" size="sm">View all</Button></CardAction>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Priya Sharma</span>
      <Badge variant="warning">Pending KYC</Badge>
    </div>
    <Field>
      <FieldLabel htmlFor="note">Note</FieldLabel>
      <Input id="note" placeholder="Reason for rejection" />
    </Field>
  </CardContent>
</Card>
```
