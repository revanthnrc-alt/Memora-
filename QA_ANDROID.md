# Android QA Checklist

Use this checklist before shipping Android builds.

## Setup

1. Build web assets:
```bash
npm run build:android
```
2. Install native speech plugin for AI Companion voice on Android (first time only):
```bash
npm install @capacitor-community/speech-recognition
```
3. Sync Capacitor Android project after dependency changes:
```bash
npx cap sync android
```
4. Verify native voice wiring:
```bash
npm run verify:voice
```
5. Set server env for AI endpoints:
- `GEMINI_API_KEY` on backend (demo server or Vercel)

## Core Functional Scenarios

1. Login and dashboard routing
- Open app, login through Demo Login.
- Verify Patient/Caregiver/Family views render correctly.
- Verify reconnect status dot changes on connect/disconnect.

2. AI Companion voice input
- Open Patient -> AI Companion.
- Confirm diagnostics show: `native platform yes`, `native plugin yes`.
- If voice is unavailable, confirm diagnostics reason is explicit (for example: `plugin_sync_missing`, `recognizer_unavailable`, `bridge_unimplemented`) and action text is shown.
- Tap `Copy diagnostics` and confirm JSON includes `nativeAvailabilityReason`.
- Tap `Run voice self-test` and verify a pass/fail message appears within ~6s.
- Tap microphone, speak, stop.
- Verify transcript appears and only one AI reply is generated.
- Deny microphone permission once, verify clear permission error text appears.

3. Voice Recorder permissions
- Deny mic permission, retry record.
- Verify non-blocking toast appears and app remains usable.
- Grant mic permission and verify recording/playback works.

4. Reminder notifications (foreground + background)
- Add reminder 1-2 minutes ahead.
- Verify notification appears at scheduled time.
- Verify `Complete`, `Snooze`, `Dismiss` actions update app state correctly.
- Background app and lock screen, verify behavior remains correct.

5. Fall/SOS flow
- Simulate fall from Caregiver panel.
- Verify acknowledgment modal appears for Caregiver/Family only.
- Verify patient does not see caregiver/family-only acknowledgment modal.

6. Realtime offline/reconnect
- Connect with demo server.
- Disable network for 20-30s, perform actions while offline.
- Re-enable network.
- Verify reconnect occurs automatically and queued actions continue.

7. Memory upload path
- Upload valid image from Family view.
- Verify upload progress/toast feedback and verified state.
- Verify patient Memory Album shows image and caption.

## Regression/Quality checks

- No browser `alert()` popups remain.
- No console errors in normal usage.
- Test with HTTPS dev and production (Vercel) endpoints.
- Validate performance on mid-tier Android device (smooth navigation and audio playback).

## Pass Criteria

- All scenarios above succeed without crashes or blocked UI.
- Notifications, permissions, and reconnect recoveries are deterministic.
- Build and tests pass:
```bash
npm run test:run
npm run build
```
