# SightLine


---

**A real-time AI visual companion for visually impaired users, built on Gemini Live.**

Most AI accessibility tools work in batch. You take a photo, wait a few seconds, get a description, and ask your follow-up into the void. By the time the answer comes back, the moment is gone — you've already crossed the street, missed the sign, lost the conversation.

SightLine runs continuously. Point your camera, speak naturally, and Gemini sees what you see and talks back in real time. Not a request-response loop. An actual live conversation — with context, follow-ups, and no manual triggers.

---

## Live Demo

**App:** https://sightline-frontend-59597652459.europe-west1.run.app  
**API docs:** https://sightline-backend-59597652459.europe-west1.run.app/docs  
**Demo video:** [Watch on YouTube](https://www.youtube.com/watch?v=hW1gJ22O3Zs)

---

## What it does

```
"What's in front of me? Is there anything I should be careful of?"
```

One continuous WebSocket session handles everything:

1. **Camera frames** — JPEG snapshots sent to Gemini every 1.5 seconds
2. **Mic audio** — PCM16 at 16kHz, streamed from the browser in real time
3. **Gemini Live** — sees the frames, hears the question, responds in voice
4. **Audio playback** — PCM16 at 24kHz, played back through the browser
5. **Turn management** — mic mutes while Gemini speaks, reopens on `turn_complete`

No manual button presses. No waiting for a full response before you can speak again. The session stays open until you close it.

---

## Architecture

![SightLine Architecture](./architecture.svg)

The browser streams camera and mic data over WebSocket to a FastAPI backend. The backend forwards both to Gemini Live on Vertex AI using the Google GenAI SDK. Gemini's audio response streams back through the same WebSocket for immediate playback. A ping/pong keepalive task on both ends prevents proxy timeouts during long sessions.

---

## Running locally

```bash
git clone https://github.com/rkchellah/sightline.git
cd sightline
```

**Backend:**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (second terminal):

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Open http://localhost:3000, click **START**, grant camera and mic access.

---

## Google Cloud setup

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project sightline-2026
gcloud services enable aiplatform.googleapis.com --project=sightline-2026
```

The backend connects to Vertex AI via Application Default Credentials — no API keys in the codebase.

```python
self.client = genai.Client(
    vertexai=True,
    project="sightline-2026",
    location="europe-west1"
)
```

---

## Stack

- **Frontend**: Next.js 14, TypeScript, WebRTC
- **Backend**: FastAPI, Python 3.11, asyncio
- **AI**: Gemini Live (`gemini-2.0-flash-live-001`) via Vertex AI
- **Auth**: Application Default Credentials (no exposed keys)
- **Transport**: WebSocket — JSON + base64 encoded audio
- **Hosting**: Google Cloud Run, region `europe-west1`

---

## Project structure

```
sightline/
├── backend/
│   └── app/
│       ├── main.py               — FastAPI entry point
│       ├── api/websocket.py      — WebSocket handler + keepalive
│       ├── core/config.py        — GCP project + model config
│       └── services/gemini_service.py  — Gemini Live session + turn management
└── frontend/
    ├── app/page.tsx              — Main UI + session logic
    ├── components/
    │   ├── CameraView.tsx
    │   ├── AudioVisualizer.tsx
    │   └── VoiceOverlay.tsx
    └── hooks/
        ├── useCamera.ts          — Camera + mic stream management
        ├── useWebSocket.ts       — WebSocket client + ping/pong keepalive
        └── useAudioPlayer.ts     — PCM audio queue + mic mute logic
```

---

## What I learned building this

Three problems that weren't in any tutorial.

**Gemini hears itself if you don't mute the mic during playback.** When Gemini speaks, its audio comes out of the browser speaker. The mic picks that up, sends it back to Gemini, and the session breaks — Gemini hears its own voice mid-sentence and goes silent permanently. The fix was `isSpeakingRef` in `useAudioPlayer.ts` — a React ref, not state, because refs hold the live value synchronously. The `ScriptProcessorNode` checks `isSpeakingRef.current` on every audio frame; if Gemini is speaking, the frame is dropped before it ever reaches the WebSocket. When the backend detects `turn_complete` in Gemini's response stream, it sends that signal to the frontend, which sets `isSpeakingRef.current = false` and reopens the mic. The reason it has to be a ref and not state is that the audio processor callback captures a stale closure — state updates wouldn't be visible inside it, but a ref always is.

**WebSocket connections to Cloud Run die without a heartbeat.** Cloud Run sits behind a Google-managed proxy with a 60-second idle timeout. A long conversation with natural pauses — the user thinking, Gemini processing — can easily go quiet for more than a minute. The connection drops with no error, just silence. Fixed it with a ping/pong task on both the backend and the browser client, running every 20 seconds, keeping the connection alive regardless of what the conversation is doing.

**Tested on a real user, not a simulator.** Pointed the running app at a family member's phone over a video call. Gemini correctly identified medications in their hand from the camera feed. It also correctly declined to give specific dosage advice — which was the right call, but it meant the app needed better prompting to guide users toward asking safe questions. That feedback came from actual use, not from me testing it on my desk.

---

## Hackathon

- **Challenge:** Gemini Live Agent Challenge 2026
- **Category:** Live Agent (Real-time Audio/Vision)
- **Devpost:** [SightLine submission](https://devpost.com/rkchellah)
- **GDG Profile:** https://gdg.community.dev/u/mzntqb/#/about
