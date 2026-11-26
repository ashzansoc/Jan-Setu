import { z } from 'zod'

/**
 * Organisation & Service Registry — the destinations JANSETU is allowed to act on.
 *
 * Rules encoded here:
 * - A portal is only reachable if its host appears in `hosts`; the browser
 *   provider refuses anything else before opening a page.
 * - `verification` is honest: `documented` means the URL is the organisation's
 *   well-known public domain but has not been exercised by this build;
 *   `exercised` would mean a real read-only run succeeded.
 * - Nothing here claims an integration "works" — that is what `verification`
 *   and the runtime result are for.
 */

export type ServiceCategory =
  | 'electricity'
  | 'water'
  | 'municipal'
  | 'epf'
  | 'pension'
  | 'grievance'
  | 'other'

export interface OrgService {
  id: string
  label: string
  /** What the user is trying to do. */
  purpose: 'complaint' | 'status' | 'grievance' | 'application'
  /** Page the workflow starts from. */
  entryUrl: string
  /** Identifiers the portal needs before a complaint can be filed. */
  identifiers: string[]
  /** How the portal authenticates. */
  auth: 'none' | 'otp' | 'password' | 'both' | 'unknown'
  /** Free-text notes that must not be presented as verified fact. */
  limitations?: string
}

export interface Organisation {
  id: string
  name: string
  category: ServiceCategory
  /** Jurisdiction this entry applies to. */
  jurisdiction: string
  /** Official host(s). The browser will refuse any other host. */
  hosts: string[]
  officialUrl: string
  services: OrgService[]
  verification: 'documented' | 'exercised'
  verifiedAt: string
  sourceNote: string
}

const EPFO: Organisation = {
  id: 'epfo',
  name: 'Employees’ Provident Fund Organisation',
  category: 'epf',
  jurisdiction: 'India',
  hosts: ['epfindia.gov.in', 'epfo.gov.in', 'unifiedportal-mem.epfindia.gov.in', 'epfigms.gov.in'],
  officialUrl: 'https://www.epfindia.gov.in',
  verification: 'documented',
  verifiedAt: '2026-11-26',
  sourceNote: 'Public EPFO domains; EPFiGMS is the grievance portal linked from epfindia.gov.in.',
  services: [
    {
      id: 'epfo.member.passbook',
      label: 'View PF passbook / balance',
      purpose: 'status',
      entryUrl: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/',
      identifiers: ['UAN', 'password'],
      auth: 'both',
    },
    {
      id: 'epfo.claim.status',
      label: 'Check claim status',
      purpose: 'status',
      entryUrl: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/',
      identifiers: ['UAN', 'password'],
      auth: 'both',
    },
    {
      id: 'epfo.grievance',
      label: 'Register an EPF grievance (EPFiGMS)',
      purpose: 'grievance',
      entryUrl: 'https://epfigms.gov.in/',
      identifiers: ['UAN', 'mobile'],
      auth: 'otp',
      limitations: 'Grievance categories and required fields are defined by EPFiGMS and must be read from the live form.',
    },
  ],
}

const BRPL: Organisation = {
  id: 'bses.brpl',
  name: 'BSES Rajdhani Power Limited (BRPL)',
  category: 'electricity',
  jurisdiction: 'Delhi — South, South West, West, Central (BRPL area)',
  hosts: ['bsesdelhi.com', 'www.bsesdelhi.com'],
  officialUrl: 'https://www.bsesdelhi.com',
  verification: 'documented',
  verifiedAt: '2026-11-26',
  sourceNote: 'BRPL is served by bsesdelhi.com; the complaint workflow lives behind the consumer login.',
  services: [
    {
      id: 'brpl.complaint',
      label: 'Register an electricity complaint',
      purpose: 'complaint',
      entryUrl: 'https://www.bsesdelhi.com',
      identifiers: ['CA number'],
      auth: 'otp',
      limitations: 'Complaint form and OTP step are behind the consumer area; read them live before acting.',
    },
    {
      id: 'brpl.status',
      label: 'Check complaint status',
      purpose: 'status',
      entryUrl: 'https://www.bsesdelhi.com',
      identifiers: ['CA number'],
      auth: 'otp',
    },
  ],
}

const BYPL: Organisation = {
  ...BRPL,
  id: 'bses.bypl',
  name: 'BSES Yamuna Power Limited (BYPL)',
  jurisdiction: 'Delhi — East, Central East (BYPL area)',
  services: BRPL.services.map((service) => ({ ...service, id: service.id.replace('brpl.', 'bypl.') })),
}

