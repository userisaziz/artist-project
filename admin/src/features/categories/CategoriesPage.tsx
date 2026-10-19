import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { toastError } from '@/lib/notify'
import type { AdminCategory, CategoryStatus } from '@/lib/types'
import { CatalogKpis } from './CatalogKpis'
import { CategoryActions } from './CategoryActions'
import { CategoryDialog } from './CategoryDialog'
import { CategoryRow } from './CategoryRow'
import { ServiceTemplatesPane } from './ServiceTemplatesPane'
import { useCategories, useDeleteCategory, useSaveCategory } from './queries'
import { STATUS_LABEL } from './StatusSelect'

const COLUMNS = 'minmax(0,2fr) .7fr .7fr .9fr 96px'
type StatusFilter = CategoryStatus | 'all'
const FILTERS: StatusFilter[] = ['all', 'active', 'draft', 'inactive']

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

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
  const filter = FILTERS.find((f) => f === params.get('status')) ?? 'all'
  const shown = filter === 'all' ? topLevel : topLevel.filter((c) => c.status === filter)
  const chips = FILTERS.map((f) => ({
    value: f,
    label: `${f === 'all' ? 'All' : STATUS_LABEL[f]} ${f === 'all' ? topLevel.length : topLevel.filter((c) => c.status === f).length}`,
  }))

  const updateParams = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })

  const toggle = (id: number) =>
    setExpanded((open) => {
      const next = new Set(open)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const setStatus = (c: AdminCategory, status: CategoryStatus) =>
    save.mutate(
      { id: c.id, input: { status } },
      {
        onSuccess: () => toast.success(`“${c.name}” is now ${STATUS_LABEL[status].toLowerCase()}`),
        onError: (e) => toastError(e, 'Could not update the category'),
      },
    )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.name}” deleted`)
      if (deleting.id === subId) updateParams('sub', null)
    } catch (e) {
      toastError(e, 'Could not delete the category')
    }
    setDeleting(null)
  }

  const actions = (c: AdminCategory) => (
    <CategoryActions
      category={c}
      onEdit={() => setDialog({ category: c, parent: byId(c.parent_id) })}
      onAddSubcategory={c.parent_id === null ? () => { setExpanded((open) => new Set(open).add(c.id)); setDialog({ category: null, parent: c }) } : undefined}
      onStatus={(s) => setStatus(c, s)}
      onDelete={() => setDeleting(c)}
    />
  )

  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Service categories, their subcategories, and the services artists pick from."
        action={<Button size="page" onClick={() => setDialog({ category: null, parent: null })}><Plus /> New category</Button>}
      />

      <CatalogKpis categories={categories.data} />

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel aria-label="Categories" className="flex flex-col">
          <PanelToolbar>
            <FilterChips chips={chips} value={filter} onChange={(next) => updateParams('status', next === 'all' ? null : next)} />
          </PanelToolbar>
          <GridHeader columns={COLUMNS} labels={['Category', 'Artists', 'Listings', 'Status', '']} />
          {categories.isPending && <GridMessage state="loading" />}
          {categories.isError && <GridMessage state="error">Couldn’t load categories. {categories.error.message}</GridMessage>}
          {categories.isSuccess && all.length === 0 && (
            <GridMessage state="empty">
              <p className="font-medium text-foreground">No categories yet</p>
              <p className="mt-1">Create the first one — artists need at least one to finish onboarding.</p>
            </GridMessage>
          )}
          {categories.isSuccess && all.length > 0 && shown.length === 0 && (
            <GridMessage state="empty">No {STATUS_LABEL[filter as CategoryStatus].toLowerCase()} categories.</GridMessage>
          )}
          {shown.map((c) => {
            const subs = childrenOf(c.id)
            const open = expanded.has(c.id)
            return (
              <Fragment key={c.id}>
                <CategoryRow
                  category={c}
                  columns={COLUMNS}
                  meta={subs.length ? subs.map((s) => s.name).join(', ') : 'No subcategories yet'}
                  expanded={open}
                  onOpen={() => toggle(c.id)}
                  actions={actions(c)}
                />
                {open && subs.map((s) => (
                  <CategoryRow
                    key={s.id}
                    category={s}
                    columns={COLUMNS}
                    meta={plural(s.template_count, 'catalogue service')}
                    selected={s.id === selected?.id}
                    onOpen={() => updateParams('sub', String(s.id))}
                    actions={actions(s)}
                  />
                ))}
                {open && (
                  <div className="border-b border-line-soft py-1.5 pl-14">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ category: null, parent: c })}>
                      <Plus /> Subcategory
                    </Button>
                  </div>
                )}
              </Fragment>
            )
          })}
          {categories.isSuccess && all.length > 0 && (
            <PanelFooter>Open a category to see its subcategories; pick one to manage its services.</PanelFooter>
          )}
        </Panel>

        {selected ? (
          <ServiceTemplatesPane category={byId(selected.parent_id)} subcategory={selected} />
        ) : (
          <Panel aria-label="Services" className="px-6 py-16 text-center text-sm text-muted-foreground">
            Pick a subcategory to manage its services.
          </Panel>
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
