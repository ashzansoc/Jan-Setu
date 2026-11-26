# JANSETU

**Your voice. Your rights. Your actions.**

A voice-first civic services app for India. A citizen speaks naturally — Hindi, English,
Hinglish, Bengali or Tamil — and JANSETU turns that speech into a structured, human-approved,
verifiable municipal complaint.

Not a chatbot. An agent: **speak → understand → plan → clarify → consent → execute → verify → replay.**

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

That is the whole setup. No API keys, no database, no network calls.

Voice input needs the Web Speech API: **Chrome, Edge, or Safari**, on `https://` or `localhost`.
Everywhere else the mic reports a clear message and the **Type instead** path runs the identical pipeline.

Optional API process (only needed to route intent extraction through a real model):

```bash
cp .env.example .env      # set AI_API_KEY, AI_BASE_URL, AI_MODEL, VITE_AI_MODE=remote
npm run dev:all           # web + api together
```

```bash
npm run typecheck    # tsc, strict
npm run build        # production bundle
npm run preview      # serve the build
```

Verification harnesses (need the dev server running, plus `npx playwright install chromium`):

```bash
node scripts/shoot.mjs all /            # screenshots at 360/390/430/768/1440
node scripts/shoot.mjs phone /complaints
node scripts/flow.mjs                   # speak→clarify→understand→preview→submit→replay
node scripts/qa.mjs                     # onboarding, TTS wiring, every route
node scripts/action-flow.mjs            # full task: clarify → plan → approve → verify
node scripts/action-edges.mjs           # vague request, unconfigured email/browser
node scripts/action-resume.mjs          # restart mid-task, pause/resume, no duplicates
node scripts/action-recipient.mjs       # recipient handoff, no fabricated send
node scripts/mictest.mjs                # no-ASR and no-microphone fallbacks
node scripts/my-complaints.mjs          # 30 assertions: filters, search, edit, approve, assist, reopen
node scripts/my-complaints-2.mjs        # see-all, sorting, hide-demo, FAB, detail, replay
node scripts/replay-audio.mjs           # player speaks, advances, seeks, switches language
node scripts/replay-shot.mjs            # replay screenshots at 390x844
```

---

## My Complaints

`/complaints` is the management surface: voice search, three live counters, status
filters, and a section per thing the citizen might need to do.

- **Waiting for your "yes"** — complaints the agent prepared but has not sent.
  *Hear & approve* reads the full text aloud, then requires an explicit tap;
  *Edit* takes a spoken or typed amendment and folds it in without discarding
  anything already collected.
- **In progress** — acknowledged and in-flight records, each with its reference,
  verification provenance and a Replay link. The floating mic starts a new
  complaint without leaving the page.
- **Assisted filing** — when a department has no online channel (Delhi Jal Board
  today), JANSETU says so, offers the helpline, and records the citizen's own
  confirmation separately from official verification.
- **Resolved** — closure source, date and reference, plus *"Is this issue actually
  fixed now?"* → confirm, or reopen, which re-files through the connector and
  keeps the earlier history.

Search understands *"kaunsi complaints pending hain?"*, *"meri streetlight
complaint dikhao"*, *"jo complaint resolve nahi hui woh dikhao"* and a bare
reference number. It only narrows on what it can read confidently — category,
status bucket, reference, named locality — and ignores the rest rather than
guessing.

### Lifecycle

```
draft → awaiting_approval → approved → submitted → acknowledged → in_progress → resolved
                                   ↘ assisted_filing → user_confirmed_submission
resolved → reopened → submitted            (rejected / failed are terminal-ish exits)
```

Every mutation goes through `canTransition` in `src/lib/complaints/status.ts`, so
no screen can invent a state the system cannot justify. Resolution carries a
source — `official` or `user_confirmed` — and those stay distinguishable in the
data, not just in the copy.

## Voice Action Replay

`/replay/:id` follows the Stitch design: a dark hero player over a colour-coded
nine-step timeline.

- The player is real. Play narrates every recorded step in sequence through
  `speechSynthesis`, the counter and waveform track progress, and the language
  pill (हिंदी / English / বাংলা) and speed control change the voice on the fly.
- Each step card is a play target — tap any of them to hear that step alone.
- Step colours and connector lines come from the design; the pending step is
  dashed with a flag and the honest note that resolution needs official
  confirmation.
- *Receipt* opens the reference and its provenance; *Share* uses the native share
  sheet, falling back to the clipboard.

## What is real, and what is simulated

This is a hackathon build and it says so in the UI.

| Area | Status |
|---|---|
| Speech recognition, speech synthesis, mic levels | **Real** — Web Speech API, with graceful capability detection |
| Intent extraction, slot filling, clarifications | **Real** — deterministic Indic engine, no network |
| Consent, complaint generation, lifecycle, replay | **Real** |
| Persistence | **Real** — localStorage behind a swappable repository |
| Municipal submission | **Simulated by design.** The connector returns `mode: 'sandbox'`, the UI labels every such record *"Demo status — simulated data"*, and no record can reach **Resolved** without a real authority response |
| Assisted filing | **Real workflow, simulated department.** The helpline connector never returns a reference; the citizen's confirmation is stored as `mode: 'user'` |
| Bengali / Tamil | **Voice only.** Recognition and synthesis work; interface text is English |

