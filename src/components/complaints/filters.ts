export type FilterKey = 'all' | 'approval' | 'active' | 'resolved'

export const FILTERS: FilterKey[] = ['all', 'approval', 'active', 'resolved']

export function isFilterKey(value: string): value is FilterKey {
  return (FILTERS as string[]).includes(value)
}
