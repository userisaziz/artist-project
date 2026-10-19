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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toastError } from '@/lib/notify'
import type { AdminCategory, ServiceTemplate } from '@/lib/types'
import { ServiceTemplateDialog } from './ServiceTemplateDialog'
import { useDeleteServiceTemplate, useSaveServiceTemplate, useServiceTemplates } from './queries'

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
    <section aria-label="Services" className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <h2 className="font-semibold">{category ? `${category.name} › ` : ''}{subcategory.name}</h2>
        <Button size="sm" onClick={() => setDialog({ template: null })}><Plus /> New service</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 pl-4">Order</TableHead>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Artists</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.isPending &&
            Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5} className="pl-4"><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ))}
          {templates.isError && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-destructive">Couldn’t load services. {templates.error.message}</TableCell>
            </TableRow>
          )}
          {templates.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center">
                <p className="font-medium">No services yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Artists in {subcategory.name} can’t add a service until this list has one.</p>
              </TableCell>
            </TableRow>
          )}
          {templates.data?.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="pl-4 text-muted-foreground tabular-nums">{t.sort_order}</TableCell>
              <TableCell>
                <p className="font-medium">{t.name}</p>
                {t.description && <p className="text-sm whitespace-normal text-muted-foreground">{t.description}</p>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{t.artist_count}</TableCell>
              <TableCell>
                <Switch checked={t.is_active} onCheckedChange={(v) => setActive(t, v)} aria-label={`${t.name} active`} />
              </TableCell>
              <TableCell className="pr-4 text-right whitespace-nowrap">
                <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => setDialog({ template: t })}><Pencil /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${t.name}`}
                  disabled={t.artist_count > 0}
                  title={t.artist_count > 0 ? 'Artists offer it — deactivate it instead' : undefined}
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
    </section>
  )
}
