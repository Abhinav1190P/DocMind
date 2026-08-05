import cohere
from app.core.config import COHERE_API_KEY, EMBEDDING_MODEL

_client = None


def get_cohere_client():
    global _client
    if _client is None:
        _client = cohere.Client(COHERE_API_KEY)
    return _client


class CohereEmbedder:
    """
    Thin wrapper matching the interface the rest of the app expects
    (embed_documents / embed_query), backed by Cohere's API instead of a
    locally-loaded model. This keeps memory usage low enough for free-tier
    deployment (Render's 512MB limit), at the cost of a network call per
    embedding instead of local inference.
    """

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        client = get_cohere_client()
        response = client.embed(
            texts=texts,
            model=EMBEDDING_MODEL,
            input_type="search_document",
        )
        return response.embeddings

    def embed_query(self, text: str) -> list[float]:
        client = get_cohere_client()
        response = client.embed(
            texts=[text],
            model=EMBEDDING_MODEL,
            input_type="search_query",
        )
        return response.embeddings[0]


_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = CohereEmbedder()
    return _embedder
