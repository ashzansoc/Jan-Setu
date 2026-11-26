import type { ToolName } from '../types'
import { getTool, toolAvailable, toolUnavailableReason } from '../registry'
import {
  runComplaintsTool,
  runDocumentsTool,
  runLocationTool,
  runNotificationsTool,
  runProfileTool,
  runReplayTool,
  runVoiceTool,
  type LocalToolResult,
} from './local'
import { runBrowserTool, runDiscoveryTool, runEmailTool, runHttpTool } from './remote'

/**
 * Tool dispatch.
 *
 * The executor calls this and nothing else, so adding a tool means adding a case
 * here plus a registry entry. Availability is re-checked at call time: a service
 * whose credentials disappear mid-task fails with a reason instead of silently.
 */

export type { LocalToolResult }

export async function callTool(
  name: ToolName,
  input: Record<string, unknown>,
): Promise<LocalToolResult> {
  if (!toolAvailable(name)) {
    const reason = toolUnavailableReason(name) ?? `${getTool(name).description} is unavailable.`
    return { ok: false, output: {}, error: `not-configured: ${reason}` }
  }

  switch (name) {
    case 'complaints':
      return runComplaintsTool(input)
    case 'profile':
      return runProfileTool(input)
    case 'voice':
      return runVoiceTool(input)
    case 'location':
      return runLocationTool()
    case 'documents':
      return runDocumentsTool(input)
    case 'notifications':
      return runNotificationsTool(input)
    case 'replay':
      return runReplayTool(input)
    case 'service_discovery':
      return runDiscoveryTool(input)
    case 'browser':
      return runBrowserTool(input, input.sessionId ? 'task' : 'session')
    case 'email':
      return runEmailTool(input)
    case 'http':
      return runHttpTool(input)
    default:
      return { ok: false, output: {}, error: `Unknown tool: ${name}` }
  }
}