from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.websocket import router as ws_router

app = FastAPI(title="SightLine API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sightline-frontend-59597652459.us-east4.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "sightline-backend"}