from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    google_cloud_project: str = "sightline-2026"
    google_cloud_location: str = "us-central1"
    model_name: str = "gemini-live-2.5-flash"

    model_config = {"protected_namespaces": ("settings_",)}

settings = Settings()
print(f"✅ Project: {settings.google_cloud_project} | Model: {settings.model_name}")