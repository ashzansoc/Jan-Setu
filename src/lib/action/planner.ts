import type { ActionIntent, ActionPlan, PlanStep } from './types'
import { getSkill, skillsForGoal } from './skills'
import { getTool } from './registry'

/**
 * Turns an intent into an executable plan.
 *
 * The planner is deterministic: the same intent always yields the same step
 * list, which is what makes approval meaningful (the citizen approves a specific
 * plan hash) and what makes the workflow testable.
 */

let stepCounter = 0
let planCounter = 0

function hash(input: string): string {
  let value = 0
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0
  }
  return value.toString(36)
}

function nextStepId(): string {
  stepCounter += 1
  return `step-${stepCounter}`
}

export function planHashOf(steps: PlanStep[]): string {
  return hash(steps.map((step) => `${step.order}:${step.action}:${step.tool}:${step.risk}`).join('|'))
}

/**
 * Builds one plan per goal, then links them: a shared `identify_department` runs
 * once, and later goals depend on it rather than repeating the lookup.
 */
export function buildPlan(intent: ActionIntent, taskId: string): ActionPlan {
  const allSteps: PlanStep[] = []
  const firstStepByAction = new Map<string, string>()

  for (const goal of intent.goals) {
    const skill =
      skillsForGoal(goal.kind).find((candidate) => intent.suggestedSkills.includes(candidate.id)) ??
      skillsForGoal(goal.kind)[0]

    if (!skill) {
      // No skill can serve this goal: record a single blocked step so the task
          // fails visibly instead of silently doing nothing.
      allSteps.push({
        id: nextStepId(),
        order: allSteps.length + 1,
        action: 'unsupported_goal',
        labelKey: 'unsupported_goal',
        tool: 'service_discovery',
        dependsOn: [],
        risk: 0,
        requiresApproval: false,
        status: 'blocked',
        attempts: 0,
        idempotencyKey: `unsupported-${goal.id}`,
        error: `No skill is registered for ${goal.kind}.`,
      })
      continue
    }

    const dependsOn: string[] = []
    for (const template of skill.workflow) {
      // Reuse an identical earlier step instead of repeating the work.
      const existing = firstStepByAction.get(template.action)
      if (existing && template.tool === 'service_discovery') {
        dependsOn.push(existing)
        continue
      }

      const tool = getTool(template.tool)
      const step: PlanStep = {
        id: nextStepId(),
        order: allSteps.length + 1,
        action: template.action,
        labelKey: template.labelKey,
        tool: template.tool,
        skillId: skill.id,
        dependsOn: [...dependsOn],
        risk: template.risk,
        requiresApproval: template.action === 'request_approval' || template.risk >= 2,
        status: tool.available() ? 'ready' : 'blocked',
        attempts: 0,
        idempotencyKey: `${taskId}:${goal.id}:${template.action}`,
      }

      allSteps.push(step)
      firstStepByAction.set(template.action, step.id)
      dependsOn.push(step.id)
    }
  }

  // Number sequentially in the order they were produced.
  allSteps.forEach((step, index) => {
    step.order = index + 1
  })

  planCounter += 1
  const ordered = allSteps.map((step) => ({ ...step }))

  return {
    id: `plan-${planCounter}`,
    taskId,
    goal: intent.goals.map((goal) => goal.description).join(' + '),
    steps: ordered,
    createdAt: new Date().toISOString(),
    planHash: planHashOf(ordered),
  }
}

/** Human summary of what the plan will do, for the consent screen. */
export function describePlan(plan: ActionPlan, label: (key: string) => string): string[] {
  return plan.steps.map((step) => label(step.labelKey))
}

/** Steps that require the citizen before anything else can proceed. */
export function approvalSteps(plan: ActionPlan): PlanStep[] {
  return plan.steps.filter((step) => step.requiresApproval && step.action !== 'request_approval')
}

export { getSkill }