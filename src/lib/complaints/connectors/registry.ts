import type { Connector } from './types'
import { mockMcdConnector } from './mockMcd'
import { helplineConnector } from './helpline'

/**
 * Connector lookup. Adding a real municipal integration means registering it
 * here; no screen or engine needs to know it exists.
 */
const CONNECTORS: Record<string, Connector> = {
  [mockMcdConnector.id]: mockMcdConnector,
  [helplineConnector.id]: helplineConnector,
}

export function getConnector(id: string): Connector {
  return CONNECTORS[id] ?? mockMcdConnector
}

export type { Connector, StatusResult, SubmitResult } from './types'
