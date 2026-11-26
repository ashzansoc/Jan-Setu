import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'ink'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  full?: boolean
  /** Keep the label on one line even if it overflows its column. */
  nowrap?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-orange-bright to-coral text-white shadow-[0_10px_24px_-12px_rgba(244,81,98,0.75)] hover:brightness-[1.03] active:brightness-95',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-[#FFFBF7]',
  ghost: 'bg-transparent text-ink hover:bg-black/[0.04]',
  ink: 'bg-ink text-white shadow-[0_10px_24px_-14px_rgba(23,23,29,0.9)] hover:bg-[#22222a]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-4 text-[0.875rem] rounded-xl gap-2',
  md: 'h-[52px] px-5 text-[0.96875rem] rounded-btn gap-2.5',
  lg: 'h-[56px] px-6 text-[1rem] rounded-btn gap-3',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  full,
  nowrap,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-[transform,filter,background-color,box-shadow] duration-150 active:scale-[0.975] disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      <span className={nowrap ? 'whitespace-nowrap' : 'truncate'}>{children}</span>
      {iconRight}
    </button>
  )
}
