import { create } from 'zustand'
import type {
  ActionEvent,
  ActionIntent,
  ActionPlan,
  ActionTask,
  ApprovalRecord,
  HandoffRequest,
  PlanStep,
  TaskState,
  VerificationResult,
} from './types'
import { canTransition } from './status'

/**
 * Persistent task store.
 *
 * Every mutation is written through to localStorage immediately, so a task
 * survives an app restart mid-flight (acceptance test 8) and can be resumed from
 * the last verified step. Firestore mirroring happens through the existing sync.
 */

const KEY = 'jansetu.actions.v1'
const VERSION = 1

interface Envelope {
  version: number
  tasks: ActionTask[]
}

let eventCounter = 0
let handoffCounter = 0

function makeEvent(
  kind: ActionEvent['kind'],
  title: string,
  status: ActionEvent['status'] = 'ok',
  detail?: string,
  source?: string,
): ActionEvent {
  eventCounter += 1
  return {
    id: `evt-${Date.now().toString(36)}-${eventCounter}`,
    at: new Date().toISOString(),
    kind,
    title,
    status,
    detail,
    source,
  }
}

function load(): ActionTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Envelope
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.tasks)) return []
    return parsed.tasks
  } catch {
    return []
  }
}

function save(tasks: ActionTask[]): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: Envelope = { version: VERSION, tasks }
    window.localStorage.setItem(KEY, JSON.stringify(envelope))
  } catch {
    /* quota — keep the in-memory session working */
  }
}

interface ActionState {
  tasks: ActionTask[]
  hydrated: boolean
  hydrate: () => void
  createTask: (intent: ActionIntent) => ActionTask
  transition: (taskId: string, to: TaskState, reason?: string | null) => boolean
  attachPlan: (taskId: string, plan: ActionPlan) => void
  updateStep: (taskId: string, stepId: string, patch: Partial<PlanStep>) => void
  openHandoff: (taskId: string, handoff: Omit<HandoffRequest, 'id' | 'createdAt' | 'status'>) => HandoffRequest | null
  resolveHandoff: (taskId: string, summary?: string) => void
  addApproval: (taskId: string, approval: Omit<ApprovalRecord, 'id' | 'approvedAt'>) => void
  pushEvent: (taskId: string, event: Omit<ActionEvent, 'id' | 'at'>) => void
  finish: (taskId: string, result: VerificationResult, extra?: Partial<ActionTask>) => void
  patchTask: (taskId: string, extra: Partial<ActionTask>) => void
  cancel: (taskId: string) => void
  remove: (taskId: string) => void
  clearAll: () => void
  get: (taskId: string) => ActionTask | undefined
}

