import { z } from 'zod'
import type { ToolName, ToolSpec } from './types'

/**
 * Central tool registry.
 *
 * Registration is data: adding a capability means adding an entry here (and, for
 * remote tools, a server route). The planner may only select registered tools,
 * and the executor re-checks `available()` at call time — a tool whose
 * credentials vanished mid-task fails honestly instead of silently.
 */

const text = z.string().min(1).max(4000)

const browserInput = z.object({
  objective: text,
  url: z.string().url(),
  fields: z.record(z.string(), z.string()).optional(),
  /** What to extract after acting. */
  expect: z.enum(['reference', 'status', 'confirmation', 'none']).default('none'),
})

const emailInput = z.object({
  action: z.enum(['draft', 'send', 'status']).default('send'),
  to: z.string().email(),
  subject: text,
  body: text,
  attachments: z.array(z.object({ name: z.string(), dataUrl: z.string() })).optional(),
})

const discoveryInput = z.object({
  query: text,
  location: z.string().optional(),
})

const complaintInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), draft: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('submit'), id: z.string() }),
  z.object({ action: z.literal('status'), id: z.string() }),
])

const httpInput = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  body: z.record(z.string(), z.unknown()).optional(),
  /** Named credential from the server's allowlisted store, never a raw secret. */
  authRef: z.string().optional(),
})

/** Availability snapshot, refreshed from `/api/health`. */
const availability: Record<ToolName, { ok: boolean; reason?: string }> = {
  browser: { ok: false, reason: 'Browser automation is not configured on the server.' },
  email: { ok: false, reason: 'No email account is connected yet.' },
  voice: { ok: true },
  documents: { ok: true },
  service_discovery: { ok: true },
  profile: { ok: true },
  complaints: { ok: true },
  notifications: { ok: false, reason: 'Notifications are not enabled on this device.' },
  location: { ok: false, reason: 'Location access has not been granted.' },
  http: { ok: true },
  replay: { ok: true },
}

export function toolAvailable(name: ToolName): boolean {
  return availability[name]?.ok ?? false
}

export function toolUnavailableReason(name: ToolName): string | undefined {
  return availability[name]?.reason
}

/** Pulls real capability flags from the API. Local tools stay as-is. */
export async function refreshToolAvailability(): Promise<void> {
  try {
    const response = await fetch('/api/health')
    if (!response.ok) return
    const health = (await response.json()) as {
      browser?: string
      email?: string
      filing?: string
    }
    availability.browser = {
      ok: health.browser === 'configured',
      reason:
        health.browser === 'configured'
          ? undefined
          : 'Browser automation is not configured on the server (set SKYVERN_BASE_URL and SKYVERN_API_KEY).',
    }
    availability.email = {
      ok: health.email === 'configured',
      reason:
        health.email === 'configured'
          ? undefined
          : 'No email account is connected yet (set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN).',
    }
  } catch {
    /* offline: keep the last known snapshot */
  }
}

