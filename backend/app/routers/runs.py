import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.compiler import compile_workflow
from app.models import RunCreate, RunResponse

router = APIRouter(prefix="/runs", tags=["runs"])

_runs: dict[str, dict[str, Any]] = {}
_workflows: dict[str, dict[str, Any]] = {}  # shared ref — will fix with Supabase later


def _get_workflows_store() -> dict:
    """Import the in-memory store from the workflows router."""
    from app.routers.workflows import _workflows as wf_store
    return wf_store


@router.post("/", status_code=201, response_model=RunResponse)
def create_run(body: RunCreate) -> RunResponse:
    wf_store = _get_workflows_store()
    wf_id = str(body.workflow_id)

    if wf_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_store[wf_id]
    nodes = wf.nodes
    edges = wf.edges

    # Compile
    try:
        graph = compile_workflow(nodes, edges)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Execute
    try:
        result = graph.invoke({"input": "Hello from Agentra!"})
        print("RESULT:", result)
    except Exception as exc:
        run_id = str(uuid.uuid4())
        run = {
            "id": run_id,
            "workflow_id": wf_id,
            "status": "failed",
            "error": str(exc),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _runs[run_id] = run
        raise HTTPException(status_code=502, detail=f"Execution failed: {exc}")

    run_id = str(uuid.uuid4())
    run = {
        "id": run_id,
        "workflow_id": wf_id,
        "status": "completed",
        "output": (result or {}).get("final_output", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _runs[run_id] = run
    return RunResponse(**run)


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str) -> RunResponse:
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunResponse(**_runs[run_id])