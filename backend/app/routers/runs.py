from fastapi import APIRouter, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.models import RunCreate, RunResponse

router = APIRouter(prefix="/runs", tags=["runs"])

# In-memory store for now — replaced by Supabase + Redis in next task
_runs: dict = {}


@router.post("/", response_model=RunResponse, status_code=201)
def create_run(payload: RunCreate):
    run_id = uuid4()
    now = datetime.now(timezone.utc)
    record = RunResponse(
        id=run_id,
        workflow_id=payload.workflow_id,
        status="queued",
        created_at=now,
    )
    _runs[str(run_id)] = record
    return record


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str):
    record = _runs.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    return record
