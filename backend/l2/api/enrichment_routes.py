"""FastAPI routes for L2 Context Enrichment."""

from typing import Any
from fastapi import APIRouter, HTTPException, Body
from l2.models import ContextEnrichedEvent
from l2.enricher import enrich_event

router = APIRouter(prefix="/api/l2", tags=["L2 Context Enrichment"])

@router.post("/enrich", response_model=ContextEnrichedEvent)
async def enrich_single_event(event: dict[str, Any] = Body(...)):
    """
    Receive a single normalized L1 event and return the ContextEnrichedEvent.
    """
    try:
        enriched_event = enrich_event(event)
        return enriched_event
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

@router.post("/enrich/batch", response_model=list[ContextEnrichedEvent])
async def enrich_batch_events(events: list[dict[str, Any]] = Body(...)):
    """
    Receive a batch of normalized L1 events and return a list of ContextEnrichedEvents.
    """
    try:
        enriched_events = [enrich_event(event) for event in events]
        return enriched_events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch enrichment failed: {str(e)}")
