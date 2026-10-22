import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { AdminCategory, CategoryStatus } from '@/lib/types'

const inUse = (c: AdminCategory) => c.artist_count + c.service_count + c.child_count + c.template_count > 0

const STATUS_ACTIONS: { status: CategoryStatus; label: string }[] = [
  { status: 'active', label: 'Publish' },
  { status: 'draft', label: 'Move to draft' },
  { status: 'inactive', label: 'Archive' },
]

interface CategoryActionsProps {
  category: AdminCategory
  onEdit: () => void
  /** Only top-level categories take subcategories. */
  onAddSubcategory?: () => void
  /** Only subcategories hold services. */
  onServices?: () => void
  onStatus: (status: CategoryStatus) => void
  onDelete: () => void
}

/** The row's "Edit" link and its ⋯ menu, as on the design's admin tables. */
export function CategoryActions({ category: c, onEdit, onAddSubcategory, onServices, onStatus, onDelete }: CategoryActionsProps) {
  const locked = inUse(c)
  return (
    <div className="flex items-center justify-end gap-1.5">
      {onServices && <Button variant="link" size="xs" className="font-bold" aria-label={`Services for ${c.name}`} onClick={onServices}>Services</Button>}
      <Button variant="link" size="xs" className="font-bold" aria-label={`Edit ${c.name}`} onClick={onEdit}>Edit</Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${c.name}`} />}>
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {onAddSubcategory && <DropdownMenuItem onClick={onAddSubcategory}>Add subcategory</DropdownMenuItem>}
          {STATUS_ACTIONS.filter((a) => a.status !== c.status).map((a) => (
            <DropdownMenuItem key={a.status} onClick={() => onStatus(a.status)}>{a.label}</DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={locked}
            title={locked ? 'In use — archive it instead' : undefined}
            onClick={onDelete}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
