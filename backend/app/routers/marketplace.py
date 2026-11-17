from fastapi import APIRouter, HTTPException, Request

from app.db import get_client
from app.models import WorkflowResponse

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/", response_model=list[WorkflowResponse])
def browse_marketplace() -> list[WorkflowResponse]:
    db = get_client()
    result = (
        db.table("workflows")
        .select("*")
        .eq("is_public", True)
        .order("created_at", desc=True)
        .execute()
    )
    from app.models import WorkflowNode, WorkflowEdge
    return [
        WorkflowResponse(
            id=r["id"],
            name=r["name"],
            nodes=[WorkflowNode(**n) for n in r["nodes"]],
            edges=[WorkflowEdge(**e) for e in r["edges"]],
            created_at=r["created_at"],
        )
        for r in result.data
    ]


@router.post("/{workflow_id}/fork", response_model=WorkflowResponse, status_code=201)
def fork_workflow(workflow_id: str, request: Request) -> WorkflowResponse:
    db = get_client()
    owner_id = request.state.user_id

    # Fetch the public workflow
    result = (
        db.table("workflows")
        .select("*")
        .eq("id", workflow_id)
        .eq("is_public", True)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Public workflow not found")

    source = result.data[0]

    # Clone it into the forking user's account
    fork_row = {
        "owner_id": owner_id,
        "name": f"{source['name']} (fork)",
        "nodes": source["nodes"],
        "edges": source["edges"],
        "is_public": False,
    }
    fork_result = db.table("workflows").insert(fork_row).execute()
    if not fork_result.data:
        raise HTTPException(status_code=502, detail="Failed to fork workflow")

    saved = fork_result.data[0]
    from app.models import WorkflowNode, WorkflowEdge
    return WorkflowResponse(
        id=saved["id"],
        name=saved["name"],
        nodes=[WorkflowNode(**n) for n in saved["nodes"]],
        edges=[WorkflowEdge(**e) for e in saved["edges"]],
        created_at=saved["created_at"],
    )