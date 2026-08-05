from datetime import datetime
from bson import ObjectId
from app.core.db import get_chunks_collection, get_documents_collection
from app.core.embedder import get_embedder
from app.services.extract import extract_text
from app.services.chunk import chunk_text

def ingest_document(user_id: str, file_bytes: bytes, file_name: str, content_type: str, file_size: int) -> dict:
    documents_col = get_documents_collection()
    chunks_col = get_chunks_collection()

    doc = {
        "userId": user_id,
        "fileName": file_name,
        "fileType": content_type,
        "fileSize": file_size,
        "status": "processing",
        "chunkCount": 0,
        "createdAt": datetime.utcnow(),
    }
    result = documents_col.insert_one(doc)
    document_id = result.inserted_id

    try:
        raw_text = extract_text(file_bytes, content_type)
        if not raw_text or not raw_text.strip():
            raise ValueError("No extractable text found in document")

        chunks = chunk_text(raw_text)

        embedder = get_embedder()
        vectors = embedder.embed_documents(chunks)

        chunk_docs = [
            {
                "documentId": document_id,
                "userId": user_id,
                "text": chunk,
                "chunkIndex": i,
                "embedding": vector,
                "metadata": {"fileName": file_name},
                "createdAt": datetime.utcnow(),
            }
            for i, (chunk, vector) in enumerate(zip(chunks, vectors))
        ]
        chunks_col.insert_many(chunk_docs)

        documents_col.update_one(
            {"_id": document_id},
            {"$set": {"status": "ready", "chunkCount": len(chunks)}},
        )

        return {"documentId": str(document_id), "status": "ready", "chunkCount": len(chunks)}

    except Exception as e:
        documents_col.update_one(
            {"_id": document_id},
            {"$set": {"status": "failed", "errorMessage": str(e)}},
        )
        raise