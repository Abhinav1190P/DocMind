import time
import logging
from app.core.db import get_chunks_collection
from app.core.embedder import get_embedder
from app.core.reranker import get_reranker
from app.core.config import VECTOR_INDEX_NAME, TOP_K

logger = logging.getLogger("docmind.retrieve")

RERANK_CANDIDATE_MULTIPLIER = 4

def retrieve_relevant_chunks(query: str, user_id: str, top_k: int = None, use_reranker: bool = True) -> list:
    top_k = top_k or TOP_K
    candidate_k = top_k * RERANK_CANDIDATE_MULTIPLIER if use_reranker else top_k

    t0 = time.time()
    embedder = get_embedder()
    query_vector = embedder.embed_query(query)
    t1 = time.time()
    logger.info(f"[TIMING] embed_query: {t1 - t0:.3f}s")

    chunks_col = get_chunks_collection()

    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": candidate_k * 20,
                "limit": candidate_k,
                "filter": {"userId": user_id},
            }
        },
        {
            "$project": {
                "text": 1,
                "documentId": 1,
                "metadata": 1,
                "chunkIndex": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results = list(chunks_col.aggregate(pipeline))
    t2 = time.time()
    logger.info(f"[TIMING] vector_search ({len(results)} candidates): {t2 - t1:.3f}s")

    for r in results:
        r["_id"] = str(r["_id"])
        r["documentId"] = str(r["documentId"])
        r["vector_score"] = r["score"]

    if use_reranker and results:
        results = rerank_chunks(query, results, top_k)
        t3 = time.time()
        logger.info(f"[TIMING] rerank: {t3 - t2:.3f}s")
    else:
        results = results[:top_k]

    return results


def rerank_chunks(query: str, chunks: list, top_k: int) -> list:
    reranker = get_reranker()
    pairs = [[query, chunk["text"]] for chunk in chunks]
    rerank_scores = reranker.predict(pairs)

    for chunk, score in zip(chunks, rerank_scores):
        chunk["rerank_score"] = float(score)
        chunk["score"] = float(score)

    chunks.sort(key=lambda c: c["rerank_score"], reverse=True)
    return chunks[:top_k]
