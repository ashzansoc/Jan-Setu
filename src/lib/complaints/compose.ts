import type { Category, ComplaintDraft, Department, UiLang } from '@/lib/complaints/types'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { forPastDuration, formatDurationDays } from '@/lib/format'

export interface ComposedComplaint {
  subject: string
  body: string
}

interface ComposeInput {
  category: Category
  locationLabel: string
  durationDays?: number | null
  urgency: 'normal' | 'high'
  department: Department
  transcript: string
}

/**
 * Turns structured fields into the text a municipal desk clerk can act on.
 * Written as a citizen's report, not as a machine dump — the wording is part of
 * the product's credibility.
 */
export function composeComplaint(input: ComposeInput, lang: UiLang): ComposedComplaint {
  const { category, locationLabel, durationDays, urgency, department, transcript } = input
  const categoryLabel = CATEGORY_LABEL[category][lang]

  const subject = `${categoryLabel} — ${locationLabel}`

  const durationLine =
    durationDays && durationDays > 0
      ? lang === 'hi'
        ? `यह समस्या ${forPastDuration(durationDays, 'hi')} बनी हुई है (लगभग ${formatDurationDays(durationDays, 'hi')})।`
        : lang === 'hinglish'
          ? `Yeh samasya ${forPastDuration(durationDays, 'en')} bani hui hai (lagbhag ${formatDurationDays(durationDays, 'en')}).`
          : `The issue has persisted ${forPastDuration(durationDays, 'en')}.`
      : lang === 'hi'
        ? 'यह समस्या कुछ समय से बनी हुई है।'
        : lang === 'hinglish'
          ? 'Yeh samasya kuch time se bani hui hai.'
          : 'The issue has been present for some time.'

  const urgencyLine =
    urgency === 'high'
      ? lang === 'hi'
        ? 'यह मामला तत्काल ध्यान मांगता है और सुरक्षा से जुड़ा जोखिम है।'
        : lang === 'hinglish'
          ? 'Is mamle ko turant dhyan chahiye aur safety ka khatra hai.'
          : 'This needs urgent attention and carries a safety risk.'
      : lang === 'hi'
        ? 'कृपया उचित कार्रवाई की जाए।'
        : lang === 'hinglish'
          ? 'Kripya uchit karwai ki jaye.'
          : 'Please take appropriate action.'

  const body = lang === 'hi'
    ? [
        `सेवा में,`,
        `${department.jurisdiction} — ${department.name}`,
        ``,
        `विषय: ${subject}`,
        ``,
        `महोदय,`,
        ``,
        `मैं ${locationLabel} निवासी/निवासी-समुदाय की ओर से सूचित कर रहा/रही हूँ कि ${CATEGORY_LABEL[category].hi} की समस्या है।`,
        durationLine,
        urgencyLine,
        ``,
        `नागरिक द्वारा बोले गए शब्द:`,
        `“${transcript.trim()}”`,
        ``,
        `यह शिकायत जनसेतु के माध्यम से नागरिक की सहमति से दर्ज की गई है।`,
        ``,
        `धन्यवाद।`,
      ].join('\n')
    : lang === 'hinglish'
      ? [
          `Seva mein,`,
          `${department.jurisdiction} — ${department.name}`,
          ``,
          `Vishay: ${subject}`,
          ``,
          `Mahoday,`,
          ``,
          `Main ${locationLabel} ke nivasi/nivasi-samuday ki or se soochit kar raha/rahi hoon ki ${CATEGORY_LABEL[category].hinglish} ki samasya hai।`,
          durationLine,
          urgencyLine,
          ``,
          `Nagrik dwara bole gaye shabd:`,
          `“${transcript.trim()}”`,
          ``,
          `Yeh shikayat JANSETU ke dwara nagrik ki sehmati se darj ki gayi hai।`,
          ``,
          `Dhanyavaad।`,
        ].join('\n')
      : [
          `To,`,
          `${department.jurisdiction} — ${department.name}`,
          ``,
          `Subject: ${subject}`,
          ``,
          `Sir/Madam,`,
          ``,
          `I am reporting, on behalf of residents of ${locationLabel}, the following civic issue: ${CATEGORY_LABEL[category].en}.`,
          durationLine,
          urgencyLine,
          ``,
          `Words spoken by the citizen:`,
          `“${transcript.trim()}”`,
          ``,
          `This complaint was filed through JANSETU with the citizen's explicit consent.`,
          ``,
          `Thank you.`,
        ].join('\n')

  return { subject, body }
}

export function draftToComposeInput(draft: ComplaintDraft): ComposeInput {
  return {
    category: draft.category,
    locationLabel: draft.location.label,
    durationDays: draft.durationDays ?? null,
    urgency: draft.urgency,
    department: draft.department,
    transcript: draft.transcript,
  }
}
