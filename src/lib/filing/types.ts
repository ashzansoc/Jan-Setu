/** Shared filing types for the mobile client (mirrors server/filing/registry). */
export interface GovService {
  id: string
  department: string
  name: string
  jurisdiction: string
  officialWebsite: string
  applicationUrl: string
  operations: string[]
  requiredInfo: {
    id: string
    label: string
    type: string
    required: boolean
    category: 'A' | 'B' | 'C' | 'D' | 'E'
    sensitive?: boolean
  }[]
  requiredDocuments: string[]
  authRequirements: string[]
  knownLimitations?: string
  lastVerified: string
}