import { useState } from 'react'
import { toast } from 'sonner'
import { CellLabel } from '@/components/console/cell-label'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useRemoveAdmin, useTeam } from './queries'
import type { TeamMember } from './types'

const COLUMNS = '2fr 1.4fr 1fr .8fr'

/** Design "Team & roles" for phase 1: everyone with admin access, and removing it. */
export function TeamPanel() {
  const team = useTeam()
  const remove = useRemoveAdmin()
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const confirm = () => {
    if (!removing) return
    remove.mutate(removing.id, {
      onSuccess: () => { toast.success(`${removing.name} is no longer an admin`); setRemoving(null) },
      onError: (e) => toastError(e),
    })
  }
  return (
    <>
      <GridHeader columns={COLUMNS} labels={['Member', 'Contact', 'Admin since', '']} />
      {team.isPending && <GridMessage state="loading" />}
      {team.isError && <GridMessage state="error">Couldn’t load the team. {team.error.message}</GridMessage>}
      {team.data?.map((m) => (
        <GridRow key={m.id} columns={COLUMNS}>
          <div className="flex min-w-0 items-center gap-2.5">
            <InitialsAvatar name={m.name} />
            <span className="truncate font-bold">{m.name}</span>
            {m.is_me && <Badge variant="brand">You</Badge>}
          </div>
          <span className="truncate">{m.email ?? m.phone}</span>
          <span><CellLabel>Admin since</CellLabel>{dateTime(m.admin_since)}</span>
          <span className="text-right">
            {!m.is_me && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(m)}>Remove</Button>}
          </span>
        </GridRow>
      ))}
      <AlertDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to the admin console. Their customer or artist account stays.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirm}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
