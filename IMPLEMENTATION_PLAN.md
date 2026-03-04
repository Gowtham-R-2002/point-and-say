# Point & Say UI v2.0 — Implementation Plan

> **Goal:** Align everything with the PRD. Honest, working, complete, reliable.
> **Created:** 2026-03-05
> **Last Updated:** 2026-03-05

---

## Phase 0: Foundation Fixes (30 min) ✅
- [x] Add `.env` to `.gitignore`
- [x] Rotate AWS credentials in IAM console ✅ (new key)
- [x] Restore `StatsCards.tsx` to proper 4-card layout
- [x] Fix `api.ts` to use `import.meta.env.VITE_API_URL`
- [x] Clean up empty directories (removed `src/agents/`, `server/agents/`, `server/routes/`)

## Phase 1: Component Picker — Accuracy Upgrade (2 hrs) ✅
- [x] Enrich `data-component` attributes across ALL dashboard elements (nested)
- [x] Build `useComponentPicker.ts` hook — `elementsFromPoint()` + DOM traversal
- [x] Build `ComponentPicker.tsx` — floating glassmorphism popup at click position
- [x] Update `App.tsx` pipeline — click → picker → select → voice → generate
- [x] Run Nova Vision in parallel as confidence indicator (not primary grounding)

## Phase 1.5: Setup/Config Screen (1-1.5 hrs) ✅
- [x] Build `SetupScreen.tsx` — project path, dev server URL, framework detection
- [x] Backend `/api/configure` + `/api/scan` + `/api/project-info` endpoints
- [x] Dynamic component registry — `scanner.py` auto-discovers components
- [x] Configurable `PROJECT_ROOT` via API
- [x] Auto-detect framework (React/Vue/Next/Angular/Svelte) from package.json

## Phase 2: Nova 2 Sonic Integration (2-3 hrs) ✅
- [x] Research Nova 2 Sonic bidirectional streaming API
- [x] Build `SonicClient.ts` — audio recording + streaming to backend
- [x] Build `server/services/sonic.py` — Nova Sonic session with full event protocol
- [x] Update `VoiceCapture.ts` — Sonic mode for TTS + Web Speech API fallback
- [x] Backend `/api/sonic/transcribe` + `/api/sonic/speak` endpoints

## Phase 3: Nova Act Verification (1-2 hrs) ✅
- [x] Nova Act SDK integration with API key configuration
- [x] Nova Lite Vision fallback (screenshot analysis) when Act unavailable
- [x] Verification step wired into App.tsx pipeline (post-HMR screenshot + verify)
- [x] Verification result shown in reasoning panel (✅/❌ + method used)

## Phase 4: Code Generation Hardening (1 hr) ✅
- [x] Improved prompt with full design system context (CSS custom properties, tokens)
- [x] Added 10 explicit rules to prevent hallucinated imports and broken exports
- [x] Common modification patterns documented in prompt (color, text, layout, animation)
- [x] Bumped maxTokens to 8192, temp to 0.05 for large components and determinism

## Phase 5: Camera + Picker UX (1-1.5 hrs) ✅
- [x] Finger dwell-selection: hover 1.5s → auto-open picker (full hands-free)
- [x] Voice selection from picker ("select the first one") already in Phase 1
- [x] Keyboard shortcut: Space to toggle voice
- [x] DOM element highlight on picker hover (orange) + selection (green dashed)

## Phase 6: Polish & Testing (1-2 hrs) ✅
- [x] StatusBar enhanced with Nova model names in status messages
- [x] Keyboard shortcut hint in status bar
- [x] Voice confirmation uses Nova Sonic → browser TTS fallback chain
- [x] Verification pipeline: post-HMR screenshot → Nova Act/Nova Lite → result
- [ ] End-to-end testing (10+ commands) — manual, time permitting
- [ ] Record demo video — manual

## Phase 7: Documentation Alignment (30 min) ✅
- [x] Update README to match reality
- [x] Update IMPLEMENTATION_PLAN to match reality
- [ ] Write blog post for builder.aws.com (bonus prize — time permitting)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    POINT & SAY UI v2.0                      │
├───────────────┬─────────────────────┬───────────────────────┤
│   FRONTEND    │    BACKEND (Python)  │   AMAZON NOVA MODELS  │
├───────────────┼─────────────────────┼───────────────────────┤
│ SetupScreen   │ /api/configure      │                       │
│ ComponentPicker│ /api/scan          │                       │
│ ReasoningPanel│ /api/ground ────────→│ Nova Lite (Vision)   │
│ StatusBar     │ /api/generate ──────→│ Nova Lite (CodeGen)  │
│ PointerDot    │ /api/sonic/* ───────→│ Nova Sonic (Voice)   │
│ WebcamPreview │ /api/verify ────────→│ Nova Act (Verify)    │
│ FingerTracker │ /api/apply          │   + Nova Lite Vision  │
│ VoiceCapture  │ /api/undo           │                       │
│ SonicClient   │ scanner.py          │                       │
└───────────────┴─────────────────────┴───────────────────────┘
```
