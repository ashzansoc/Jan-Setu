import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCircleCheck, IconBuilding, IconCheck, IconHeart, IconHome, IconBulb, IconMapPinPlus, IconMessageCircle, IconMicrophone, IconSettings, IconUserCheck, IconUserPlus, IconUsers, IconVolume } from '@tabler/icons-react'
import { usePlaces, type Place } from '@/state/places'
import { useDict } from '@/lib/i18n'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

const TONE = {
  orange: { chip: 'bg-orange-100 text-orange-600', mic: 'bg-orange-50 text-orange-600' },
  purple: { chip: 'bg-purple-100 text-purple-700', mic: 'bg-purple-50 text-purple-600' },
  gray: { chip: 'bg-gray-200 text-gray-700', mic: 'bg-gray-100 text-gray-600' },
} as const

type Draft = Omit<Place, 'id'>

const EMPTY_DRAFT: Draft = {
  nickname: '',
  alias: '',
  line1: '',
  locality: '',
  pincode: '',
  zone: 'MCD South Zone',
  ward: 'Ward 88',
  geoVerified: false,
  isDefault: false,
  tone: 'gray',
  shortcut: true,
}

export function PlacesScreen() {
  const navigate = useNavigate()
  const d = useDict()
  const { places, helpers, addPlace, updatePlace, removePlace, makeDefault, removeHelper } = usePlaces()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [listening, setListening] = useState(false)

  const openEdit = (place: Place) => {
    setEditing(place.id)
    setDraft({ ...place })
  }

  const openAdd = () => {
    setEditing('new')
    setDraft(EMPTY_DRAFT)
  }

  const save = () => {
    if (!draft.nickname.trim() || !draft.line1.trim()) return
    if (editing === 'new') addPlace(draft)
    else if (editing) updatePlace(editing, draft)
    setEditing(null)
    setDraft(EMPTY_DRAFT)
  }

  const listen = async () => {
    if (listening) {
      cancelSpeech()
      setListening(false)
      return
    }
    setListening(true)
    try {
      await speak(d.places.guidance, { lang: 'hi-IN', rate: 1 })
    } finally {
      setListening(false)
    }
  }

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col pb-[calc(32px+env(safe-area-inset-bottom))]">
        <header className="safe-x sticky top-0 z-30 flex items-center justify-between bg-ivory/85 pb-3 pt-[max(20px,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            aria-label={d.places.goBack}
            onClick={() => navigate('/profile')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
          >
            <IconArrowLeft size={20} stroke={2.2} />
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-[#E65100]">{d.places.eyebrow}</p>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{d.places.title}</h1>
          </div>
          <span className="h-11 w-11" aria-hidden />
        </header>

        <main className="flex-1 px-4 pt-2">
          <div className="flex w-full flex-col pb-8">
            {/* Voice guidance card */}
            <div className="relative mb-4 overflow-hidden rounded-card bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <IconUsers size={20} stroke={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-orange-600">
                      {d.places.voiceHelp}
                    </span>
                    <button
                      type="button"
                      onClick={() => void listen()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition-all active:scale-95"
                    >
                      <IconVolume size={14} stroke={2.2} />
                      <span>{listening ? d.places.listening : d.places.listen}</span>
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-700">{d.places.guidance}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-gray-400">{d.places.guidanceSub}</p>
                </div>
              </div>
            </div>

            {/* Saved addresses */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold leading-tight text-gray-900">{d.places.savedTitle}</h2>
                  <span className="text-xs font-medium text-gray-500">{d.places.savedSub}</span>
                </div>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                  {d.places.activeCount(places.length)}
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 rounded-xl bg-orange-50/80 p-2.5">
                <IconBulb size={18} className="flex-shrink-0 text-orange-600" stroke={2} />
                <p className="text-xs font-medium leading-snug text-orange-900">
                  {d.places.tip} <span className="font-bold">"{d.places.tipHome}"</span>{' '}
                  {d.places.tipOr} <span className="font-bold">"{d.places.tipDaughter}"</span>
                </p>
              </div>

              {places.map((place) => (
                <div key={place.id} className="mb-3 rounded-card bg-card p-4 shadow-card">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl',
                          TONE[place.tone].chip,
                        )}
                      >
                        {place.tone === 'purple' ? (
                          <IconHeart size={20} fill="currentColor" />
                        ) : (
                          <IconHome size={20} stroke={2} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900">{place.nickname}</h3>
                          {place.isDefault && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[0.625rem] font-bold text-green-800">
                              {d.places.defaultBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-[0.6875rem] font-medium text-gray-400">
                          {d.places.aliasLabel}: "{place.alias || place.nickname}"
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={d.places.playAlias}
                      onClick={() => void speak(place.alias || place.nickname, { lang: 'hi-IN', rate: 1 })}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90',
                        TONE[place.tone].mic,
                      )}
                    >
                      <IconMicrophone size={15} stroke={2.2} />
                    </button>
                  </div>

                  <p className="mb-2 text-xs font-semibold leading-relaxed text-gray-800">{place.line1}</p>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-[0.6875rem] font-medium text-gray-600">
                      <IconBuilding size={12} className="text-orange-600" stroke={2.2} />
                      {place.zone} • {place.ward}
                    </span>
                    {place.geoVerified && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-[0.625rem] font-semibold text-green-700">
                        <IconCircleCheck size={12} stroke={2.4} />
                        {d.places.geoVerified}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {!place.isDefault && (
                      <button
                        type="button"
                        onClick={() => makeDefault(place.id)}
                        className="rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-all active:scale-95"
                      >
                        {d.places.makeDefault}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePlace(place.id)}
                      className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 active:scale-95"
                    >
                      {d.places.remove}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(place)}
                      className="rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-200 active:scale-95"
                    >
                      {d.places.edit}
                    </button>
                  </div>
                </div>
              ))}

              {/* Inline edit / add card */}
              {editing && (
                <div className="mb-3 rounded-card bg-card p-4 shadow-card">
                  <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-900">
                        {d.places.editTitle}
                      </h3>
                    </div>
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-orange-600">
                      {d.places.editBadge}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700" htmlFor="place-nick">
                        {d.places.nicknameLabel}
                      </label>
                      <input
                        id="place-nick"
                        type="text"
                        value={draft.nickname}
                        onChange={(event) => setDraft({ ...draft, nickname: event.target.value })}
                        className="w-full rounded-xl bg-stone-50 px-3 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:bg-white focus:shadow-sm"
                      />
                      <p className="mt-1 text-[0.625rem] text-gray-400">{d.places.nicknameHint}</p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700" htmlFor="place-line">
                        {d.places.lineLabel}
                      </label>
                      <input
                        id="place-line"
                        type="text"
                        value={draft.line1}
                        onChange={(event) => setDraft({ ...draft, line1: event.target.value })}
                        className="w-full rounded-xl bg-stone-50 px-3 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:bg-white focus:shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700" htmlFor="place-loc">
                          {d.places.localityLabel}
                        </label>
                        <input
                          id="place-loc"
                          type="text"
                          value={draft.locality}
                          onChange={(event) => setDraft({ ...draft, locality: event.target.value })}
                          className="w-full rounded-xl bg-stone-50 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:bg-white focus:shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700" htmlFor="place-pin">
                          {d.places.pincodeLabel}
                        </label>
                        <input
                          id="place-pin"
                          type="text"
                          value={draft.pincode}
                          onChange={(event) => setDraft({ ...draft, pincode: event.target.value })}
                          className="w-full rounded-xl bg-stone-50 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:bg-white focus:shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5">
                      <div className="flex items-center gap-2">
                        <IconCircleCheck size={16} className="text-emerald-600" stroke={2.2} />
                        <div>
                          <p className="text-[0.6875rem] font-bold leading-tight text-emerald-900">
                            {d.places.wardAuto}
                          </p>
                          <p className="text-[0.625rem] text-emerald-700">
                            {draft.zone} • {draft.ward}
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-white px-2 py-0.5 text-[0.625rem] font-bold text-emerald-800 shadow-xs">
                        {d.places.autoLinked}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{d.places.shortcutTitle}</p>
                        <p className="text-[0.6875rem] text-gray-500">{d.places.shortcutSub}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={d.places.toggleShortcut}
                        aria-pressed={draft.shortcut}
                        onClick={() => setDraft({ ...draft, shortcut: !draft.shortcut })}
                        className={cn(
                          'relative h-6 w-11 rounded-full p-0.5 transition-colors',
                          draft.shortcut ? 'bg-orange-600' : 'bg-gray-300',
                        )}
                      >
                        <span
                          className={cn(
                            'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                            draft.shortcut ? 'translate-x-5' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={save}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-95"
                      >
                        <IconCheck size={14} stroke={3} />
                        <span>{d.places.save}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null)
                          setDraft(EMPTY_DRAFT)
                        }}
                        className="rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-700 transition-all active:scale-95"
                      >
                        {d.places.cancel}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={openAdd}
                className="flex w-full flex-col items-center justify-center gap-0.5 rounded-card bg-card px-4 py-3.5 text-orange-700 shadow-card transition-all active:scale-[0.98]"
              >
                <span className="flex items-center gap-2 text-xs font-bold">
                  <IconMapPinPlus size={16} stroke={2.2} />{d.places.addNew}
                </span>
                <span className="text-[0.625rem] font-medium text-gray-500">
                  {d.places.addNewSub}
                </span>
              </button>
            </div>

            {/* Trusted helper */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold leading-tight text-gray-900">{d.places.helperTitle}</h2>
                  <span className="text-xs font-medium text-gray-500">{d.places.helperSub}</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-800">
                  {d.places.helperBadge}
                </span>
              </div>

              {helpers.map((helper) => (
                <div key={helper.id} className="mb-3 rounded-card bg-card p-4 shadow-card">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <IconUsers size={22} stroke={2} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-gray-900">{helper.name}</h3>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-700">
                            {helper.relation}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-gray-500">
                          <span>{helper.phone}</span>
                          <IconCircleCheck size={12} className="text-green-600" />
                          <span className="text-[0.625rem] font-medium text-green-700">{d.places.otpVerified}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={d.places.helperSettings}
                      onClick={() => removeHelper(helper.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-600 transition-transform active:scale-95"
                    >
                      <IconSettings size={16} stroke={2.2} />
                    </button>
                  </div>

                  <div className="mb-3 space-y-2.5 rounded-xl bg-stone-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconMessageCircle size={14} className="text-emerald-600" stroke={2.2} />
                        <div>
                          <p className="text-xs font-medium text-gray-800">{d.places.helperWhatsapp}</p>
                          <p className="text-[0.625rem] text-gray-400">{d.places.helperWhatsappSub}</p>
                        </div>
                      </div>
                      <span
                        className={cn('h-2.5 w-2.5 rounded-full', helper.whatsapp ? 'bg-green-500' : 'bg-gray-300')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconUserCheck size={14} className="text-orange-600" stroke={2.2} />
                        <div>
                          <p className="text-xs font-medium text-gray-800">{d.places.helperApprove}</p>
                          <p className="text-[0.625rem] text-gray-400">Can approve resolution if you're away</p>
                        </div>
                      </div>
                      <span
                        className={cn('h-2.5 w-2.5 rounded-full', helper.canApprove ? 'bg-green-500' : 'bg-gray-300')}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => removeHelper(helper.id)}
                      className="px-2 py-1 text-xs font-semibold text-rose-600 active:opacity-75"
                    >
                      {d.places.remove}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        usePlaces.getState().updateHelper(helper.id, {
                          canApprove: !helper.canApprove,
                        })
                      }
                      className="rounded-xl bg-orange-100 px-3.5 py-1.5 text-xs font-bold text-orange-800 transition-all active:scale-95"
                    >
                      {d.places.editHelper}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  usePlaces.getState().addHelper({
                    name: d.places.newHelperName,
                    relation: d.places.newHelperRelation,
                    phone: '+91 ••••••••••',
                    whatsapp: true,
                    canApprove: false,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition-all active:scale-95"
              >
                <IconUserPlus size={14} className="text-emerald-600" stroke={2.2} />
                <span>{d.places.addHelper}</span>
              </button>
            </div>

            {/* Quick preview */}
            <div className="mb-4 rounded-card bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-transparent p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <IconMicrophone size={18} className="text-orange-600" stroke={2.2} />
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-900">
                  {d.places.previewTitle}
                </h3>
              </div>
              <div className="mb-2.5 rounded-xl bg-white/90 p-3 backdrop-blur-xs">
                <p className="text-xs font-medium leading-relaxed text-gray-800">
                  <span className="font-bold text-orange-600">{d.places.previewSpeak}</span> "{d.places.previewLine}"
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-gray-600">
                  <IconCircleCheck size={14} className="text-emerald-600" stroke={2.2} />
                  <span>
                    {d.places.previewAuto}{' '}<strong className="text-gray-900">{(places.find((p) => p.isDefault) ?? places[0])?.line1 ?? '—'}</strong>{' '}{d.places.previewPicks}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.625rem] font-semibold text-gray-500">{d.places.shortcutChips}</span>
                {places
                  .filter((place) => place.shortcut)
                  .map((place) => (
                    <span
                      key={place.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.625rem] font-bold shadow-xs',
                        place.tone === 'purple'
                          ? 'bg-purple-100 text-purple-900'
                          : place.tone === 'gray'
                            ? 'bg-gray-200 text-gray-800'
                            : 'bg-orange-100 text-orange-900',
                      )}
                    >
                      {place.tone === 'purple' ? (
                        <IconHeart size={11} fill="currentColor" stroke={2.4} />
                      ) : place.tone === 'gray' ? (
                        <IconBuilding size={11} stroke={2.4} />
                      ) : (
                        <IconHome size={11} stroke={2.4} />
                      )}{' '}
                      {place.nickname} ({place.locality})
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}