from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.ingest import ingest_document
from app.models.schemas import IngestResponse

router = APIRouter(prefix="/ingest", tags=["ingest"])

@router.post("", response_model=IngestResponse)
async def ingest(user_id: str = Form(...), file: UploadFile = File(...)):
    file_bytes = await file.read()

    try:
        result = ingest_document(
            user_id=user_id,
            file_bytes=file_bytes,
            file_name=file.filename,
            content_type=file.content_type,
            file_size=len(file_bytes),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
