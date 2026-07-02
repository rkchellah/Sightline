from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    google_cloud_project: str = "sightline-2026"
    google_cloud_location: str = "europe-west1"
    model_name: str = "gemini-live-2.5-flash-native-audio"
    embedding_model: str = "gemini-embedding-001"

    model_config = {"protected_namespaces": ("settings_",)}

settings = Settings()
print(f"✅ Project: {settings.google_cloud_project} | Model: {settings.model_name}")