export const useActions = create<ActionState>((set, get) => {
  const commit = (tasks: ActionTask[]) => {
    save(tasks)
    set({ tasks })
  }

  const mutate = (taskId: string, updater: (task: ActionTask) => ActionTask) => {
    const tasks = get().tasks.map((task) => (task.id === taskId ? updater(task) : task))
    commit(tasks)
    return tasks.find((task) => task.id === taskId)
  }

  return {
    tasks: [],
    hydrated: false,

    hydrate: () => {
      if (get().hydrated) return
      set({ tasks: load(), hydrated: true })
    },

    createTask: (intent) => {
      const now = new Date().toISOString()
      const task: ActionTask = {
        id: `task-${Date.now().toString(36)}`,
        userId: 'local-user',
        state: 'received',
        intent,
        plan: null,
        currentStepId: null,
        handoff: null,
        approvals: [],
        events: [makeEvent('request', intent.originalRequest, 'ok', undefined, 'citizen')],
        complaintId: null,
        emailMessageId: null,
        values: {},
        result: null,
        reason: intent.needsClarification ? (intent.clarification ?? null) : null,
        createdAt: now,
        updatedAt: now,
      }
      commit([task, ...get().tasks])
      return task
    },

    transition: (taskId, to, reason) => {
      const current = get().tasks.find((task) => task.id === taskId)
      if (!current) return false
      if (!canTransition(current.state, to)) {
        if (import.meta.env.DEV) {
          console.warn(`[jansetu] blocked task transition ${current.state} → ${to}`)
        }
        return false
      }
      const now = new Date().toISOString()
      mutate(taskId, (task) => ({
        ...task,
        state: to,
        reason: reason === undefined ? task.reason : reason,
        updatedAt: now,
        events: [...task.events, makeEvent('state', to, to === 'failed' ? 'failed' : 'ok')],
      }))
      return true
    },

    attachPlan: (taskId, plan) => {
      mutate(taskId, (task) => ({
        ...task,
        plan,
        updatedAt: new Date().toISOString(),
        events: [
          ...task.events,
          makeEvent('plan', `${plan.steps.length} steps planned`, 'ok', plan.goal, 'planner'),
        ],
      }))
    },

    updateStep: (taskId, stepId, patch) => {
      mutate(taskId, (task) => {
        if (!task.plan) return task
        return {
          ...task,
          plan: {
            ...task.plan,
            steps: task.plan.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
          },
          updatedAt: new Date().toISOString(),
        }
      })
    },

    openHandoff: (taskId, handoff) => {
      handoffCounter += 1
      const request: HandoffRequest = {
        ...handoff,
        id: `handoff-${handoffCounter}`,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      mutate(taskId, (task) => ({
        ...task,
        handoff: request,
        state: handoff.type === 'approval' ? 'waiting_for_approval' : 'waiting_for_user',
        updatedAt: new Date().toISOString(),
        events: [
          ...task.events,
          makeEvent('handoff', handoff.prompt, 'waiting', handoff.reason, 'citizen'),
        ],
      }))
      return request
    },

    resolveHandoff: (taskId, summary) => {
      mutate(taskId, (task) => {
        if (!task.handoff) return task
        return {
          ...task,
          handoff: {
            ...task.handoff,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            summary,
          },
          updatedAt: new Date().toISOString(),
          events: [...task.events, makeEvent('handoff', 'Citizen responded', 'ok', summary, 'citizen')],
        }
      })
    },

    addApproval: (taskId, approval) => {
      mutate(taskId, (task) => ({
        ...task,
        approvals: [
          ...task.approvals,
          { ...approval, id: `appr-${task.approvals.length + 1}`, approvedAt: new Date().toISOString() },
        ],
        updatedAt: new Date().toISOString(),
        events: [
          ...task.events,
          makeEvent('approval', 'Citizen approved this step', 'ok', approval.destination, 'citizen'),
        ],
      }))
    },

    pushEvent: (taskId, event) => {
      mutate(taskId, (task) => ({
        ...task,
        events: [...task.events, makeEvent(event.kind, event.title, event.status, event.detail, event.source)],
        updatedAt: new Date().toISOString(),
      }))
    },

    finish: (taskId, result, extra) => {
      const task = get().tasks.find((item) => item.id === taskId)
      if (!task) return
      const anyFailed = task.plan?.steps.some((step) => step.status === 'failed')
      const allDone = task.plan?.steps.every((step) => step.status === 'done' || step.status === 'skipped')
      const nextState: TaskState =
        result.status === 'verified' && allDone
          ? 'completed'
          : result.status === 'failed'
            ? 'failed'
            : allDone
              ? 'completed'
              : 'partially_completed'
      void anyFailed
      mutate(taskId, (current) => ({
        ...current,
        ...extra,
        state: nextState,
        result,
        updatedAt: new Date().toISOString(),
        events: [
          ...current.events,
          makeEvent(
            'verification',
            `Verification: ${result.status}`,
            result.status === 'verified' ? 'ok' : result.status === 'failed' ? 'failed' : 'unknown',
            result.reason ?? result.method,
            result.method,
          ),
        ],
      }))
    },

    patchTask: (taskId, extra) => {
      mutate(taskId, (task) => ({ ...task, ...extra, updatedAt: new Date().toISOString() }))
    },

    cancel: (taskId) => {
      mutate(taskId, (task) => ({
        ...task,
        state: 'cancelled',
        updatedAt: new Date().toISOString(),
        events: [...task.events, makeEvent('state', 'Cancelled by citizen', 'ok', undefined, 'citizen')],
      }))
    },

    remove: (taskId) => commit(get().tasks.filter((task) => task.id !== taskId)),

    clearAll: () => commit([]),

    get: (taskId) => get().tasks.find((task) => task.id === taskId),
  }
})

export function newHandoffId(): string {
  handoffCounter += 1
  return `handoff-${handoffCounter}`
}