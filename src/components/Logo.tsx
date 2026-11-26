import darkLogo from '@/assets/logo-dark.png'
import lightLogo from '@/assets/logo-light.png'
import transparentLogo from '@/assets/logo-transparent.png'
import { cn } from '@/lib/cn'

export type LogoVariant = 'dark' | 'light' | 'transparent'

const SOURCES: Record<LogoVariant, string> = {
  dark: darkLogo,
  light: lightLogo,
  transparent: transparentLogo,
}

/**
 * `dark` is the dark artwork for light surfaces, `light` for dark surfaces,
 * and `transparent` has no baked background for use over brand colour.
 */
export function Logo({
  size = 46,
  variant = 'dark',
  className,
}: {
  size?: number
  variant?: LogoVariant
  className?: string
}) {
  const bare = variant === 'transparent'

  return (
    <img
      src={SOURCES[variant]}
      height={size}
      alt="JANSETU"
      draggable={false}
      className={cn(
        'shrink-0 select-none',
        bare ? 'object-contain' : 'rounded-logo object-cover',
        className,
      )}
      style={{
        height: size,
        width: bare ? 'auto' : size,
        ...(!bare && {
          boxShadow:
            '0 6px 16px -8px rgba(244,81,98,0.65), inset 0 1px 0 rgba(255,255,255,0.35)',
        }),
      }}
    />
  )
}