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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { ApiError } from '@/lib/api'
import type { AdminCategory } from '@/lib/types'
import { CategoryDialog } from './CategoryDialog'
import { useCategories, useDeleteCategory, useSaveCategory } from './queries'

export function CategoriesPage() {
  const categories = useCategories()
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState<AdminCategory | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AdminCategory | null>(null)

  const toggle = (c: AdminCategory, is_active: boolean) =>
    save.mutate(
      { id: c.id, input: { is_active } },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update the category') },
    )

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`“${deleting.name}” deleted`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete the category')
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Service categories artists pick from during onboarding."
        action={<Button onClick={() => setCreating(true)}><Plus /> New category</Button>}
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-4">Order</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Artists</TableHead>
              <TableHead className="text-right">Services</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7} className="pl-4"><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))}
            {categories.isError && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-destructive">Couldn’t load categories. {categories.error.message}</TableCell>
              </TableRow>
            )}
            {categories.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="font-medium">No categories yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create the first one — artists need at least one to finish onboarding.</p>
                </TableCell>
              </TableRow>
            )}
            {categories.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums">{c.sort_order}</TableCell>
                <TableCell className="font-medium">
                  {c.name}
                  {!c.is_active && <Badge variant="outline" className="ml-2">Hidden</Badge>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell>
                <TableCell className="text-right tabular-nums">{c.artist_count}</TableCell>
                <TableCell className="text-right tabular-nums">{c.service_count}</TableCell>
                <TableCell>
                  <Switch checked={c.is_active} onCheckedChange={(v) => toggle(c, v)} aria-label={`${c.name} active`} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil /></Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${c.name}`}
                    disabled={c.artist_count + c.service_count > 0}
                    title={c.artist_count + c.service_count > 0 ? 'In use — deactivate it instead' : undefined}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CategoryDialog open={creating || editing !== null} category={editing} onClose={() => { setCreating(false); setEditing(null) }} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>No artist uses it yet, so it can be removed for good.</AlertDialogDescription>
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
