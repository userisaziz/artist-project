import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { rupees } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useProductSummary, useSetProductRemoved, useShopProducts } from './queries'
import type { ProductView, ShopProduct } from './types'

const SEARCH_DEBOUNCE_MS = 300
const LOW_STOCK = 5
const COLUMNS = '2.4fr 1.4fr .8fr .7fr .7fr .9fr .9fr'
const VIEWS: ProductView[] = ['all', 'live', 'low_stock', 'removed']
const VIEW_LABEL: Record<ProductView, string> = { all: 'All', live: 'Live', low_stock: 'Low stock', removed: 'Removed' }
const number = new Intl.NumberFormat('en-IN')
const isView = (value: string | null): value is ProductView => VIEWS.includes(value as ProductView)

/** Design "Shop products": everything artists sell, with stock and units sold; take listings down or restore them. */
export function ShopProductsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view = isView(raw) ? raw : 'all'
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const products = useShopProducts(view, q)
  const summary = useProductSummary().data
  const removal = useSetProductRemoved()
  const [removing, setRemoving] = useState<ShopProduct | null>(null)
  const rows = products.data?.pages.flatMap((p) => p.items) ?? []
  const chips: Chip<ProductView>[] = VIEWS.map((v) => ({ value: v, label: summary ? `${VIEW_LABEL[v]} ${number.format(summary.counts[v])}` : VIEW_LABEL[v] }))

  const restore = (p: ShopProduct) =>
    removal.mutate({ id: p.id, reason: null }, { onSuccess: () => toast.success('Listing restored'), onError: (e) => toastError(e) })

  return (
    <>
      <PageHeader title="Shop products" subtitle="Everything artists sell: henna, makeup kits, accessories and prints." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Listings" value={summary && number.format(summary.counts.all)} />
        <KpiTile label="Live" value={summary && number.format(summary.counts.live)} tone="up" />
        <KpiTile label="Low stock" value={summary && number.format(summary.counts.low_stock)} note={`${LOW_STOCK} or fewer left`} tone="warn" />
        <KpiTile label="Removed" value={summary && number.format(summary.counts.removed)} note="Taken down by the team" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={view} onChange={(next) => setParams(next === 'all' ? {} : { view: next })} />
          <span className="flex-1" />
          <label className="flex h-[30px] items-center gap-1.5 rounded-[10px] border border-line px-3 text-xs font-semibold text-muted-foreground focus-within:ring-[3px] focus-within:ring-halo">
            <Search aria-hidden className="size-3.5" />
            <input type="search" aria-label="Search products" placeholder="Product name" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
          </label>
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Product', 'Seller', 'Price', 'Stock', 'Sold', 'Status', '']} />
        {products.isPending && <GridMessage state="loading" />}
        {products.isError && !products.data && <GridMessage state="error">Couldn’t load products. {products.error.message}</GridMessage>}
        {products.isSuccess && rows.length === 0 && <GridMessage state="empty">{q ? `No products match “${q}”.` : 'No products here.'}</GridMessage>}
        {rows.map((p) => (
          <GridRow key={p.id} columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              {p.photos[0] && <img src={p.photos[0].url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0">
                <div className="truncate font-bold">{p.name}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{p.category_label}</div>
              </div>
            </div>
            <span className="truncate">{p.seller.business_name}</span>
            <span className="tabular-nums">{rupees(p.price_paise)}</span>
            <span className={p.stock <= LOW_STOCK ? 'font-bold text-warning tabular-nums' : 'tabular-nums'}>{number.format(p.stock)}</span>
            <span className="tabular-nums">{number.format(p.sold)}</span>
            <span>
              {p.status === 'removed'
                ? <Badge variant="danger">Removed</Badge>
                : p.is_active ? <Badge variant="success">Live</Badge> : <Badge variant="neutral">Off sale</Badge>}
            </span>
            <span className="text-right">
              {p.status === 'removed'
                ? <Button variant="ghost" size="xs" disabled={removal.isPending} onClick={() => restore(p)}>Restore</Button>
                : <Button variant="ghost" size="xs" className="text-destructive" onClick={() => setRemoving(p)}>Remove</Button>}
            </span>
          </GridRow>
        ))}
        {products.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={products.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void products.fetchNextPage() }} disabled={products.isFetchingNextPage}>
                {products.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {number.format(rows.length)}{products.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>
      <RejectReasonDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}?`}
        description="It disappears from the shop. Open orders still ship."
        placeholder="Why is this listing coming down?"
        label="Reason"
        submitLabel="Remove"
        requiredMessage="Add a reason: the artist sees it."
        pending={removal.isPending}
        onClose={() => setRemoving(null)}
        onSubmit={(reason) =>
          removing && removal.mutate({ id: removing.id, reason }, {
            onSuccess: () => { toast.success('Listing removed'); setRemoving(null) },
            onError: (e) => toastError(e),
          })}
      />
    </>
  )
}
