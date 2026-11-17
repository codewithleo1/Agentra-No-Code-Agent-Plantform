from fastapi import APIRouter, HTTPException, Request

from app.db import get_client
from app.models import WorkflowCreate, WorkflowResponse

router = APIRouter(prefix="/workflows", tags=["workflows"])

_workflows: dict = {}


@router.post("/", status_code=201, response_model=WorkflowResponse)
def create_workflow(body: WorkflowCreate, request: Request) -> WorkflowResponse:
    db = get_client()
    owner_id = request.state.user_id
    row = {
        "owner_id": owner_id,
        "name": body.name,
        "nodes": [n.model_dump() for n in body.nodes],
        "edges": [e.model_dump() for e in body.edges],
    }
    result = db.table("workflows").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=502, detail="Failed to save workflow")

    saved = result.data[0]
    wf = WorkflowResponse(
        id=saved["id"],
        name=saved["name"],
        nodes=body.nodes,
        edges=body.edges,
        created_at=saved["created_at"],
    )
    _workflows[str(wf.id)] = wf
    return wf


@router.get("/", response_model=list[WorkflowResponse])
def list_workflows(request: Request) -> list[WorkflowResponse]:
    db = get_client()
    owner_id = request.state.user_id
    result = (
        db.table("workflows")
        .select("*")
        .eq("owner_id", owner_id)
        .order("created_at", desc=True)
        .execute()
    )
    workflows = []
    for saved in result.data:
        from app.models import WorkflowNode, WorkflowEdge
        wf = WorkflowResponse(
            id=saved["id"],
            name=saved["name"],
            nodes=[WorkflowNode(**n) for n in saved["nodes"]],
            edges=[WorkflowEdge(**e) for e in saved["edges"]],
            created_at=saved["created_at"],
        )
        workflows.append(wf)
    return workflows


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: str, request: Request) -> WorkflowResponse:
    if workflow_id in _workflows:
        return _workflows[workflow_id]

    db = get_client()
    owner_id = request.state.user_id
    result = (
        db.table("workflows")
        .select("*")
        .eq("id", workflow_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    saved = result.data[0]
    from app.models import WorkflowNode, WorkflowEdge
    wf = WorkflowResponse(
        id=saved["id"],
        name=saved["name"],
        nodes=[WorkflowNode(**n) for n in saved["nodes"]],
        edges=[WorkflowEdge(**e) for e in saved["edges"]],
        created_at=saved["created_at"],
    )
    _workflows[workflow_id] = wf
    return wf