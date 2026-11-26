import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Place {
  id: string
  nickname: string
  alias: string
  line1: string
  locality: string
  pincode: string
  zone: string
  ward: string
  geoVerified: boolean
  isDefault: boolean
  tone: 'orange' | 'purple' | 'gray'
  shortcut: boolean
}

export interface Helper {
  id: string
  name: string
  relation: string
  phone: string
  whatsapp: boolean
  canApprove: boolean
}

interface PlacesState {
  places: Place[]
  helpers: Helper[]
  addPlace: (place: Omit<Place, 'id'>) => void
  updatePlace: (id: string, patch: Partial<Place>) => void
  removePlace: (id: string) => void
  makeDefault: (id: string) => void
  addHelper: (helper: Omit<Helper, 'id'>) => void
  updateHelper: (id: string, patch: Partial<Helper>) => void
  removeHelper: (id: string) => void
}

const SEED_PLACES: Place[] = [
  {
    id: 'home',
    nickname: 'घर (Home)',
    alias: 'घर / My Home',
    line1: 'S-214, Greater Kailash 2, New Delhi - 110048',
    locality: 'Greater Kailash 2',
    pincode: '110048',
    zone: 'MCD South Zone',
    ward: 'Ward 88',
    geoVerified: true,
    isDefault: true,
    tone: 'orange',
    shortcut: true,
  },
  {
    id: 'daughter',
    nickname: "बेटी का घर (Daughter's House)",
    alias: 'बेटी के यहाँ',
    line1: 'B-42, Lajpat Nagar 4, New Delhi - 110024',
    locality: 'Lajpat Nagar 4',
    pincode: '110024',
    zone: 'MCD Central Zone',
    ward: 'Ward 54',
    geoVerified: false,
    isDefault: false,
    tone: 'purple',
    shortcut: true,
  },
]

const SEED_HELPERS: Helper[] = [
  {
    id: 'priya',
    name: 'Priya Devi',
    relation: 'बेटी / Daughter',
    phone: '+91 9811••••92',
    whatsapp: true,
    canApprove: true,
  },
]

export const usePlaces = create<PlacesState>()(
  persist(
    (set) => ({
      places: SEED_PLACES,
      helpers: SEED_HELPERS,

      addPlace: (place) =>
        set((state) => ({
          places: [...state.places, { ...place, id: `place-${Date.now()}` }],
        })),

      updatePlace: (id, patch) =>
        set((state) => ({
          places: state.places.map((place) => (place.id === id ? { ...place, ...patch } : place)),
        })),

      removePlace: (id) =>
        set((state) => {
          const remaining = state.places.filter((place) => place.id !== id)
          // A list without a default would leave the voice picker with no anchor.
          if (remaining.length && !remaining.some((place) => place.isDefault)) {
            remaining[0] = { ...remaining[0], isDefault: true }
          }
          return { places: remaining }
        }),

      makeDefault: (id) =>
        set((state) => ({
          places: state.places.map((place) => ({ ...place, isDefault: place.id === id })),
        })),

      addHelper: (helper) =>
        set((state) => ({
          helpers: [...state.helpers, { ...helper, id: `helper-${Date.now()}` }],
        })),

      updateHelper: (id, patch) =>
        set((state) => ({
          helpers: state.helpers.map((helper) => (helper.id === id ? { ...helper, ...patch } : helper)),
        })),

      removeHelper: (id) =>
        set((state) => ({ helpers: state.helpers.filter((helper) => helper.id !== id) })),
    }),
    {
      name: 'jansetu.places.v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)