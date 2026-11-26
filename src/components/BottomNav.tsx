import { NavLink } from 'react-router-dom'
import { IconFileText, IconHistory, IconHome, IconUser } from '@tabler/icons-react'
import { useDict } from '@/lib/i18n'
import { useComplaints } from '@/state/complaints'
import { cn } from '@/lib/cn'

const ITEMS = [
  { to: '/', icon: IconHome, key: 'home' as const, end: true },
  { to: '/complaints', icon: IconFileText, key: 'complaints' as const, end: false },
  { to: '/replay', icon: IconHistory, key: 'replay' as const, end: false },
  { to: '/profile', icon: IconUser, key: 'profile' as const, end: false },
]

export function BottomNav() {
  const d = useDict()
  const hasComplaints = useComplaints((s) => s.complaints.length > 0)

  return (
    <nav
      aria-label={d.nav.primary}
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto grid w-full max-w-[440px] grid-cols-4 gap-0.5 rounded-[22px] bg-white/97 p-1.5 shadow-nav backdrop-blur-md">
        {ITEMS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-1 rounded-[16px] py-2 transition-[transform,color] duration-200 active:scale-90',
                isActive ? 'text-orange' : 'text-[#9C979C] hover:text-[#6E6A70]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 -z-10 rounded-[16px] bg-orange/[0.08]" aria-hidden />
                )}
                <span className="relative">
                  <Icon
                    size={21}
                    stroke={isActive ? 2.5 : 2}
                    fill={isActive && key === 'home' ? 'currentColor' : 'none'}
                  />
                  {key === 'complaints' && hasComplaints && (
                    <span className="absolute -right-1 -top-0.5 size-[7px] rounded-full border-[1.5px] border-white bg-coral" />
                  )}
                </span>
                <span className={cn('text-[0.65625rem] leading-none', isActive ? 'font-bold' : 'font-medium')}>
                  {d.nav[key]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
