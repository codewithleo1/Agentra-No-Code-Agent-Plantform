from fastapi import APIRouter, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.models import WorkflowCreate, WorkflowResponse

router = APIRouter(prefix="/workflows", tags=["workflows"])

# In-memory store for now — replaced by Supabase in next task
_workflows: dict = {}


@router.post("/", response_model=WorkflowResponse, status_code=201)
def create_workflow(payload: WorkflowCreate):
    workflow_id = uuid4()
    now = datetime.now(timezone.utc)
    record = WorkflowResponse(
        id=workflow_id,
        name=payload.name,
        nodes=payload.nodes,
        edges=payload.edges,
        created_at=now,
    )
    _workflows[str(workflow_id)] = record
    return record


@router.get("/", response_model=list[WorkflowResponse])
def list_workflows():
    return list(_workflows.values())


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: str):
    record = _workflows.get(workflow_id)
    if not record:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return record


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str):
    if workflow_id not in _workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    del _workflows[workflow_id]
