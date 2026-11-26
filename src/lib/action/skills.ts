import type { GoalKind, SkillSpec } from './types'

/**
 * Skills are independently defined capabilities. The planner picks and combines
 * them; no workflow is hardcoded in a prompt.
 */
export const SKILL_REGISTRY: SkillSpec[] = [
  {
    id: 'register-garbage-complaint',
    description: 'Register a municipal garbage/sanitation complaint.',
    triggers: ['kachra', 'kacra', 'kooda', 'garbage', 'safai', 'dustbin', 'कचरा', 'कूड़ा', 'सफाई'],
    goalKinds: ['complaint_registration'],
    requiredInputs: ['location'],
    optionalInputs: ['duration', 'landmark', 'urgency'],
    tools: ['service_discovery', 'complaints', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'prepare_complaint', tool: 'complaints', risk: 1, labelKey: 'prepare_complaint' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'submit_complaint', tool: 'complaints', risk: 2, labelKey: 'submit_complaint' },
      { action: 'verify_reference', tool: 'complaints', risk: 0, labelKey: 'verify_reference' },
    ],
    permissions: ['complaints:write'],
    approvalRequired: true,
    successCriteria: 'A reference number is returned by the connector and recorded as evidence.',
    failureHandling: 'If no online channel exists, fall back to assisted filing and say so.',
  },
  {
    id: 'register-water-complaint',
    description: 'Register a water supply complaint with the water board.',
    triggers: ['paani', 'pani', 'water', 'tanki', 'jal', 'पानी', 'जल', 'टंकी'],
    goalKinds: ['complaint_registration'],
    requiredInputs: ['location'],
    optionalInputs: ['duration', 'urgency'],
    tools: ['service_discovery', 'complaints', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'check_online_channel', tool: 'service_discovery', risk: 0, labelKey: 'check_online_channel' },
      { action: 'prepare_complaint', tool: 'complaints', risk: 1, labelKey: 'prepare_complaint' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'submit_complaint', tool: 'complaints', risk: 2, labelKey: 'submit_complaint' },
      { action: 'verify_reference', tool: 'complaints', risk: 0, labelKey: 'verify_reference' },
    ],
    permissions: ['complaints:write'],
    approvalRequired: true,
    successCriteria: 'A reference is recorded, or the task ends in assisted filing with the helpline.',
    failureHandling: 'Delhi Jal Board has no online filing channel — offer the helpline instead of faking a reference.',
  },
  {
    id: 'register-electricity-complaint',
    description: 'Register an electricity outage or supply complaint with the distribution company.',
    triggers: ['bijli', 'bijlee', 'power cut', 'powercut', 'load shedding', 'meter', 'electricity', 'बिजली', 'मीटर'],
    goalKinds: ['complaint_registration'],
    requiredInputs: ['location'],
    optionalInputs: ['consumerNumber', 'duration', 'urgency'],
    tools: ['service_discovery', 'complaints', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'prepare_complaint', tool: 'complaints', risk: 1, labelKey: 'prepare_complaint' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'submit_complaint', tool: 'complaints', risk: 2, labelKey: 'submit_complaint' },
      { action: 'verify_reference', tool: 'complaints', risk: 0, labelKey: 'verify_reference' },
    ],
    permissions: ['complaints:write'],
    approvalRequired: true,
    successCriteria: 'A reference is recorded from the connector response.',
    failureHandling: 'Ask for the consumer number if the provider requires it; never invent one.',
  },
  {
    id: 'send-department-email',
    description: 'Draft and send an email to a verified department address.',
    triggers: ['email', 'mail', 'bhejo', 'bhej do', 'ईमेल', 'मेल'],
    goalKinds: ['email_send'],
    requiredInputs: ['recipient', 'subject', 'body'],
    optionalInputs: ['attachments'],
    tools: ['service_discovery', 'email', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'find_official_contact', tool: 'service_discovery', risk: 0, labelKey: 'find_official_contact' },
      { action: 'draft_email', tool: 'email', risk: 1, labelKey: 'draft_email' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'send_email', tool: 'email', risk: 2, labelKey: 'send_email' },
      { action: 'verify_email', tool: 'email', risk: 0, labelKey: 'verify_email' },
    ],
    permissions: ['email:send'],
    approvalRequired: true,
    successCriteria: 'The provider returns a message id, which is stored as evidence.',
    failureHandling: 'If no account is connected, stop at NOT_CONFIGURED and tell the citizen to connect one.',
  },
  {
    id: 'check-complaint-status',
    description: 'Read the current verified status of an existing complaint.',
    triggers: ['status', 'kya hua', 'ka kya hua', 'स्थिति', 'क्या हुआ'],
    goalKinds: ['status_check'],
    requiredInputs: ['reference'],
    optionalInputs: [],
    tools: ['complaints', 'notifications'],
    workflow: [
      { action: 'read_status', tool: 'complaints', risk: 0, labelKey: 'read_status' },
      { action: 'notify_user', tool: 'notifications', risk: 1, labelKey: 'notify_user' },
    ],
    permissions: ['complaints:write'],
    approvalRequired: false,
    successCriteria: 'A status read from the connector is reported, with its source.',
    failureHandling: 'Report the last known status and say it could not be refreshed.',
  },
  {
    id: 'submit-government-application',
    description: 'Complete and submit an application on an official portal via the browser.',
    triggers: ['application', 'form', 'portal', 'apply', 'आवेदन', 'फॉर्म'],
    goalKinds: ['application_submit'],
    requiredInputs: ['location', 'service'],
    optionalInputs: ['consumerNumber', 'documents'],
    tools: ['service_discovery', 'browser', 'profile', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'open_portal', tool: 'browser', risk: 1, labelKey: 'open_portal' },
      { action: 'collect_missing', tool: 'profile', risk: 0, labelKey: 'collect_missing' },
      { action: 'fill_form', tool: 'browser', risk: 1, labelKey: 'fill_form' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'submit_form', tool: 'browser', risk: 2, labelKey: 'submit_form' },
      { action: 'extract_reference', tool: 'browser', risk: 0, labelKey: 'extract_reference' },
    ],
    permissions: ['browser:control'],
    approvalRequired: true,
    successCriteria: 'The portal acknowledgement yields a reference number.',
    failureHandling: 'Pause for CAPTCHA/OTP and resume the same session; never bypass verification.',
  },
  {
    id: 'upload-supporting-documents',
    description: 'Attach citizen-supplied documents to an application.',
    triggers: ['upload', 'document', 'attach', 'bill', 'proof', 'दस्तावेज़', 'अपलोड'],
    goalKinds: ['document_upload'],
    requiredInputs: ['document'],
    optionalInputs: ['service'],
    tools: ['documents', 'browser', 'voice'],
    workflow: [
      { action: 'collect_documents', tool: 'documents', risk: 1, labelKey: 'collect_documents' },
      { action: 'open_portal', tool: 'browser', risk: 1, labelKey: 'open_portal' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'upload_documents', tool: 'browser', risk: 2, labelKey: 'upload_documents' },
      { action: 'verify_upload', tool: 'browser', risk: 0, labelKey: 'verify_upload' },
    ],
    permissions: ['documents:write', 'browser:control'],
    approvalRequired: true,
    successCriteria: 'The portal confirms the upload succeeded.',
    failureHandling: 'Never attach a private document without explicit authorisation.',
  },
  {
    id: 'request-department-follow-up',
    description: 'Prepare and send a follow-up on an existing complaint.',
    triggers: ['follow up', 'followup', 'reminder', 'yaad dilao', 'फॉलो', 'याद दिलाओ'],
    goalKinds: ['follow_up'],
    requiredInputs: ['reference'],
    optionalInputs: ['location'],
    tools: ['complaints', 'service_discovery', 'voice'],
    workflow: [
      { action: 'identify_department', tool: 'service_discovery', risk: 0, labelKey: 'identify_department' },
      { action: 'prepare_complaint', tool: 'complaints', risk: 1, labelKey: 'prepare_follow_up' },
      { action: 'request_approval', tool: 'voice', risk: 0, labelKey: 'request_approval' },
      { action: 'submit_complaint', tool: 'complaints', risk: 2, labelKey: 'submit_follow_up' },
      { action: 'verify_reference', tool: 'complaints', risk: 0, labelKey: 'verify_reference' },
    ],
    permissions: ['complaints:write'],
    approvalRequired: true,
    successCriteria: 'A new reference for the follow-up is recorded.',
    failureHandling: 'Keep the original reference intact and link the follow-up to it.',
  },
  {
    id: 'retrieve-application-status',
    description: 'Look up an application status on the official portal.',
    triggers: ['application status', 'track', 'क्या हुआ', 'ट्रैक'],
    goalKinds: ['status_check'],
    requiredInputs: ['reference'],
    optionalInputs: ['service'],
    tools: ['browser', 'notifications'],
    workflow: [
      { action: 'open_portal', tool: 'browser', risk: 1, labelKey: 'open_portal' },
      { action: 'read_status', tool: 'browser', risk: 0, labelKey: 'read_status' },
      { action: 'notify_user', tool: 'notifications', risk: 1, labelKey: 'notify_user' },
    ],
    permissions: ['browser:control'],
    approvalRequired: false,
    successCriteria: 'The status shown on the portal is reported with its source.',
    failureHandling: 'If login is required, hand off for secure credential entry.',
  },
]

export function getSkill(id: string): SkillSpec | undefined {
  return SKILL_REGISTRY.find((skill) => skill.id === id)
}

export function skillsForGoal(kind: GoalKind): SkillSpec[] {
  return SKILL_REGISTRY.filter((skill) => skill.goalKinds.includes(kind))
}

/** Trigger scoring used before the LLM is consulted. */
export function matchSkills(text: string, kind?: GoalKind): SkillSpec[] {
  const haystack = text.toLowerCase()
  const scored = SKILL_REGISTRY.filter((skill) => !kind || skill.goalKinds.includes(kind))
    .map((skill) => ({
      skill,
      score: skill.triggers.reduce((sum, trigger) => (haystack.includes(trigger) ? sum + 1 : sum), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.skill)
}