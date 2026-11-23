import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CellLabel } from '@/components/console/cell-label'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { PanelFooter } from '@/components/console/panel-footer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useRequirements, useUpdateRequirement } from './queries'
import type { ProfileRequirement } from './types'

const COLUMNS = '2.4fr .9fr 1fr .8fr'
const MAX_GRACE_DAYS = 90 // backend requirement.constants.MAX_GRACE_DAYS
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const schema = z.object({
  mandatory: z.boolean(),
  grace_days: z.coerce.number().int('Whole days only').min(0, '0 or more').max(MAX_GRACE_DAYS, `At most ${MAX_GRACE_DAYS}`),
})
type FormValues = z.infer<typeof schema>

/** Profile requirements: which are mandatory and how long artists get. Overdue artists are hidden until they comply. */
export function RequirementsPanel() {
  const requirements = useRequirements()
  return (
    <>
      <GridHeader columns={COLUMNS} labels={['Requirement', 'Mandatory', 'Grace period', '']} />
      {requirements.isPending && <GridMessage state="loading" />}
      {requirements.isError && <GridMessage state="error" onRetry={() => { void requirements.refetch() }}>Couldn’t load the requirements. {requirements.error.message}</GridMessage>}
      {requirements.data?.map((r) => <RequirementRow key={r.key} requirement={r} />)}
      {requirements.isSuccess && (
        <PanelFooter>
          During the grace period artists only see a warning. After it, approved artists still missing a mandatory item are
          hidden from customers and take no new requests; their existing bookings stay.
        </PanelFooter>
      )}
    </>
  )
}

function RequirementRow({ requirement }: { requirement: ProfileRequirement }) {
  const update = useUpdateRequirement()
  const form = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mandatory: requirement.mandatory, grace_days: requirement.grace_days },
  })
  useEffect(() => {
    form.reset({ mandatory: requirement.mandatory, grace_days: requirement.grace_days })
  }, [requirement.mandatory, requirement.grace_days, form])

  // Making a requirement mandatory can take non-compliant artists off the app, so that save waits for a yes.
  const [confirming, setConfirming] = useState<FormValues | null>(null)
  const save = (values: FormValues) =>
    update.mutate({ key: requirement.key, ...values }, {
      onSuccess: (saved) => {
        toast.success(saved.mandatory ? `${saved.title} is now mandatory` : `${saved.title} is optional`)
        setConfirming(null)
      },
      onError: (e) => toastError(e),
    })
  const submit = form.handleSubmit((values) => (values.mandatory && !requirement.mandatory ? setConfirming(values) : save(values)))
  const graceError = form.formState.errors.grace_days?.message
  const fieldId = `grace-${requirement.key}`

  return (
    <>
    <form onSubmit={(e) => { void submit(e) }} noValidate>
      <GridRow columns={COLUMNS}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{requirement.title}</span>
            {requirement.effective_from && <Badge variant="brand">Since {dateTime(requirement.effective_from)}</Badge>}
          </div>
          <p className="text-muted-foreground">{requirement.body}</p>
        </div>
        <span className="flex items-center gap-2">
          <CellLabel>Mandatory</CellLabel>
          <Controller
            control={form.control}
            name="mandatory"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${requirement.title} is mandatory`} />
            )}
          />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <CellLabel>Grace</CellLabel>
            <Input id={fieldId} type="number" inputMode="numeric" min={0} max={MAX_GRACE_DAYS} className="w-20" aria-label={`Grace period for ${requirement.title}, in days`} aria-invalid={!!graceError} {...form.register('grace_days')} />
            <span>days</span>
          </div>
          {graceError && <p role="alert" className="text-destructive">{graceError}</p>}
        </div>
        <span className="text-right">
          <Button type="submit" size="sm" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </span>
      </GridRow>
    </form>
    <ConfirmDialog
        open={confirming !== null}
        title={`Make “${requirement.title}” mandatory?`}
        action={{ label: 'Make mandatory', pending: update.isPending, onConfirm: () => { if (confirming) save(confirming) } }}
        onClose={() => setConfirming(null)}
      >
        {confirming && `Approved artists without it get ${plural(confirming.grace_days, 'day')} to add it. After that they are hidden from customers and take no new requests until they comply.`}
    </ConfirmDialog>
    </>
  )
}
