from pypdf import PdfReader
import io

def extract_text(file_bytes: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text

    if content_type in ("text/plain", "text/markdown"):
        return file_bytes.decode("utf-8")

    raise ValueError(f"Unsupported file type: {content_type}")
