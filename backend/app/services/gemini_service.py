from google import genai
from google.genai import types
from app.core.config import settings
from contextlib import asynccontextmanager
import base64

SYSTEM_PROMPT = """You are SightLine, a warm and reliable real-time accessibility companion.
You help users understand their visual world through natural conversation.

When observing through the camera:
- Describe scenes clearly and concisely
- Read all visible text aloud exactly as written
- Identify objects, people, and environments naturally
- Proactively warn of hazards
- Answer follow-up questions about what you see

Speak warmly and confidently. Never hallucinate. Only describe what is actually visible."""

class GeminiLiveService:
    def __init__(self):
        self.client = genai.Client(
            vertexai=True,
            project="sightline-2026",
            location="us-east4"
        )
        self.model = settings.model_name

    @asynccontextmanager
    async def connect(self):
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=SYSTEM_PROMPT)],
                role="user"  # Vertex AI Live requires "user" not "system"
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede"
                    )
                )
            ),
        )
        async with self.client.aio.live.connect(
            model=self.model, config=config
        ) as session:
            yield GeminiSession(session)


class GeminiSession:
    def __init__(self, session):
        self.session = session

    async def send_audio(self, audio_bytes: bytes):
        await self.session.send(
            input=types.LiveClientRealtimeInput(
                media_chunks=[types.Blob(data=audio_bytes, mime_type="audio/pcm")]
            )
        )

    async def send_video_frame(self, frame_bytes: bytes):
        await self.session.send(
            input=types.LiveClientRealtimeInput(
                media_chunks=[types.Blob(data=frame_bytes, mime_type="image/jpeg")]
            )
        )

    async def send_text(self, text: str):
        await self.session.send(input=text, end_of_turn=True)

    async def receive(self):
        try:
            async for response in self.session.receive():
                if not hasattr(response, "server_content"):
                    continue

                sc = response.server_content
                if not sc:
                    continue

                # Detect when Gemini finishes its turn — send signal to frontend
                # This tells the frontend to resume mic input
                if sc.turn_complete:
                    print("Gemini turn complete")
                    yield {"type": "turn_complete", "data": ""}
                    continue

                if not sc.model_turn:
                    continue

                for part in sc.model_turn.parts:
                    if getattr(part, "text", None):
                        yield {"type": "text", "data": part.text}
                    if getattr(part, "inline_data", None):
                        audio_b64 = base64.b64encode(part.inline_data.data).decode()
                        yield {"type": "audio", "data": audio_b64}

        except Exception as e:
            print(f"Gemini receive error: {e}")
            yield {"type": "error", "data": str(e)}