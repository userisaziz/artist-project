import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

/** The design's pink initials circle; shows the photo instead when there is one. */
export function InitialsAvatar({ name, photoUrl, size = 30 }: { name: string; photoUrl?: string | null; size?: 30 | 34 | 64 }) {
  return (
    <Avatar aria-hidden className={cn('after:hidden', size === 30 && 'size-[30px]', size === 34 && 'size-[34px]', size === 64 && 'size-16')}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback className={cn('bg-accent font-bold text-primary', size === 64 ? 'text-lg' : 'text-[11px]')}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
