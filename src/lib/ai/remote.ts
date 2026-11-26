import type { SpeechLang } from '@/lib/complaints/types'
import { API_BASE } from '@/lib/api'
import { PROBLEM_PHRASE } from './lexicon'
import { analyze, computeMissing, type EngineResult, type Extraction } from './engine'

/**
 * Client-side bridge to the optional model step.
 *
 * Contract: always returns a usable EngineResult. If the API is absent,
 * unconfigured, slow, or returns something that doesn't validate, we fall back
 * to the local engine. The user never sees a dead end because of infrastructure.
 */

const REMOTE_ENABLED = import.meta.env.VITE_AI_MODE === 'remote'

interface RemoteExtraction {
  category: Extraction['category']
  categoryConfidence: number
  problemEn: string
  problemHi: string
  location: string | null
  locationConfidence: number
  durationDays: number | null
  urgency: 'normal' | 'high'
  language: Extraction['language']
}

function toExtraction(model: RemoteExtraction): Extraction {
  return {
    category: model.category,
    categoryConfidence: model.categoryConfidence,
    categoryScores: {
      sanitation: 0,
      streetlight: 0,
      water: 0,
      road: 0,
      drainage: 0,
      electricity: 0,
      other: 0,
    },
    problemEn: model.problemEn || PROBLEM_PHRASE[model.category].en,
    problemHi: model.problemHi || PROBLEM_PHRASE[model.category].hi,
    location: model.location,
    locationConfidence: model.locationConfidence,
    durationDays: model.durationDays,
    urgency: model.urgency,
    language: model.language,
    speechLang:
      model.language === 'bn'
        ? 'bn-IN'
        : model.language === 'ta'
          ? 'ta-IN'
          : model.language === 'en'
            ? 'en-IN'
            : 'hi-IN',
  }
}

export async function analyzeInput(
  text: string,
  options: { speechLang?: SpeechLang } = {},
): Promise<EngineResult> {
  const local = () => analyze(text, options)
  if (!REMOTE_ENABLED) return local()

  try {
    const response = await fetch(`${API_BASE}/api/understand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) return local()

    const payload = (await response.json()) as { ok?: boolean; extraction?: RemoteExtraction }
    if (!payload.ok || !payload.extraction) return local()

    const extraction = toExtraction(payload.extraction)

    // The model can misread a clear keyword ("kachra" → streetlight). When the
    // local engine is confident and disagrees, the deterministic reading wins —
    // a wrong department is worse than a missed nuance.
    const localResult = local()
    if (
      localResult.extraction.categoryConfidence >= 0.6 &&
      localResult.extraction.category !== extraction.category
    ) {
      console.info(
        `[jansetu ai] category corrected by lexicon: ${extraction.category} → ${localResult.extraction.category}`,
      )
      return localResult
    }

    return { extraction, missing: computeMissing(extraction) }
  } catch {
    return local()
  }
}
