from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.core.config import CHUNK_SIZE, CHUNK_OVERLAP

def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=(chunk_size or CHUNK_SIZE),
        chunk_overlap=(overlap or CHUNK_OVERLAP),
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    return [c.strip() for c in chunks if c.strip()]
