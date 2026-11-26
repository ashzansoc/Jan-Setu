import { z } from 'zod'
import type { ActionGoal, ActionIntent, GoalKind, SpeechLang, UiLang } from './types'
import { analyze, normalize } from '@/lib/ai/engine'
import { matchSkills } from './skills'

/**
 * Converts what the citizen said into structured objectives.
 *
 * The deterministic pass is the source of truth: it understands action verbs,
 * clause boundaries and code-mixed phrasing, and it always runs. A remote model
 * is consulted only when that pass is unsure, and its answer is schema-validated
 * before it can influence the plan.
 */

const GOAL_KINDS: GoalKind[] = [
  'complaint_registration',
  'email_send',
  'status_check',
  'document_upload',
  'application_submit',
  'follow_up',
  'information_request',
]

const EMAIL_TERMS = ['email', 'mail', 'bhejo', 'bhej do', 'bhej', 'ईमेल', 'मेल', 'पत्र']
const STATUS_TERMS = ['status', 'kya hua', 'ka kya hua', 'kya hua hai', 'track', 'tracking', 'स्थिति', 'क्या हुआ']
const UPLOAD_TERMS = ['upload', 'attach', 'attachment', 'document', 'documents', 'proof', 'दस्तावेज़', 'अपलोड']
const APPLY_TERMS = ['application', 'apply', 'form', 'portal', 'registration', 'आवेदन', 'फॉर्म']
const FOLLOWUP_TERMS = ['follow up', 'followup', 'follow-up', 'reminder', 'remind', 'yaad dilao', 'याद दिलाओ', 'फॉलो']
const COMPLAINT_TERMS = ['complaint', 'complain', 'report', 'shikayat', 'shikayate', 'शिकायत', 'शिकायतें']

const VAGUE_VERBS = ['solve', 'fix', 'handle', 'deal with', 'sort out', 'theek karo', 'hal karo', 'samasya']
const SPECIFIC_TERMS = [
  'outage',
  'power cut',
  'load shedding',
  'bill',
  'meter',
  'connection',
  'streetlight',
  'garbage',
  'kachra',
  'water',
  'paani',
  'road',
  'pothole',
  'naali',
  'drain',
]

const CONSUMER_PATTERN =
  /(?:consumer|cons no|account|meter|upbhokta|उपभोक्ता)\s*(?:number|no\.?|संख्या|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i
const REFERENCE_PATTERN = /\b(mcd|mnd|swm|wtr|ele|rd|drn)-[a-z]{2,4}-\d{2}-\d{4,5}\b/i

const llmGoalSchema = z.object({
  goals: z.array(
    z.object({
      kind: z.enum(GOAL_KINDS as [GoalKind, ...GoalKind[]]),
      description: z.string().min(3).max(200),
      category: z.string().max(40).optional(),
    }),
  ),
})

function splitClauses(text: string): string[] {
  const parts = text
    .split(/(?:\band also\b|\band then\b|\band\b|\bour\b|aur|phir|evam|;|\n|,\s*(?=[a-z\u0900-\u097F]))/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 3)
  return parts.length ? parts : [text.trim()]
}

function detectKind(clause: string, categoryIsKnown: boolean): GoalKind {
  const text = clause.toLowerCase()
  if (FOLLOWUP_TERMS.some((term) => text.includes(term))) return 'follow_up'
  if (EMAIL_TERMS.some((term) => text.includes(term))) return 'email_send'
  if (UPLOAD_TERMS.some((term) => text.includes(term))) return 'document_upload'
  if (APPLY_TERMS.some((term) => text.includes(term))) return 'application_submit'
  if (STATUS_TERMS.some((term) => text.includes(term))) return 'status_check'
  if (COMPLAINT_TERMS.some((term) => text.includes(term)) || categoryIsKnown) {
    return 'complaint_registration'
  }
  return 'information_request'
}

function kindLabel(kind: GoalKind, text: string): string {
  switch (kind) {
    case 'complaint_registration':
      return text
    case 'email_send':
      return 'Send an email to the department'
    case 'status_check':
      return 'Check the current status'
    case 'document_upload':
      return 'Upload a supporting document'
    case 'application_submit':
      return 'Submit an application on the official portal'
    case 'follow_up':
      return 'Send a follow-up on the existing complaint'
    default:
      return text
  }
}

async function refineWithModel(request: string): Promise<ActionGoal[] | null> {
  if (import.meta.env.VITE_AI_MODE !== 'remote') return null
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system:
          'You convert a citizen request into a JSON list of goals. kind must be one of ' +
          GOAL_KINDS.join(', ') +
          '. Return {"goals":[{"kind","description"}]} only. Never invent facts.',
        prompt: request,
        json: true,
      }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { ok?: boolean; text?: string }
    if (!payload.ok || !payload.text) return null
    const parsed = llmGoalSchema.safeParse(JSON.parse(payload.text))
    if (!parsed.success) return null
    return parsed.data.goals.map((goal, index) => ({
      id: `goal-${index + 1}`,
      kind: goal.kind,
      description: goal.description,
      category: goal.category as ActionGoal['category'],
    }))
  } catch {
    return null
  }
}

