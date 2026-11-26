/**
 * Email tool — real Gmail API.
 *
 * Sends from an authorised account using a server-held OAuth refresh token, and
 * returns the provider's message id, which is the only acceptable evidence that
 * a send happened. With no credentials the tool reports `not-configured`; it
 * never fabricates a message id or a success.
 */

export interface EmailConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export function emailConfig(): EmailConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

export function isEmailConfigured(): boolean {
  return emailConfig() !== null
}

async function accessToken(config: EmailConfig): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error('The email account could not be authorised.')
  }
  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) throw new Error('The email account returned no access token.')
  return payload.access_token
}

function encodeMessage(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ]
  const bytes = new TextEncoder().encode(lines.join('\r\n'))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface EmailSendInput {
  action?: 'draft' | 'send' | 'status'
  to: string
  subject: string
  body: string
  messageId?: string
  attachments?: { name: string; dataUrl: string }[]
}

export interface EmailResult {
  ok: boolean
  status: 'sent' | 'failed' | 'drafted'
  messageId?: string
  threadId?: string
  to?: string
  subject?: string
  body?: string
  reason?: string
}

export async function sendEmail(input: EmailSendInput): Promise<EmailResult> {
  if (input.action === 'draft') {
    return { ok: true, status: 'drafted', to: input.to, subject: input.subject, body: input.body }
  }

  if (input.action === 'status') {
    const config = emailConfig()
    if (!config) return { ok: false, status: 'failed', reason: 'not-configured' }
    if (!input.messageId) return { ok: false, status: 'failed', reason: 'No message id supplied.' }
    try {
      const token = await accessToken(config)
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(input.messageId)}`,
        { headers: { authorization: `Bearer ${token}` } },
      )
      if (!response.ok) return { ok: false, status: 'failed', reason: 'The message could not be read.' }
      const payload = (await response.json()) as { threadId?: string; labelIds?: string[] }
      const sent = (payload.labelIds ?? []).includes('SENT')
      return {
        ok: sent,
        status: sent ? 'sent' : 'failed',
        messageId: input.messageId,
        ...(payload.threadId ? { threadId: payload.threadId } : {}),
        ...(!sent ? { reason: 'The message is not in the sent folder.' } : {}),
      }
    } catch (error) {
      return { ok: false, status: 'failed', reason: (error as Error).message }
    }
  }

  const config = emailConfig()
  if (!config) return { ok: false, status: 'failed', reason: 'not-configured' }
  if (!input.to || !input.subject) {
    return { ok: false, status: 'failed', reason: 'A recipient and subject are required.' }
  }

  try {
    const token = await accessToken(config)
    const raw = encodeMessage(input.to, input.subject, input.body)
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ raw }),
      },
    )
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      return {
        ok: false,
        status: 'failed',
        reason: detail?.error?.message ?? 'The provider rejected the message.',
      }
    }
    const payload = (await response.json()) as { id?: string; threadId?: string }
    if (!payload.id) {
      return { ok: false, status: 'failed', reason: 'The provider did not return a message id.' }
    }
    return {
      ok: true,
      status: 'sent',
      messageId: payload.id,
      ...(payload.threadId ? { threadId: payload.threadId } : {}),
    }
  } catch (error) {
    return { ok: false, status: 'failed', reason: (error as Error).message }
  }
}