# Repository Guidelines

## Project Structure & Module Organization
- Main app code lives in `src/`:
  - `src/components/` for UI by role (`patient/`, `caregiver/`, `family/`, `shared/`, `icons/`)
  - `src/services/` for integrations (Gemini, realtime WebSocket, notifications, audio)
  - `src/context/` for global state and app providers
  - `src/hooks/` for device/sensor hooks
- Static media is in `public/` and `src/assets/`.
- Demo backend is isolated in `demo-server/` (Express + WebSocket).
- Legacy mirrored folders (`components/`, `services/`, `context/`) exist at repo root; prefer editing `src/` unless intentionally working with legacy files.

## Build, Test, and Development Commands
- `npm install` installs app dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally.
- `npm --prefix demo-server install` installs demo server dependencies.
- `npm --prefix demo-server start` runs demo server on port `8081`.
- `./scripts/start-tunnel.sh` and `./scripts/stop-tunnel.sh` manage tunnel helpers used for device demos.

## Coding Style & Naming Conventions
- Language: TypeScript + React functional components.
- Indentation: 2 spaces; keep imports grouped and ordered by local convention.
- Components/files: `PascalCase` (`PatientView.tsx`); hooks: `useCamelCase`; services/utilities: `camelCase`.
- Prefer strict typing over `any`; if `any` is required, keep scope narrow and document why.
- Keep role-specific UI in role folders, and shared primitives in `src/components/shared/`.

## Testing Guidelines
- No formal automated test suite is currently configured.
- Validate changes with:
  - `npm run build` (required before PR)
  - Manual checks in browser and on a physical mobile device for sensor/camera/mic/notification flows
  - Demo sync checks against `demo-server` when touching realtime features
- If you add tests, use Playwright (already in dev dependencies) and place them under `tests/` with `*.spec.ts` naming.

## Commit & Pull Request Guidelines
- Existing history uses short, task-focused messages (for example, `image fix`, `Update localNotifications.ts`).
- Use clear imperative commits: `fix(realtime): handle reconnect queue`.
- PRs should include:
  - concise summary and affected areas
  - linked issue/task (if available)
  - validation evidence (`npm run build`, device/manual test notes)
  - screenshots/video for UI changes
