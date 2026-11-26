import type { ActionTask, PlanStep, TaskState } from './types'

/**
 * The task lifecycle is a directed graph, exactly like the complaint lifecycle.
 * A screen cannot invent a state the engine cannot justify.
 */
const ALLOWED: Record<TaskState, TaskState[]> = {
  received: ['understanding', 'cancelled'],
  understanding: ['researching', 'planning', 'waiting_for_information', 'failed', 'cancelled'],
  researching: ['planning', 'waiting_for_information', 'failed', 'cancelled'],
  planning: ['ready_to_execute', 'waiting_for_information', 'failed', 'cancelled'],
  waiting_for_information: ['ready_to_execute', 'planning', 'failed', 'cancelled'],
  ready_to_execute: ['executing', 'waiting_for_approval', 'cancelled'],
  executing: [
    'verifying',
    'waiting_for_user',
    'waiting_for_approval',
    'failed',
    'partially_completed',
    'cancelled',
  ],
  waiting_for_user: ['executing', 'verifying', 'failed', 'cancelled'],
  waiting_for_approval: ['executing', 'failed', 'cancelled'],
  verifying: ['completed', 'partially_completed', 'failed', 'cancelled'],
  completed: [],
  partially_completed: [],
  failed: [],
  cancelled: [],
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  if (from === to) return true
  return ALLOWED[from]?.includes(to) ?? false
}

export function isTerminal(state: TaskState): boolean {
  return ALLOWED[state].length === 0
}

export function isRunning(state: TaskState): boolean {
  return state === 'executing' || state === 'verifying'
}

/** True when the citizen must act before anything else can happen. */
export function needsCitizen(task: ActionTask): boolean {
  if (task.handoff?.status === 'open') return true
  return task.state === 'waiting_for_approval' || task.state === 'waiting_for_information'
}

export function progressOf(task: ActionTask): number {
  if (!task.plan || task.plan.steps.length === 0) return 0
  const done = task.plan.steps.filter((step) => step.status === 'done').length
  const partial = task.plan.steps.filter((step) => step.status === 'unknown').length * 0.5
  return Math.min(1, (done + partial) / task.plan.steps.length)
}

export function currentStep(task: ActionTask): PlanStep | undefined {
  if (!task.plan) return undefined
  return task.plan.steps.find((step) => step.id === task.currentStepId)
}

/** A step is runnable when every dependency is done. */
export function isStepReady(step: PlanStep, steps: PlanStep[]): boolean {
  if (step.status === 'done' || step.status === 'running') return false
  return step.dependsOn.every((id) => steps.find((s) => s.id === id)?.status === 'done')
}

/** Steps whose dependencies are satisfied, in plan order. */
export function readySteps(steps: PlanStep[]): PlanStep[] {
  return steps.filter((step) => isStepReady(step, steps))
}