import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconMicrophone } from '@tabler/icons-react'
import { ScreenShell } from '@/components/layout/ScreenShell'
import { ActionTaskCard } from '@/components/action/ActionTaskCard'
import { Button } from '@/components/ui/Button'
import { AskActionSheet } from '@/components/action/AskActionSheet'
import { useActions } from '@/lib/action/store'
import { startTask } from '@/lib/action/executor'
import { refreshToolAvailability } from '@/lib/action/registry'
import { useDict } from '@/lib/i18n'

export function ActionCentreScreen() {
  const d = useDict()
  const navigate = useNavigate()
  const tasks = useActions((s) => s.tasks)
  const hydrate = useActions((s) => s.hydrate)
  const [askOpen, setAskOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    hydrate()
    void refreshToolAvailability()
  }, [hydrate])

  const ordered = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [tasks],
  )

  return (
    <ScreenShell
      title={d.action.title}
      subtitle={d.action.subtitle}
      withNav
      backTo="/"
      action={
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          data-testid="open-ask"
          aria-label={d.action.newTask}
          className="mr-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-orange shadow-chip"
        >
          <IconMicrophone size={18} strokeWidth={2.3} />
        </button>
      }
    >
      <div className="safe-x space-y-2.5">
        {ordered.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-white/60 px-5 py-6 text-center">
            <p className="text-[13.5px] leading-relaxed text-muted">{d.action.empty}</p>
            <Button
              className="mt-4"
              size="md"
              icon={<IconMicrophone size={16} strokeWidth={2.4} />}
              data-testid="open-ask-empty"
              onClick={() => setAskOpen(true)}
            >
              {d.action.newTask}
            </Button>
          </div>
        ) : (
          ordered.map((task) => <ActionTaskCard key={task.id} task={task} />)
        )}
      </div>

      <AskActionSheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        submitting={starting}
        onSubmit={async (text) => {
          setAskOpen(false)
          setStarting(true)
          const id = await startTask(text)
          setStarting(false)
          if (id) navigate(`/actions/${id}`)
        }}
      />
    </ScreenShell>
  )
}