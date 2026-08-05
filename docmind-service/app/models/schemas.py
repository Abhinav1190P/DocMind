from pydantic import BaseModel, field_validator
from typing import Optional, List

MAX_QUERY_LENGTH = 2000
MAX_HISTORY_TURNS = 20

class QueryRequest(BaseModel):
    query: str
    userId: str
    history: Optional[List[dict]] = []

    @field_validator("query")
    @classmethod
    def query_not_too_long(cls, v):
        if len(v) > MAX_QUERY_LENGTH:
            raise ValueError(f"query exceeds max length of {MAX_QUERY_LENGTH} characters")
        return v

    @field_validator("history")
    @classmethod
    def history_not_too_long(cls, v):
        if v and len(v) > MAX_HISTORY_TURNS:
            return v[-MAX_HISTORY_TURNS:]
        return v

class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]

class IngestResponse(BaseModel):
    documentId: str
    status: str
    chunkCount: int
