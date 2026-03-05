# Point & Say UI — Implementation Plan

> **Goal:** Align everything with the PRD. Honest, working, complete, reliable.
> **Created:** 2026-02-28
> **Last Updated:** 2026-03-11

---

## Phase 0: Foundation (30 min) ✅
- [x] Add `.env` to `.gitignore`
- [x] Rotate AWS credentials in IAM console
- [x] Restore `StatsCards.tsx` to proper 4-card layout
- [x] Fix `api.ts` to use `import.meta.env.VITE_API_URL`
- [x] Clean up empty directories

## Phase 1: Component Picker — Accuracy Upgrade (2 hrs) ✅
- [x] Enrich `data-component` attributes across all dashboard elements
- [x] Build `useComponentPicker.ts` hook — `elementsFromPoint()` + DOM traversal
- [x] Build `ComponentPicker.tsx` — floating glassmorphism popup at click position
- [x] Update `App.tsx` pipeline — click → picker → select → voice → generate
- [x] Nova 2 Lite Vision runs in parallel as confidence indicator

## Phase 1.5: Setup/Config Screen (1–1.5 hrs) ✅
- [x] Build `SetupScreen.tsx` — project path, dev server URL, framework detection
- [x] Backend `/api/configure` + `/api/scan` + `/api/project-info` endpoints
- [x] Dynamic component registry — `scanner.py` auto-discovers components
- [x] Configurable `PROJECT_ROOT` via API
- [x] Auto-detect framework (React/Vue/Next/Angular/Svelte) from package.json

## Phase 2: Voice I/O (1 hr) ✅
- [x] Web Speech API for real-time voice input (STT)
- [x] Amazon Polly for natural TTS output (neural voice engine)
- [x] `SonicClient.ts` — API client with fallback chain (Polly → browser TTS)
- [x] `VoiceCapture.ts` — handles recording, playback, and voice status

## Phase 3: Nova Act Verification (1–2 hrs) ✅
- [x] Nova Act SDK integration with API key configuration
- [x] Nova 2 Lite Vision fallback (screenshot analysis) when Act unavailable
- [x] Verification step wired into App.tsx pipeline (post-HMR screenshot + verify)
- [x] Verification result shown in reasoning panel (✅/❌ + method used)

## Phase 4: Code Generation Hardening (1 hr) ✅
- [x] Nova Premier with adaptive prompts (detects Tailwind, MUI, CSS vars)
- [x] Design system context injected from source code analysis
- [x] 10 explicit rules to prevent hallucinated imports and broken exports
- [x] Common modification patterns documented in prompt (color, text, layout, animation)
- [x] maxTokens 8192, temp 0.05 for determinism

## Phase 5: Camera + Picker UX (1–1.5 hrs) ✅
- [x] Finger dwell-selection: hover 1.5s → auto-open picker (full hands-free)
- [x] Voice selection from picker ("select the first one")
- [x] Keyboard shortcut: Space to toggle voice
- [x] DOM element highlight on picker hover (orange) + selection (green dashed)

## Phase 6: External Project Support (1.5 hrs) ✅
- [x] Bridge script injection into target app's index.html via `/api/configure`
- [x] postMessage communication between iframe (target app) and parent (Point & Say)
- [x] Dynamic component picker via `openPickerWithComponents` (from bridge data)
- [x] Iframe rendering in App.tsx when external project is configured
- [x] Bridge auto-removal on reconfigure

## Phase 7: Polish & Testing (1–2 hrs) ✅
- [x] StatusBar enhanced with model names in status messages
- [x] Keyboard shortcut hint in status bar
- [x] Backend test suite — 17 tests covering scanner, codegen, verification, API
- [ ] End-to-end dry run with nexus-dashboard — manual
- [ ] Record demo video — manual

## Phase 8: Documentation (30 min) ✅
- [x] Update README to match reality
- [x] Update IMPLEMENTATION_PLAN to match reality
- [ ] Write blog post for builder.aws.com (bonus prize — time permitting)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      POINT & SAY UI                         │
├───────────────┬─────────────────────┬───────────────────────┤
│   FRONTEND    │   BACKEND (Python)  │   AMAZON NOVA MODELS  │
├───────────────┼─────────────────────┼───────────────────────┤
│ SetupScreen   │ /api/configure      │                       │
│ ComponentPicker│ /api/scan          │                       │
│ ReasoningPanel│ /api/ground ────────→ Nova 2 Lite (Vision)  │
│ StatusBar     │ /api/generate ──────→ Nova Premier (Code)   │
│ PointerDot    │ /api/sonic/speak ───→ Amazon Polly (TTS)    │
│ WebcamPreview │ /api/verify ────────→ Nova Act (Verify)     │
│ FingerTracker │ /api/apply          │   + Nova 2 Lite Vision│
│ VoiceCapture  │ /api/undo           │                       │
│ SonicClient   │ /api/bridge.js      │                       │
└───────────────┴─────────────────────┴───────────────────────┘
```
