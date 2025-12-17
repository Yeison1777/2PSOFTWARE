import os
from databases import Database
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration from environment variables
# Railway provides DATABASE_URL directly, fallback to individual variables for local dev
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback: construct from individual variables (for local development)
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "uml_editor")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    # Extract DB_NAME from DATABASE_URL for logging
    DB_NAME = DATABASE_URL.split("/")[-1].split("?")[0] if "/" in DATABASE_URL else "uml_editor"

# Create database instance
database = Database(DATABASE_URL)

async def connect_db():
    """Connect to the database."""
    await database.connect()
    print(f"Connected to PostgreSQL database: {DB_NAME}")

async def disconnect_db():
    """Disconnect from the database."""
    await database.disconnect()
    print("Disconnected from database")

# Export database instance
__all__ = ["database", "connect_db", "disconnect_db"]