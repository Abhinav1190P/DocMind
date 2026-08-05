from pymongo import MongoClient
from app.core.config import MONGODB_URI, DB_NAME

_client = None

def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client[DB_NAME]

def get_chunks_collection():
    return get_db()["chunks"]

def get_documents_collection():
    return get_db()["documents"]