export const TOOL_REGISTRY: Record<ToolName, ToolSpec> = {
  browser: {
    name: 'browser',
    description: 'Drive a real browser through Skyvern to complete a portal workflow.',
    capabilities: ['navigate', 'fill_form', 'click', 'upload', 'extract', 'screenshot'],
    inputSchema: browserInput,
    outputSchema: z.object({
      sessionId: z.string(),
      status: z.enum(['completed', 'failed', 'needs_human']),
      reference: z.string().optional(),
      finalUrl: z.string().optional(),
      screenshotUrl: z.string().optional(),
    }),
    permissions: ['browser:control'],
    requiresAuth: true,
    risk: 2,
    timeoutMs: 120_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'portal_confirmation',
    available: () => toolAvailable('browser'),
    unavailableReason: availability.browser.reason,
  },
  email: {
    name: 'email',
    description: 'Send an email from the citizen’s authorised Gmail account.',
    capabilities: ['draft', 'send', 'reply', 'attach'],
    inputSchema: emailInput,
    outputSchema: z.object({
      messageId: z.string().optional(),
      threadId: z.string().optional(),
      status: z.enum(['sent', 'failed', 'drafted']),
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
    }),
    permissions: ['email:send'],
    requiresAuth: true,
    risk: 2,
    timeoutMs: 30_000,
    retry: { maxAttempts: 2, backoffMs: 1500 },
    verification: 'provider_message_id',
    available: () => toolAvailable('email'),
    unavailableReason: availability.email.reason,
  },
  voice: {
    name: 'voice',
    description: 'Speak to the citizen or transcribe their reply.',
    capabilities: ['speak', 'transcribe'],
    inputSchema: z.object({ text: text.optional(), lang: z.string().optional() }),
    outputSchema: z.object({ spoken: z.boolean(), transcript: z.string().optional() }),
    permissions: [],
    requiresAuth: false,
    risk: 0,
    timeoutMs: 20_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'none',
    available: () => toolAvailable('voice'),
  },
  documents: {
    name: 'documents',
    description: 'Keep a citizen-supplied document for an authorised upload.',
    capabilities: ['store', 'attach'],
    inputSchema: z.object({ name: z.string(), dataUrl: z.string() }),
    outputSchema: z.object({ documentId: z.string(), name: z.string() }),
    permissions: ['documents:write'],
    requiresAuth: false,
    risk: 1,
    timeoutMs: 15_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'upload_confirmation',
    available: () => toolAvailable('documents'),
  },
  service_discovery: {
    name: 'service_discovery',
    description: 'Identify the verified body responsible for a problem.',
    capabilities: ['search', 'resolve_jurisdiction'],
    inputSchema: discoveryInput,
    outputSchema: z.object({
      services: z.array(
        z.object({
          id: z.string(),
          department: z.string(),
          jurisdiction: z.string(),
          officialUrl: z.string().optional(),
          serviceUrl: z.string().optional(),
          officialEmail: z.string().optional(),
          verifiedAt: z.string(),
        }),
      ),
    }),
    permissions: ['network:read'],
    requiresAuth: false,
    risk: 0,
    timeoutMs: 15_000,
    retry: { maxAttempts: 2, backoffMs: 800 },
    verification: 'registry_match',
    available: () => toolAvailable('service_discovery'),
  },
  profile: {
    name: 'profile',
    description: 'Read confirmed citizen details with provenance.',
    capabilities: ['read'],
    inputSchema: z.object({ fields: z.array(z.string()).optional() }),
    outputSchema: z.object({
      values: z.record(z.string(), z.object({ value: z.string().nullable(), provenance: z.string() })),
    }),
    permissions: ['profile:read'],
    requiresAuth: false,
    risk: 0,
    timeoutMs: 5_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'none',
    available: () => toolAvailable('profile'),
  },
  complaints: {
    name: 'complaints',
    description: 'Create, submit or read a civic complaint through the connector layer.',
    capabilities: ['create', 'submit', 'status'],
    inputSchema: complaintInput,
    outputSchema: z.object({
      ok: z.boolean(),
      id: z.string().optional(),
      reference: z.string().nullable().optional(),
      status: z.string().optional(),
      mode: z.string().optional(),
    }),
    permissions: ['complaints:write'],
    requiresAuth: false,
    risk: 2,
    timeoutMs: 20_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'connector_reference',
    available: () => toolAvailable('complaints'),
  },
  notifications: {
    name: 'notifications',
    description: 'Show a local notification about task progress.',
    capabilities: ['notify'],
    inputSchema: z.object({ title: text, body: text }),
    outputSchema: z.object({ shown: z.boolean() }),
    permissions: ['notifications:send'],
    requiresAuth: false,
    risk: 1,
    timeoutMs: 5_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'none',
    available: () => toolAvailable('notifications'),
  },
  location: {
    name: 'location',
    description: 'Read the device location for jurisdiction checks.',
    capabilities: ['read'],
    inputSchema: z.object({}),
    outputSchema: z.object({ label: z.string().nullable(), lat: z.number().optional(), lng: z.number().optional() }),
    permissions: ['location:read'],
    requiresAuth: false,
    risk: 0,
    timeoutMs: 8_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'none',
    available: () => toolAvailable('location'),
  },
  http: {
    name: 'http',
    description: 'Call an allowlisted official endpoint with a named credential.',
    capabilities: ['get', 'post'],
    inputSchema: httpInput,
    outputSchema: z.object({ status: z.number(), body: z.unknown() }),
    permissions: ['network:write'],
    requiresAuth: true,
    risk: 2,
    timeoutMs: 20_000,
    retry: { maxAttempts: 2, backoffMs: 1000 },
    verification: 'http_response',
    available: () => toolAvailable('http'),
  },
  replay: {
    name: 'replay',
    description: 'Read the recorded history of a task or complaint.',
    capabilities: ['read'],
    inputSchema: z.object({ taskId: z.string().optional(), complaintId: z.string().optional() }),
    outputSchema: z.object({ events: z.array(z.record(z.string(), z.unknown())) }),
    permissions: [],
    requiresAuth: false,
    risk: 0,
    timeoutMs: 5_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    verification: 'none',
    available: () => toolAvailable('replay'),
  },
}

export function getTool(name: ToolName): ToolSpec {
  return TOOL_REGISTRY[name]
}

export function allTools(): ToolSpec[] {
  return Object.values(TOOL_REGISTRY)
}

/** Tools the planner may use right now. */
export function availableTools(): ToolSpec[] {
  return allTools().filter((tool) => tool.available())
}

export type { ToolSpec }