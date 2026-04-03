# Audit TODO (Prioritized)

## P0 - Critical before production/mobile release

- [x] Move Gemini calls server-side (do not ship `VITE_API_KEY` in client).
  - Why: browser env vars are public and can be exfiltrated.
  - Files: `src/services/geminiService.ts`.
  - Done when: app calls a backend/API route for AI; key is only in server env.

- [x] Remove render-time state mutation in App.
  - Why: `setShowAckForAlertId` is called during render and can cause unstable render loops.
  - Files: `src/App.tsx` (around ack modal logic).
  - Done when: modal selection is computed in `useEffect`/memoized state transitions only.

- [x] Add fall-detection cooldown and confirmation window.
  - Why: current logic can dispatch many fall alerts in seconds from noisy sensor spikes.
  - Files: `src/components/patient/PatientView.tsx`.
  - Done when: a fall alert has debounce/cooldown and duplicate suppression.

- [x] Fix native notification listener leak.
  - Why: listener is added every `schedule()` call and never removed.
  - Files: `src/services/localNotifications.ts`.
  - Done when: listener is registered once (module init) and cleaned up on app teardown.

- [x] Remove duplicate code trees and keep a single source of truth.
  - Why: root `components/`, `services/`, `context/`, `types.ts` diverge from `src/*`.
  - Done when: only `src/*` (and intended server/demo files) remain active.

## P1 - Important reliability and maintainability

- [x] Resolve dependency vulnerabilities and pin updated versions.
  - Current: `npm audit` reports 6 vulnerabilities (incl. high in Playwright).
  - Files: `package.json`.

- [x] Standardize package manager usage.
  - Why: project currently runs with npm, but `.gitignore` treats pnpm as canonical; tunnel script requires `pnpm` + `jq`.
  - Files: `.gitignore`, `scripts/start-tunnel.sh`, docs.

- [x] Replace Tailwind CDN runtime script with local build pipeline.
  - Files: `index.html`.
  - Done when: Tailwind is built via PostCSS/Vite, no CDN dependency.

- [x] Remove committed local cert files and document local generation.
  - Files: `localhost.pem`, `localhost-key.pem`.

- [x] Cap in-memory remote action dedupe set.
  - Why: `appliedRemoteActions` grows unbounded.
  - Files: `src/context/AppContext.tsx`.

## P2 - Quality, DX, and test coverage

- [x] Replace `alert()` UX with accessible in-app toasts/modals.
- [x] Reduce verbose production logging.
- [x] Consolidate markdown docs (`INFO.md`, `memora_readme.md`, `hi.md`) into one canonical README set.
- [x] Add tests for reducer flows, reminder scheduling, and realtime routing.
- [x] Add CI workflow (`test + build`) for PRs.