export async function understand(
  raw: string,
  options: { uiLang: UiLang; speechLang: SpeechLang },
): Promise<ActionIntent> {
  const request = raw.trim()
  const clauses = splitClauses(request)
  const extraction = analyze(request, { speechLang: options.speechLang }).extraction

  const goals: ActionGoal[] = clauses.map((clause, index) => {
    const clauseCategory = analyze(clause, { speechLang: options.speechLang }).extraction
    const known = clauseCategory.category !== 'other' && clauseCategory.categoryConfidence >= 0.55
    const kind = detectKind(clause, known)
    return {
      id: `goal-${index + 1}`,
      kind,
      description: kindLabel(kind, clause),
      category: known ? clauseCategory.category : undefined,
      problem: known ? clauseCategory.problemEn : undefined,
    }
  })

  let confidence =
    goals.filter((goal) => goal.kind !== 'information_request').length / Math.max(1, goals.length)

  // Only ask the model when the deterministic pass could not decide.
  if (confidence < 0.6) {
    const refined = await refineWithModel(request)
    if (refined && refined.length) {
      goals.splice(0, goals.length, ...refined)
      confidence = 0.75
    }
  }

  const reference = request.match(REFERENCE_PATTERN)?.[0]?.toUpperCase() ?? null
  const consumer = request.match(CONSUMER_PATTERN)?.[1]?.toUpperCase() ?? null

  const missing: ActionIntent['missing'] = []
  const needsLocation = goals.some((goal) => goal.kind === 'complaint_registration')
  if (needsLocation && !extraction.location) {
    missing.push({
      field: 'location',
      reason: 'The department cannot be chosen without a locality.',
      source: 'user',
    })
  }
  if (goals.some((goal) => goal.kind === 'email_send')) {
    missing.push({ field: 'recipient', reason: 'An official address must be verified.', source: 'discovery' })
    missing.push({ field: 'body', reason: 'The email needs a subject and message.', source: 'user' })
  }
  if (goals.some((goal) => goal.kind === 'status_check') && !reference) {
    missing.push({ field: 'reference', reason: 'A reference number is needed to look it up.', source: 'user' })
  }

  const suggestedSkills = goals
    .flatMap((goal) => matchSkills(request, goal.kind).map((skill) => skill.id))
    .filter((id, index, all) => all.indexOf(id) === index)

  // "Solve my electricity issue" names a service but not a problem. Asking which
  // problem it is prevents an arbitrary workflow being started.
  const requestText = request.toLowerCase()
  const isVague =
    VAGUE_VERBS.some((verb) => requestText.includes(verb)) &&
    !SPECIFIC_TERMS.some((term) => requestText.includes(term))

  const needsClarification =
    isVague ||
    goals.length === 0 ||
    (confidence < 0.5 && goals.every((goal) => goal.kind === 'information_request'))

  return {
    id: `intent-${Date.now().toString(36)}`,
    originalRequest: request,
    language: options.uiLang,
    speechLang: options.speechLang,
    goals,
    entities: {
      location: extraction.location,
      department: null,
      reference,
      consumerNumber: consumer,
    },
    missing,
    suggestedSkills,
    confidence: Number(confidence.toFixed(2)),
    needsClarification,
    clarification: needsClarification
      ? isVague
        ? options.uiLang === 'hi'
          ? 'समस्या क्या है — बिजली गुल है, बिल गलत है, कनेक्शन चाहिए, या कुछ और?'
          : 'What exactly is the problem — a power cut, a wrong bill, a new connection, or something else?'
        : options.uiLang === 'hi'
          ? 'क्या आप बता सकते हैं कि आप क्या करवाना चाहते हैं — शिकायत दर्ज करनी है, ईमेल भेजना है, या स्थिति पूछनी है?'
          : 'Could you tell me what you would like done — file a complaint, send an email, or check a status?'
      : undefined,
  }
}

export { normalize }