from langchain_huggingface import HuggingFaceEmbeddings
from app.core.config import EMBEDDING_MODEL

_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _embedder
