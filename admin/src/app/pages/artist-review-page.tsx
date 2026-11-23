import { ArtistReviewPage } from '@/features/artists/ArtistReviewPage'
import { useCategories } from '@/features/categories/queries'

/** Artist review with the catalog from the categories feature composed in at the route. */
export function ArtistReviewRoute() {
  const categories = useCategories()
  return <ArtistReviewPage categories={categories.data} />
}
