# Point & Say UI — Project Context

## Project Overview

Point & Say UI is a multimodal, agentic UI automation tool built for the Amazon Nova AI Hackathon. It allows developers to point at UI elements on a live web interface and speak natural language commands to modify them. The system operates on a single pipeline: identifying the target component via DOM grounding, generating code modifications with the Nova Premier model, applying them instantly via Vite HMR, and verifying changes visually via Nova Act or Nova 2 Lite Vision. Finally, it uses Amazon Polly to confirm the change via a natural voice output.

**Architecture:**
- **Frontend:** React 19, Vite, TypeScript, Material UI (MUI), Emotion, Web Speech API, and MediaPipe Hands (for finger tracking).
- **Backend:** Python (FastAPI), Boto3 (for AWS services), Pillow, websockets.
- **AI Models:**
  - `Nova Premier` for Code Generation.
  - `Nova 2 Lite` for visual grounding and fallback verification.
  - `Nova Act` for post-edit UI verification in a headless browser.
  - `Amazon Polly` for neural text-to-speech.

## Building and Running

### Prerequisites
- Node.js 18+
- Python 3.10+
- AWS Account with Bedrock access (or use mock mode without it).
- Environment Variables setup: copy `.env.example` to `.env` and fill `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.

### Starting the Project

1. **Frontend (Vite Server)**
   Run these commands from the project root:
   ```bash
   npm install
   npm run dev
   ```
   The frontend runs at `http://localhost:5173`.

2. **Backend (FastAPI Server)**
   Run these commands from the `server` directory:
   ```bash
   cd server
   pip install -r requirements.txt
   python main.py
   ```
   The API runs at `http://localhost:8000`.

### Testing
- Backend tests can be run using `pytest` within the `server` directory:
  ```bash
  cd server
  pytest tests/test_services.py
  ```

## Development Conventions

- **Frontend Styling:** The UI adheres to a dark glassmorphism aesthetic (Deep dark `#0c0c14` with warm salmon/orange `#fb8c66` accents, frosted glass effects, and the "Plus Jakarta Sans" typography).
- **Code Generation & Prompting:** Changes made by Nova models rely heavily on the context injected from the source code analysis. The generation aims to prevent hallucinated imports and broken exports.
- **System Extensibility:** A bridging mechanism allows external projects to be targeted by injecting a bridge script to establish `postMessage` communication between the target application and the Point & Say system.
- **Verification & Revertibility:** Every automated change is verifiable through Nova Act, with an option to `undo` (up to 20 recent actions) natively tracked by the backend.
- **Fallback Mechanisms:** In cases where AWS capabilities are missing or fail, the system elegantly degrades to mock visual targeting and fallback Voice TTS via the browser Web Speech API.