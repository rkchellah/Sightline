import datetime

from google import genai
from google.genai import types
from google.cloud import firestore
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure

from app.core.config import settings

# Gemini Embedding supports 768 / 1536 / 3072 output dimensions.
# 768 keeps Firestore storage and vector-search cost low while still
# being plenty accurate for personal-memory style retrieval.
EMBEDDING_DIMENSIONS = 768


class MemoryService:
    """Stores and retrieves short personal 'memories' the agent has been
    asked to remember, using Firestore's native vector search."""

    def __init__(self):
        self.db = firestore.AsyncClient(project=settings.google_cloud_project)
        self.embed_client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

    async def _embed(self, text: str, task_type: str) -> list[float]:
        result = await self.embed_client.aio.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIMENSIONS,
            ),
        )
        return result.embeddings[0].values

    def _collection(self, user_id: str):
        return (
            self.db.collection("memories")
            .document(user_id)
            .collection("items")
        )

    async def save_memory(self, user_id: str, text: str) -> str:
        """Embed and store a new memory. Returns the new document id."""
        embedding = await self._embed(text, task_type="RETRIEVAL_DOCUMENT")
        doc_ref = self._collection(user_id).document()
        await doc_ref.set({
            "text": text,
            "embedding": Vector(embedding),
            "created_at": datetime.datetime.now(datetime.timezone.utc),
        })
        return doc_ref.id

    async def search_memories(self, user_id: str, query: str, limit: int = 3) -> list[str]:
        """Return up to `limit` memory texts most relevant to `query`."""
        query_embedding = await self._embed(query, task_type="RETRIEVAL_QUERY")
        vector_query = self._collection(user_id).find_nearest(
            vector_field="embedding",
            query_vector=Vector(query_embedding),
            distance_measure=DistanceMeasure.COSINE,
            limit=limit,
        )
        results = await vector_query.get()
        return [doc.to_dict()["text"] for doc in results]


memory_service = MemoryService()
