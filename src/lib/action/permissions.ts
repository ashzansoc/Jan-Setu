import type { ActionTask, PlanStep, RiskLevel } from './types'
import { getTool } from './registry'

/**
 * Permission and approval gate.
 *
 * Risk decides whether the citizen must approve, and approval is bound to the
 * exact plan and payload — if either changes, the approval no longer applies and
 * the engine asks again.
 */

export function requiresApproval(risk: RiskLevel): boolean {
  return risk >= 2
}

/** Stable fingerprint of the payload a step will act on. */
export function payloadFingerprint(step: PlanStep): string {
  const payload = JSON.stringify(step.output ?? {})
  let hash = 0
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

export interface GateResult {
  ok: boolean
  reason?: string
}

/** Can this step run at all right now? */
export function checkStepGate(task: ActionTask, step: PlanStep): GateResult {
  const tool = getTool(step.tool)
  if (!tool.available()) {
    return { ok: false, reason: tool.unavailableReason ?? `${step.tool} is unavailable.` }
  }
  if (step.status === 'blocked') {
    return { ok: false, reason: 'This step is blocked by the plan.' }
  }
  if (requiresApproval(step.risk)) {
    const approval = task.approvals.find(
      (record) =>
        record.stepId === step.id &&
        record.planHash === task.plan?.planHash &&
        record.payloadHash === payloadFingerprint(step),
    )
    if (!approval) {
      return { ok: false, reason: 'Citizen approval is required for this step.' }
    }
  }
  return { ok: true }
}

/** True when the task is waiting on the citizen rather than on a tool. */
export function isWaitingOnCitizen(task: ActionTask): boolean {
  return task.state === 'waiting_for_approval' || task.state === 'waiting_for_user'
}

/** Human description of what approval covers, for the consent sheet. */
export function approvalSummary(step: PlanStep, destination: string): string {
  return `${step.labelKey.replace(/_/g, ' ')} → ${destination}`
}

export type { RiskLevel }