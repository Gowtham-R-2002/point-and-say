# Point & Say UI

**Multimodal, agentic UI automation — point at a component, speak a command, watch it change.**

Point & Say UI lets developers modify live web interfaces by pointing at UI elements and speaking natural language commands. The system identifies the target component via DOM grounding, generates code with Nova Premier, applies it with live hot-reload, verifies the result with Nova Act, and confirms via Amazon Polly voice — all in a single, observable pipeline.

Built for the [Amazon Nova AI Hackathon](https://devpost.com/) · #AmazonNova

---

## How It Works

1. **Point** — Click any element on a running app, or use webcam finger tracking with dwell-to-select (MediaPipe Hands). A component picker popup shows all selectable components at the click point using deterministic DOM grounding.

2. **Say** — Speak a command like "Make this button blue" or "Change the chart title to Q3 Revenue." Nova Sonic handles voice input with Web Speech API as a fallback.

3. **Generate** — Nova Premier receives the component's source code, your intent, and full design system context. It returns the complete modified file.

4. **Apply** — The modified source is written to disk. Vite HMR picks it up instantly — no manual refresh.

5. **Verify** — Nova Act opens a headless browser to visually confirm the change was applied. Nova 2 Lite Vision provides a screenshot-based fallback when Act is unavailable.

6. **Confirm** — Amazon Polly speaks a natural language confirmation of what changed. The reasoning panel shows every pipeline step in real-time.

7. **Undo** — Say "undo" to revert any change. The system maintains a 20-entry undo stack.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     POINT & SAY UI                          │
├───────────────┬─────────────────────┬───────────────────────┤
│   FRONTEND    │   BACKEND (Python)  │   AMAZON NOVA MODELS  │
├───────────────┼─────────────────────┼───────────────────────┤
│ SetupScreen   │ /api/configure      │                       │
│ ComponentPicker│ /api/scan          │                       │
│ ReasoningPanel│ /api/ground ────────→ Nova 2 Lite (Vision)  │
│ StatusBar     │ /api/generate ──────→ Nova Premier (Code)   │
│ PointerDot    │ /api/sonic/* ───────→ Polly (Voice TTS)     │
│ WebcamPreview │ /api/verify ────────→ Nova Act (Verify)     │
│ FingerTracker │ /api/apply          │   + Nova 2 Lite Vision│
│ VoiceCapture  │ /api/undo           │                       │
│ SonicClient   │ scanner.py          │                       │
└───────────────┴─────────────────────┴───────────────────────┘
```

### Model Roles

| Model | Role | Notes |
|-------|------|-------|
| Nova 2 Lite | Visual grounding — identifies which component the user is pointing at from a screenshot | Also used as verification fallback via screenshot analysis |
| Nova Premier | Code generation — takes component source + intent and returns the complete modified file | Flagship model; superior reasoning for complex multi-element edits |
| Amazon Polly | Voice output — neural TTS engine for natural spoken confirmations | Generative engine (Ruth voice) with fallback chain |
| Nova Act | Post-edit verification — opens a headless browser and visually confirms the change was applied | AWS service with IAM auth (us-east-1) |
| Nova 2 Lite Vision | Verification fallback — analyzes before/after screenshots when Nova Act is unavailable | Same model as grounding, different prompt |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- AWS account with Bedrock access (optional — mock mode works without it)

### Setup

```bash
git clone https://github.com/Gowtham-R-2002/point-and-say.git
cd point-and-say

# Frontend
npm install

# Backend
cd server
pip install -r requirements.txt
cd ..

# Environment
cp .env.example .env
# Add your AWS credentials to .env:
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
#   AWS_REGION=us-east-1
```

### Run

```bash
# Terminal 1 — Frontend (Vite)
npm run dev

# Terminal 2 — Backend (FastAPI)
cd server
python main.py
```

Frontend at `http://localhost:5173`, API at `http://localhost:8000`.

### Usage

1. The setup screen appears — project path is pre-filled, click "Connect & Start"
2. Click any dashboard element (stat card, chart, button, etc.)
3. The component picker popup shows matching components — click to select
4. Press Space or click the mic button and speak a command
5. Watch the reasoning panel on the right show every pipeline step
6. Code changes apply instantly via Vite HMR
7. Nova verifies the change and confirms via voice
8. Say "undo" to revert

For hands-free mode, click the finger tracking icon in the header to enable webcam input — hover over a component for 1.5 seconds to auto-select it.




## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, AWS status, project config |
| POST | `/api/configure` | Set project root and dev server URL |
| GET | `/api/project-info` | Current project config and scan results |
| POST | `/api/scan` | Scan a directory for components |
| GET | `/api/components` | Component registry |
| POST | `/api/ground` | Visual grounding (screenshot → component ID) |
| POST | `/api/generate` | Code generation (intent → modified source) |
| POST | `/api/apply-code` | Write modified code to file (triggers HMR) |
| POST | `/api/undo` | Revert last code change |
| POST | `/api/verify` | Verify change via Nova Act or Nova 2 Lite Vision |
| GET | `/api/component-source/:name` | Read a component's source code |
| POST | `/api/sonic/transcribe` | Speech-to-text via Nova Sonic |
| POST | `/api/sonic/speak` | Text-to-speech (Polly → Sonic → browser fallback) |

---

## Design

The built-in dashboard uses a dark glassmorphism aesthetic:

- **Typography**: Plus Jakarta Sans
- **Background**: Deep dark `#0c0c14` with warm salmon/orange `#fb8c66` accents
- **Cards**: Frosted glass with `backdrop-filter: blur(24-40px)` and subtle borders
- **Motion**: Staggered entrance animations and smooth transitions

Design references: [Paperpillar's HR Dashboard](https://dribbble.com/shots/26001298), [Oleksandr Kosholap's Channel Analytics](https://dribbble.com/shots/23626622).

---

Built for the Amazon Nova AI Hackathon · #AmazonNova