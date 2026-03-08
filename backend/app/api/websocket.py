from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.gemini_service import GeminiLiveService
import json
import base64
import asyncio

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ Client connected", flush=True)

    try:
        service = GeminiLiveService()
        async with service.connect() as session:
            await websocket.send_text(json.dumps({
                "type": "status",
                "data": "connected"
            }))
            print("✅ Gemini Live session established")

            async def send_to_client():
                """Continuously receive from Gemini and forward to frontend"""
                try:
                    async for response in session.receive():
                        rtype = response.get("type")
                        if rtype == "text":
                            print(f"💬 Gemini: {response['data'][:80]}")
                        elif rtype == "audio":
                            print(f"🔊 Audio: {len(response['data'])} chars")
                        elif rtype == "turn_complete":
                            print("✅ Gemini turn complete")
                        await websocket.send_text(json.dumps(response))
                except Exception as e:
                    print(f"❌ Gemini receiver error: {e}")

            async def receive_from_client():
                """Continuously receive from frontend and forward to Gemini"""
                try:
                    while True:
                        data = await websocket.receive_text()
                        payload = json.loads(data)
                        msg_type = payload.get("type")

                        if msg_type == "ping":
                            # ✅ Respond with pong — keeps connection alive
                            await websocket.send_text(json.dumps({"type": "pong", "data": ""}))

                        elif msg_type == "audio":
                            await session.send_audio(
                                base64.b64decode(payload["data"])
                            )
                        elif msg_type == "video_frame":
                            frame = base64.b64decode(payload["data"])
                            await session.send_video_frame(frame)
                            print(f"📸 Frame: {len(frame)} bytes")
                        elif msg_type == "text":
                            await session.send_text(payload["data"])
                            print(f"💬 Text to Gemini: {payload['data']}")

                except WebSocketDisconnect:
                    print("👋 Client disconnected")
                except Exception as e:
                    print(f"❌ Client receiver error: {e}")

            async def keepalive():
                """Send ping to frontend every 20s to prevent proxy timeouts"""
                try:
                    while True:
                        await asyncio.sleep(20)
                        await websocket.send_text(json.dumps({"type": "ping", "data": ""}))
                except Exception:
                    pass  # silently exit if connection is already closed

            # Run all three concurrently
            client_task = asyncio.create_task(receive_from_client())
            gemini_task = asyncio.create_task(send_to_client())
            keepalive_task = asyncio.create_task(keepalive())

            # Wait for either main task to finish
            done, pending = await asyncio.wait(
                [client_task, gemini_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel remaining tasks cleanly
            for task in [*pending, keepalive_task]:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except WebSocketDisconnect:
        print("👋 Client disconnected")
    except Exception as e:
        print(f"❌ Session error: {e}")
        import traceback
        traceback.print_exc()