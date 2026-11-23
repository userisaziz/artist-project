import type { ReactNode } from 'react'
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

interface ConfirmAction {
  label: string
  /** While the decision is in flight the button is disabled, so a double click can't send it twice. */
  pending: boolean
  onConfirm: () => void
  destructive?: boolean
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** What happens if the admin goes ahead: who sees it and what changes. */
  children: ReactNode
  action: ConfirmAction
  onClose: () => void
}

/** A yes/no check before a decision that is hard to take back. The caller closes it once the decision succeeds. */
export function ConfirmDialog({ open, title, children, action, onClose }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !action.pending) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={action.destructive ? 'destructive' : 'default'} disabled={action.pending} onClick={action.onConfirm}>
            {action.pending ? 'Saving…' : action.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
