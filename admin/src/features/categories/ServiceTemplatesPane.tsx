import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { Panel } from '@/components/console/panel'
import { toastError } from '@/lib/notify'
import type { AdminCategory, ServiceTemplate } from '@/lib/types'
import { ServiceTemplateDialog } from './ServiceTemplateDialog'
import { useDeleteServiceTemplate, useSaveServiceTemplate, useServiceTemplates } from './queries'

const COLUMNS = '40px minmax(0,1fr) 64px 56px 72px'

/** Right pane of the Catalog: the service list artists pick from under one subcategory. */
export function ServiceTemplatesPane({ category, subcategory }: { category: AdminCategory | null; subcategory: AdminCategory }) {
  const templates = useServiceTemplates(subcategory.id)
  const save = useSaveServiceTemplate()
  const remove = useDeleteServiceTemplate()
  // null = closed; { template: null } = creating.
  const [dialog, setDialog] = useState<{ template: ServiceTemplate | null } | null>(null)
  const [deleting, setDeleting] = useState<ServiceTemplate | null>(null)

  const setActive = (t: ServiceTemplate, is_active: boolean) =>
    save.mutate(
      { id: t.id, input: { is_active } },
      { onError: (e) => toastError(e, 'Could not update the service') },
    )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.name}” deleted`)
    } catch (e) {
      toastError(e, 'Could not delete the service')
    }
    setDeleting(null)
  }

  return (
    <Panel aria-label="Services" className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="font-bold">{category ? `${category.name} › ` : ''}{subcategory.name}</h2>
        <Button size="sm" onClick={() => setDialog({ template: null })}><Plus /> New service</Button>
      </div>
      <GridHeader columns={COLUMNS} labels={['#', 'Service', 'Artists', 'Active', '']} />
      {templates.isPending && <GridMessage state="loading" />}
      {templates.isError && <GridMessage state="error">Couldn’t load services. {templates.error.message}</GridMessage>}
      {templates.data?.length === 0 && (
        <GridMessage state="empty">
          <p className="font-medium text-foreground">No services in {subcategory.name} yet</p>
          <p className="mt-1">Artists pick from this list when they set their prices, so they can’t offer {subcategory.name} until it has one.</p>
          <Button size="sm" className="mt-3" onClick={() => setDialog({ template: null })}><Plus /> Add first service</Button>
        </GridMessage>
      )}
      {templates.data?.map((t) => (
        <GridRow key={t.id} columns={COLUMNS}>
          <span className="text-muted-foreground tabular-nums">{t.sort_order}</span>
          <div className="min-w-0">
            <div className="truncate font-bold">{t.name}</div>
            {t.description && <div className="text-[11.5px] text-muted-foreground">{t.description}</div>}
          </div>
          <span className="tabular-nums">{t.artist_count}</span>
          <Switch checked={t.is_active} onCheckedChange={(v) => setActive(t, v)} aria-label={`${t.name} active`} />
          <div className="flex justify-end">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setDialog({ template: t })}><Pencil /></Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${t.name}`}
              disabled={t.artist_count > 0}
              title={t.artist_count > 0 ? 'Artists offer it — deactivate it instead' : undefined}
              onClick={() => setDeleting(t)}
            >
              <Trash2 />
            </Button>
          </div>
        </GridRow>
      ))}

      <ServiceTemplateDialog open={dialog !== null} subcategory={subcategory} template={dialog?.template ?? null} onClose={() => setDialog(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>No artist offers it yet, so it can be removed for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { void confirmDelete() }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}