const TPDDL: Organisation = {
  id: 'tpddl',
  name: 'Tata Power Delhi Distribution Limited (TPDDL)',
  category: 'electricity',
  jurisdiction: 'Delhi — North and North West (TPDDL area)',
  hosts: ['tatapower-ddl.com', 'www.tatapower-ddl.com'],
  officialUrl: 'https://www.tatapower-ddl.com',
  verification: 'documented',
  verifiedAt: '2026-11-26',
  sourceNote: 'TPDDL publishes its consumer services on tatapower-ddl.com.',
  services: [
    {
      id: 'tpddl.complaint',
      label: 'Register an electricity complaint',
      purpose: 'complaint',
      entryUrl: 'https://www.tatapower-ddl.com',
      identifiers: ['CA number'],
      auth: 'otp',
      limitations: 'Complaint form must be read from the live portal before acting.',
    },
    {
      id: 'tpddl.status',
      label: 'Check complaint status',
      purpose: 'status',
      entryUrl: 'https://www.tatapower-ddl.com',
      identifiers: ['CA number'],
      auth: 'otp',
    },
  ],
}

const CPGRAMS: Organisation = {
  id: 'cpgrams',
  name: 'Centralised Public Grievance Redress and Monitoring System',
  category: 'grievance',
  jurisdiction: 'India (central ministries and departments)',
  hosts: ['pgportal.gov.in', 'www.pgportal.gov.in'],
  officialUrl: 'https://pgportal.gov.in',
  verification: 'documented',
  verifiedAt: '2026-11-26',
  sourceNote: 'CPGRAMS is the Government of India grievance portal at pgportal.gov.in.',
  services: [
    {
      id: 'cpgrams.grievance',
      label: 'Lodge a grievance with a central department',
      purpose: 'grievance',
      entryUrl: 'https://pgportal.gov.in',
      identifiers: ['mobile', 'email'],
      auth: 'otp',
    },
    {
      id: 'cpgrams.status',
      label: 'Track a lodged grievance',
      purpose: 'status',
      entryUrl: 'https://pgportal.gov.in',
      identifiers: ['registration number'],
      auth: 'otp',
    },
  ],
}

const MCD: Organisation = {
  id: 'mcd',
  name: 'Municipal Corporation of Delhi',
  category: 'municipal',
  jurisdiction: 'Delhi',
  hosts: ['mcdonline.nic.in', 'www.mcdonline.nic.in'],
  officialUrl: 'https://mcdonline.nic.in',
  verification: 'documented',
  verifiedAt: '2026-11-26',
  sourceNote: 'MCD’s citizen services run on mcdonline.nic.in. Sanitation complaints may also be routed via 311/helpline rather than the portal.',
  services: [
    {
      id: 'mcd.sanitation',
      label: 'Register a sanitation / civic complaint',
      purpose: 'complaint',
      entryUrl: 'https://mcdonline.nic.in',
      identifiers: ['mobile', 'ward', 'address'],
      auth: 'otp',
      limitations: 'Ward-level form fields must be read from the live portal; several MCD services are helpline-only.',
    },
    {
      id: 'mcd.status',
      label: 'Check a civic complaint status',
      purpose: 'status',
      entryUrl: 'https://mcdonline.nic.in',
      identifiers: ['complaint number'],
      auth: 'otp',
    },
  ],
}

export const ORGANISATIONS: Organisation[] = [EPFO, BRPL, BYPL, TPDDL, CPGRAMS, MCD]

export function findOrganisation(id: string): Organisation | undefined {
  return ORGANISATIONS.find((organisation) => organisation.id === id)
}

export function findService(serviceId: string): { organisation: Organisation; service: OrgService } | undefined {
  for (const organisation of ORGANISATIONS) {
    const service = organisation.services.find((entry) => entry.id === serviceId)
    if (service) return { organisation, service }
  }
  return undefined
}

/** Every host the managed browser is permitted to open. */
export function approvedHosts(): string[] {
  return ORGANISATIONS.flatMap((organisation) => organisation.hosts)
}

export function isApprovedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return approvedHosts().some((approved) => host === approved || host.endsWith(`.${approved}`))
}

/** Shape exposed to the client — no internal notes that could read as guarantees. */
export const orgSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  jurisdiction: z.string(),
  officialUrl: z.string(),
  verification: z.string(),
  services: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      purpose: z.string(),
      identifiers: z.array(z.string()),
      auth: z.string(),
    }),
  ),
})