There is no code path that claims an official verification it did not receive. The seed
complaint's "Verified from MCD portal" wording in the original design is deliberately
**not** reproduced — a sandbox record must not say that.

---

## Architecture

```
src/
├── lib/
│   ├── ai/            engine.ts (deterministic NLU) · lexicon.ts · remote.ts (optional LLM)
│   ├── voice/         asr.ts · tts.ts · levels.ts
│   ├── complaints/    types · departments · compose · repository · seed
│   │                  connectors/ (types · mockMcd · registry)
│   ├── i18n/          en · hi (full) — typed against one dictionary shape
│   ├── flow.ts        conversation state machine (ASR ⇄ engine ⇄ TTS ⇄ navigation)
│   └── format.ts
├── state/             zustand: settings · conversation · complaints
├── components/        MicOrb · Waveform · Header · ProgressTracker · BottomNav · ui/
├── screens/           Home · Welcome · Understand · Preview · Replay · Complaints · Profile
└── server/            optional Hono proxy — keys stay server-side
```

Three separations hold everywhere: **reasoning never executes**, **execution goes through a
connector interface**, and **verification is a value on the record, not a label on a screen**.

### Swapping in a real municipal integration

Implement `Connector` (`src/lib/complaints/connectors/types.ts`) — `submit`, `status` — and
register it in `registry.ts`. Set `sandboxed: false` and have `submit` return
`mode: 'live'` with the authority's own reference. Nothing else in the app changes.

### The mic orb

Five layers sized as percentages of one container, so the composition holds from a 360px
phone to a 560px desktop column. While listening, ring scale and waveform bars are driven
from `AnalyserNode` RMS written straight to CSS custom properties — no React re-render per
frame. Five states: idle (breathing), listening (audio-reactive), processing, speaking, error.

---

## Action Intelligence Engine

`/actions` is the Action Centre: the citizen states an objective in natural language and the
engine decides the work.

```
speak/type → ActionIntentEngine → ActionPlanner → ActionPermissionEngine
           → ActionExecutionEngine (persistent) → ActionVerificationEngine
```

- **Client orchestrator, server tools.** The plan and state machine live in `src/lib/action/`;
  `browser`, `email`, `http` and `service_discovery` are real HTTP calls to `server/action/`,
  which holds every credential. Local tools (complaints, voice, profile, places, documents,
  replay) run in-process and work offline.
- **Intent, not keywords.** `intent.ts` splits multi-goal requests, classifies each clause, and
  extracts entities; a remote model is consulted only when the deterministic pass is unsure, and
  its output is schema-validated. Vague requests ("solve my electricity issue") produce a
  clarifying question instead of an arbitrary workflow.
- **Plans are data.** Nine skills in `skills.ts` declare their steps; `planner.ts` expands them
  with dependencies and a consent gate. Eleven tools in `registry.ts` declare schemas, risk,
  timeout, retry and verification method.
- **Approval is bound to the payload.** Risk ≥ 2 requires explicit consent, recorded against the
  plan hash and payload fingerprint; a material change re-asks.
- **Verification never assumes.** `verified` requires `mode: 'live'` evidence. A sandbox
  complaint reference yields `partially_verified` with the reason spelled out, and an
  irreversible step whose outcome is uncertain becomes `unknown` rather than being retried.
- **Durable.** Every transition and step result is written to `jansetu.actions.v1` immediately, so
  a task survives a restart and resumes from the last verified step. Verified by killing the page
  mid-workflow: the plan is restored, approval is still required, and no duplicate complaint appears.
- **Pausable.** Pause takes effect at the next step boundary — never mid-action, so an
  irreversible step that has started is allowed to finish — and Resume continues from there.

Configured integrations: `SKYVERN_BASE_URL` + `SKYVERN_API_KEY` (browser), `GMAIL_CLIENT_ID` +
`GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN` (email), `ACTION_HTTP_ALLOWLIST` (HTTP). With none
set, those tasks stop at a clearly labelled failure naming what is missing — they never fake a
submission, a send or a reference.

## Icons

Every icon in the app comes from **Tabler Icons** (`@tabler/icons-react`). Icons are
sized and stroked through props (`size`, `stroke`, `className`) rather than
hand-written SVG, so stroke weight and colour follow the theme. The only inline SVGs
left are the brand illustrations (logo tile, avatars), which are artwork rather than
interface icons.

## Design tokens

Locked to the reference: ivory `#FFF9F3`, peach `#FFF0E7`, orange `#FF762F`, coral `#F45162`,
ink `#17171D`, muted `#89868A`, indigo `#34349B`, success `#16A477`. Inter for Latin,
Noto Sans Devanagari/Bengali/Tamil self-hosted via fontsource so Hindi never falls back to a
system font.

---

## Accessibility

44px targets, visible focus rings on ivory, `aria-live` on listening state and transcripts,
`aria-pressed` on the mic, labelled icons, and reduced motion honoured from both the OS and
the in-app preference.
