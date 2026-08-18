"""FastAPI routes for L1 event ingestion."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from l1.config import MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS
from l1.pipeline import L1Pipeline

router = APIRouter(prefix="/api/l1", tags=["L1 Ingestion"])
pipeline = L1Pipeline()


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    source_hint: str | None = Form(default=None),
):
    """Upload and normalize security log files."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    file_contents = []
    
    for file in files:
        if not file.filename:
            continue
            
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}' for {file.filename}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} exceeds maximum size of {MAX_FILE_SIZE_BYTES // (1024*1024)} MB",
            )

        if not content:
            raise HTTPException(status_code=400, detail=f"Empty file {file.filename}")
            
        file_contents.append((content, file.filename))

    if not file_contents:
        raise HTTPException(status_code=400, detail="No valid files provided")

    result = pipeline.process_files(file_contents, source_hint=source_hint)
    
    needs_source_selection = any(f.get("detection_confidence", 1.0) < 0.3 for f in result["report"].get("files", []))

    return JSONResponse({
        "session_id": result["session_id"],
        "report": result["report"],
        "needs_source_selection": needs_source_selection,
        "events_preview": result["events"][:20],
    })


@router.post("/paste")
async def paste_event(
    event_text: str = Form(...),
    source_hint: str | None = Form(default=None),
):
    """Normalize a single pasted event."""
    if not event_text.strip():
        raise HTTPException(status_code=400, detail="Empty event text")

    result = pipeline.process_paste(event_text, source_hint=source_hint)

    return JSONResponse({
        "session_id": result["session_id"],
        "source_detected": result["report"]["source_detected"],
        "total_events": result["report"]["total_events"],
        "successfully_normalized": result["report"]["successfully_normalized"],
        "failed_events": result["report"]["failed_events"],
        "duplicate_events": result["report"]["duplicate_events"],
        "status": result["report"]["status"],
        "events": result["events"],
        "errors": result["errors"],
    })


@router.get("/download/{session_id}/{file_type}")
async def download_output(session_id: str, file_type: str):
    """Download normalized output files."""
    path = pipeline.get_session_output(session_id, file_type)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    media_types = {
        "normalized_json": "application/json",
        "normalized_jsonl": "application/x-ndjson",
        "report": "application/json",
        "errors": "application/json",
    }
    return FileResponse(
        path,
        media_type=media_types.get(file_type, "application/octet-stream"),
        filename=path.name,
    )


@router.get("/events/{session_id}")
async def get_events(session_id: str, offset: int = 0, limit: int = 50):
    """Paginated view of normalized events."""
    path = pipeline.get_session_output(session_id, "normalized_json")
    if not path:
        raise HTTPException(status_code=404, detail="Session not found")

    import json
    with open(path, encoding="utf-8") as f:
        events = json.load(f)

    return JSONResponse({
        "session_id": session_id,
        "total": len(events),
        "offset": offset,
        "limit": limit,
        "events": events[offset : offset + limit],
    })


@router.get("/report/{session_id}")
async def get_report(session_id: str):
    """Get normalization report for a session."""
    path = pipeline.get_session_output(session_id, "report")
    if not path:
        raise HTTPException(status_code=404, detail="Session not found")

    import json
    with open(path, encoding="utf-8") as f:
        report = json.load(f)
    return JSONResponse(report)


@router.get("/sources")
async def list_sources():
    """List supported source platforms."""
    return JSONResponse({
        "sources": [
            {"id": "wazuh", "name": "Wazuh", "type": "SIEM"},
            {"id": "suricata", "name": "Suricata", "type": "IDS/IPS"},
            {"id": "firewall", "name": "Firewall (pfSense)", "type": "Firewall"},
            {"id": "generic", "name": "Generic", "type": "Unknown"},
        ]
    })
