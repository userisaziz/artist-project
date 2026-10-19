import { Badge } from '@/components/ui/badge'
import type { AdminPost } from './types'

/** Design feed statuses: Featured, Reported (live with open reports), Live, Hidden, Removed. */
export function PostStatusPill({ post }: { post: Pick<AdminPost, 'moderation' | 'featured' | 'report_count'> }) {
  if (post.moderation === 'removed') return <Badge variant="neutral">Removed</Badge>
  if (post.moderation === 'hidden') return <Badge variant="danger">Hidden</Badge>
  if (post.report_count > 0) return <Badge variant="danger">Reported</Badge>
  if (post.featured) return <Badge variant="brand">Featured</Badge>
  return <Badge variant="success">Live</Badge>
}
