import { cn } from '@/lib/cn'
import type { AvatarId } from '@/state/settings'
import { useSettings } from '@/state/settings'
import kamlaMemoji from '@/assets/memoji/kamla.png'
import arjunMemoji from '@/assets/memoji/arjun.png'
import meeraMemoji from '@/assets/memoji/meera.png'

/**
 * Memoji avatars (Tapback-Memojis, MIT) — friendly illustrated faces that
 * read as real people from the communities JANSETU serves. A user-uploaded
 * photo overrides the memoji when present.
 */
const MEMOJI: Record<Exclude<AvatarId, 'photo'>, string> = {
  kamla: kamlaMemoji,
  arjun: arjunMemoji,
  meera: meeraMemoji,
}

export function Avatar({
  size = 44,
  id,
  className,
  ring = true,
}: {
  size?: number
  id?: AvatarId
  className?: string
  ring?: boolean
}) {
  const stored = useSettings((s) => s.avatarId)
  const photo = useSettings((s) => s.avatarPhoto)
  const chosen = id ?? stored

  const src =
    chosen === 'photo' && photo ? photo : MEMOJI[chosen === 'photo' ? 'kamla' : chosen]

  return (
    <span
      className={cn(
        'inline-block shrink-0 overflow-hidden rounded-full bg-peach',
        ring && 'ring-2 ring-white shadow-[0_4px_12px_-4px_rgba(23,23,29,0.28)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" className="size-full object-cover" draggable={false} />
    </span>
  )
}