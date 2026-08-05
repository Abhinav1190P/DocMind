from sentence_transformers import CrossEncoder

_reranker = None

RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

def get_reranker():
    global _reranker
    if _reranker is None:
        _reranker = CrossEncoder(RERANKER_MODEL)
    return _reranker
