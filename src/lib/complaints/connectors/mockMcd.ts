import type { Category, ComplaintDraft, Stage } from '@/lib/complaints/types'
import type { Connector, StatusResult, SubmitResult } from './types'

/**
 * Sandbox connector.
 *
 * It exists so the whole workflow is demonstrable end to end, and it is
 * deliberately incapable of pretending: every result carries mode 'sandbox',
 * the source name says so, and it will never advance a complaint to
 * "resolved" — only a real authority can confirm that.
 */

const CATEGORY_CODE: Record<Category, string> = {
  sanitation: 'SAN',
  streetlight: 'LGT',
  water: 'WTR',
  road: 'RD',
  drainage: 'DRN',
  electricity: 'ELE',
  other: 'CIV',
}

const STORAGE_KEY = 'jansetu.sandbox.registry.v1'

type Registry = Record<string, { submittedAt: number; category: Category }>

function readRegistry(): Registry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Registry) : {}
  } catch {
    return {}
  }
}

function writeRegistry(registry: Registry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry))
  } catch {
    /* storage full or blocked — the session still works, it just won't survive reload */
  }
}

function makeReference(category: Category, seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const serial = String(10000 + (hash % 89999)).slice(0, 5)
  const year = String(new Date().getFullYear()).slice(-2)
  return `MCD-${CATEGORY_CODE[category]}-${year}-${serial}`
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const mockMcdConnector: Connector = {
  id: 'mcd',
  label: 'MCD sandbox',
  sandboxed: true,
  onlineFiling: true,

  async submit(draft: ComplaintDraft): Promise<SubmitResult> {
    await wait(850)

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        ok: false,
        reference: null,
        mode: 'sandbox',
        source: 'JANSETU sandbox',
        message: 'offline',
      }
    }

    const reference = makeReference(draft.category, `${draft.location.label}|${Date.now()}`)
    const registry = readRegistry()
    registry[reference] = { submittedAt: Date.now(), category: draft.category }
    writeRegistry(registry)

    return {
      ok: true,
      reference,
      mode: 'sandbox',
      source: 'JANSETU sandbox',
    }
  },

  async status(reference: string): Promise<StatusResult> {
    await wait(240)
    const entry = readRegistry()[reference]
    if (!entry) {
      return {
        ok: false,
        stage: 'submitted',
        mode: 'sandbox',
        source: 'JANSETU sandbox',
        updatedAt: new Date().toISOString(),
      }
    }

    const elapsed = Date.now() - entry.submittedAt
    // Acknowledgement arrives quickly in the sandbox so the demo can show the
    // transition. There is no path to 'resolved' — that requires a real
    // authority to confirm completion.
    const stage: Stage = elapsed > 6000 ? 'acknowledged' : 'submitted'

    return {
      ok: true,
      stage,
      mode: 'sandbox',
      source: 'JANSETU sandbox',
      updatedAt: new Date().toISOString(),
    }
  },
}
