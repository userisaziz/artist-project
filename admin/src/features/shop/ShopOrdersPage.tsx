import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Button } from '@/components/ui/button'
import { dateTime, rupees } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useRevealWhenStacked } from '@/lib/use-reveal-when-stacked'
import { OrderStatusPill } from './OrderStatusPill'
import { useOrderSummary, useSetOrderStatus, useShopOrders } from './queries'
import { PAYMENT_LABEL, type OrderStatus, type OrderView, type ShopOrder } from './types'

const COLUMNS = '1.8fr 1.6fr 1.4fr .9fr 1.2fr .9fr'
const VIEWS: OrderView[] = ['all', 'to_pack', 'shipped', 'delivered', 'cancelled']
const VIEW_LABEL: Record<OrderView, string> = { all: 'All', to_pack: 'To pack', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  placed: { status: 'confirmed', label: 'Mark confirmed' },
  confirmed: { status: 'shipped', label: 'Mark shipped' },
  shipped: { status: 'delivered', label: 'Mark delivered' },
}
const number = new Intl.NumberFormat('en-IN')
const isView = (value: string | null): value is OrderView => VIEWS.includes(value as OrderView)

/** Design "Shop orders" (phase 1, no refunds): fulfilment across all sellers; move an order on or cancel it. */
export function ShopOrdersPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view = isView(raw) ? raw : 'all'
  const orders = useShopOrders(view)
  const summary = useOrderSummary().data
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rows = orders.data?.pages.flatMap((p) => p.items) ?? []
  const selected = rows.find((o) => o.id === selectedId) ?? null
  const paneRef = useRevealWhenStacked<HTMLDivElement>(selected?.id)
  const chips: Chip<OrderView>[] = VIEWS.map((v) => ({ value: v, label: summary ? `${VIEW_LABEL[v]} ${number.format(summary.counts[v])}` : VIEW_LABEL[v] }))

  return (
    <>
      <PageHeader title="Shop orders" subtitle="Fulfilment across all sellers. Customers pay sellers directly in phase 1." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="To pack" value={summary && number.format(summary.counts.to_pack)} tone="warn" />
        <KpiTile label="Shipped" value={summary && number.format(summary.counts.shipped)} />
        <KpiTile label="Delivered" value={summary && number.format(summary.counts.delivered)} tone="up" />
        <KpiTile label="Cancelled" value={summary && number.format(summary.counts.cancelled)} />
      </div>
      <div className={selected ? 'grid gap-4 xl:grid-cols-[1fr_400px]' : ''}>
        <Panel className="flex flex-col">
          <PanelToolbar>
            <FilterChips chips={chips} value={view} onChange={(next) => setParams(next === 'all' ? {} : { view: next })} />
          </PanelToolbar>
          <GridHeader columns={COLUMNS} labels={['Order', 'Items', 'Seller', 'Total', 'Payment', 'Status']} />
          {orders.isPending && <GridMessage state="loading" />}
          {orders.isError && !orders.data && <GridMessage state="error">Couldn’t load orders. {orders.error.message}</GridMessage>}
          {orders.isSuccess && rows.length === 0 && <GridMessage state="empty">No orders here.</GridMessage>}
          {rows.map((o) => (
            <GridRow key={o.id} columns={COLUMNS} onClick={() => setSelectedId(o.id)} selected={o.id === selectedId}>
              <div className="min-w-0">
                <div className="truncate font-bold">#{o.code}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{o.customer.name} · {dateTime(o.created_at)}</div>
              </div>
              <span className="truncate">{o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</span>
              <span className="truncate">{o.seller.business_name}</span>
              <span className="tabular-nums">{rupees(o.total_paise)}</span>
              <span className="truncate">{PAYMENT_LABEL[o.payment_method]}{o.paid_at ? ' · paid' : ''}</span>
              <span><OrderStatusPill status={o.status} /></span>
            </GridRow>
          ))}
          {orders.isSuccess && rows.length > 0 && (
            <PanelFooter
              end={orders.hasNextPage && (
                <Button variant="link" size="xs" onClick={() => { void orders.fetchNextPage() }} disabled={orders.isFetchingNextPage}>
                  {orders.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            >
              Showing {number.format(rows.length)}{orders.hasNextPage ? '+' : ''}
            </PanelFooter>
          )}
        </Panel>
        {selected && <div ref={paneRef} className="scroll-mt-4"><OrderPanel order={selected} onClose={() => setSelectedId(null)} /></div>}
      </div>
    </>
  )
}

function OrderPanel({ order: o, onClose }: { order: ShopOrder; onClose: () => void }) {
  const setStatus = useSetOrderStatus()
  const [cancelling, setCancelling] = useState(false)
  const next = NEXT[o.status]
  const open = o.status === 'placed' || o.status === 'confirmed'
  const run = (status: OrderStatus, reason?: string) =>
    setStatus.mutate({ id: o.id, status, reason }, {
      onSuccess: () => { toast.success(status === 'cancelled' ? 'Order cancelled' : 'Order updated'); setCancelling(false) },
      onError: (e) => toastError(e),
    })
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Order</div>
          <h2 className="text-[17px] font-bold">#{o.code}</h2>
          <OrderStatusPill status={o.status} />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close order panel" onClick={onClose}><X aria-hidden /></Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-muted-foreground">Customer</dt><dd>{o.customer.name} · {o.customer.phone}</dd>
        <dt className="text-muted-foreground">Seller</dt><dd>{o.seller.business_name}, {o.seller.city}</dd>
        <dt className="text-muted-foreground">Deliver to</dt><dd>{o.address}</dd>
        <dt className="text-muted-foreground">Payment</dt><dd>{PAYMENT_LABEL[o.payment_method]}{o.paid_at ? ` · paid ${dateTime(o.paid_at)}` : ''}</dd>
        <dt className="text-muted-foreground">Total</dt><dd>{rupees(o.total_paise)} (delivery {o.delivery_fee_paise ? rupees(o.delivery_fee_paise) : 'free'})</dd>
        {o.tracking && <><dt className="text-muted-foreground">Tracking</dt><dd>{o.tracking}</dd></>}
        {o.cancel_reason && <><dt className="text-muted-foreground">Cancelled</dt><dd>{o.cancel_reason}</dd></>}
      </dl>
      <ol aria-label="Order timeline" className="flex flex-col gap-1 text-[12.5px]">
        {o.timeline.map((e) => <li key={`${e.status}:${e.at}`}><span className="font-bold capitalize">{e.status}</span> · {dateTime(e.at)}</li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        {next && <Button size="page" disabled={setStatus.isPending} onClick={() => run(next.status)}>{next.label}</Button>}
        {open && <Button size="page" variant="outline" className="text-destructive" onClick={() => setCancelling(true)}>Cancel order</Button>}
      </div>
      <RejectReasonDialog
        open={cancelling}
        title={`Cancel #${o.code}?`}
        description="The customer and the seller are told; the stock goes back on sale."
        placeholder="Why is it cancelled?"
        label="Reason"
        submitLabel="Cancel order"
        dismissLabel="Keep order"
        requiredMessage="Add a reason."
        pending={setStatus.isPending}
        onClose={() => setCancelling(false)}
        onSubmit={(reason) => run('cancelled', reason)}
      />
    </Panel>
  )
}
