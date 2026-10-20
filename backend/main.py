"""Cyber Defense Harness — L1 -> L2 -> Part 2 -> L3 API."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from l1.api.ingestion_routes import router as l1_router
from l2.api.enrichment_routes import router as l2_router
from l3.api.analysis_routes import router as l3_router
from part2.api.assessment_routes import router as part2_router
from pipeline.routes import router as pipeline_router

app = FastAPI(
    title="Cyber Defense Harness — L1, L2, Part 2 & L3",
    description=(
        "Event Collection, Normalization, Enrichment, Rules & Risk Assessment, "
        "LLM Reasoning, Judge & XAI"
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(l1_router)
app.include_router(l2_router)
app.include_router(part2_router)
app.include_router(l3_router)
app.include_router(pipeline_router)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
DASHBOARD_OUT_DIR = Path(__file__).resolve().parent.parent / "dashboard" / "out"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def root():
    if DASHBOARD_OUT_DIR.exists():
        return FileResponse(DASHBOARD_OUT_DIR / "index.html")

    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "L1 API running. Place frontend at backend/../frontend/index.html"}


@app.api_route("/legacy", methods=["GET", "HEAD"])
async def legacy():
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Frontend is not available"}


@app.get("/health")
async def health():
    return {"status": "ok", "modules": ["L1", "L2", "Part2", "L3"]}


if DASHBOARD_OUT_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=DASHBOARD_OUT_DIR, html=True),
        name="dashboard",
    )
