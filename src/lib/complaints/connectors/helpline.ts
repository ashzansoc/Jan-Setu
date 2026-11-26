import type { Connector, StatusResult, SubmitResult } from './types'

/**
 * Departments that have no online filing channel.
 *
 * This connector exists so the absence of an integration is a first-class,
 * honest outcome instead of a silent failure: it never returns a reference and
 * the app routes the citizen to assisted filing (a real phone call they make
 * themselves) rather than claiming anything was submitted.
 */
export const helplineConnector: Connector = {
  id: 'helpline',
  label: 'Helpline (no online filing)',
  sandboxed: true,
  onlineFiling: false,

  async submit(): Promise<SubmitResult> {
    return {
      ok: false,
      reference: null,
      mode: 'assisted',
      source: 'No online filing channel',
      message: 'no-online-channel',
    }
  },

  async status(): Promise<StatusResult> {
    return {
      ok: false,
      stage: 'prepared',
      mode: 'assisted',
      source: 'No online filing channel',
      updatedAt: new Date().toISOString(),
    }
  },
}
