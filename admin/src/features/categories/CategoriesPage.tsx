import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminCategory, CategoryStatus } from '@/lib/types'
import { CategoryDialog } from './CategoryDialog'
import { ServiceTemplatesPane } from './ServiceTemplatesPane'
import { useCategories, useDeleteCategory, useSaveCategory } from './queries'
import { STATUS_LABEL, StatusSelect } from './StatusSelect'

const inUse = (c: AdminCategory) => c.artist_count + c.service_count + c.child_count + c.template_count > 0

/** Two panes: categories with their subcategories on the left, the selected subcategory's services (`?sub=`) on the right. */
export function CategoriesPage() {
  const categories = useCategories()
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const [params, setParams] = useSearchParams()
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  // The dialog edits `category`, or creates one (under `parent` when that's set).
  const [dialog, setDialog] = useState<{ category: AdminCategory | null; parent: AdminCategory | null } | null>(null)
  const [deleting, setDeleting] = useState<AdminCategory | null>(null)

  const all = categories.data ?? []
  const topLevel = all.filter((c) => c.parent_id === null)
  const childrenOf = (id: number) => all.filter((c) => c.parent_id === id)
  const byId = (id: number | null) => all.find((c) => c.id === id) ?? null
  const subId = Number(params.get('sub')) || null
  const selected = byId(subId)?.parent_id != null ? byId(subId) : null

  const toggle = (id: number) =>
    setExpanded((open) => {
      const next = new Set(open)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const select = (sub: AdminCategory) => setParams({ sub: String(sub.id) })

  const setStatus = (c: AdminCategory, status: CategoryStatus) =>
    save.mutate(
      { id: c.id, input: { status } },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update the category') },
    )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.name}” deleted`)
      if (deleting.id === subId) setParams({})
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete the category')
    }
    setDeleting(null)
  }

  const row = (c: AdminCategory, sub: boolean) => (
    <TableRow key={c.id} data-state={sub && c.id === selected?.id ? 'selected' : undefined}>
      <TableCell className={cn('font-medium', sub ? 'pl-11' : 'pl-2')}>
        <div className="flex items-center gap-1">
          {sub ? (
            <button type="button" className="text-left hover:underline" aria-pressed={c.id === selected?.id} onClick={() => select(c)}>{c.name}</button>
          ) : (
            <button type="button" className="flex items-center gap-1 text-left" aria-expanded={expanded.has(c.id)} onClick={() => toggle(c.id)}>
              {expanded.has(c.id) ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
              {c.name}
            </button>
          )}
          {c.status !== 'active' && <Badge variant="outline" className="ml-2">{STATUS_LABEL[c.status]}</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{sub ? c.template_count : c.artist_count}</TableCell>
      <TableCell>
        <StatusSelect value={c.status} onChange={(s) => setStatus(c, s)} label={`${c.name} status`} />
      </TableCell>
      <TableCell className="pr-4 text-right whitespace-nowrap">
        <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setDialog({ category: c, parent: byId(c.parent_id) })}><Pencil /></Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${c.name}`}
          disabled={inUse(c)}
          title={inUse(c) ? 'In use — deactivate it instead' : undefined}
          onClick={() => setDeleting(c)}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )

  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Categories, their subcategories, and the services artists pick from during onboarding."
        action={<Button onClick={() => setDialog({ category: null, parent: null })}><Plus /> New category</Button>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Categories" className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Categories</TableHead>
                <TableHead className="text-right" title="Artists for a category, services for a subcategory">In use</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.isPending &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="pl-4"><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))}
              {categories.isError && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-destructive">Couldn’t load categories. {categories.error.message}</TableCell>
                </TableRow>
              )}
              {categories.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <p className="font-medium">No categories yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create the first one — artists need at least one to finish onboarding.</p>
                  </TableCell>
                </TableRow>
              )}
              {topLevel.map((c) => (
                <Fragment key={c.id}>
                  {row(c, false)}
                  {expanded.has(c.id) && (
                    <>
                      {childrenOf(c.id).map((s) => row(s, true))}
                      <TableRow>
                        <TableCell colSpan={4} className="pl-10">
                          <Button variant="ghost" size="sm" onClick={() => setDialog({ category: null, parent: c })}>
                            <Plus /> Subcategory
                          </Button>
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </section>

        {selected ? (
          <ServiceTemplatesPane category={byId(selected.parent_id)} subcategory={selected} />
        ) : (
          <section aria-label="Services" className="rounded-xl border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            Pick a subcategory to manage its services.
          </section>
        )}
      </div>

      <CategoryDialog open={dialog !== null} category={dialog?.category ?? null} parent={dialog?.parent ?? null} onClose={() => setDialog(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Nothing uses it yet, so it can be removed for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { void confirmDelete() }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
