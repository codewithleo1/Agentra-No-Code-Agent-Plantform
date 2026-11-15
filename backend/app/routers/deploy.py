import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["deploy"])

_deployments: dict[str, dict[str, Any]] = {}
_api_keys: dict[str, str] = {}


class DeployResponse(BaseModel):
    workflow_id: str
    api_key: str
    endpoint: str
    curl_example: str


class AgentRequest(BaseModel):
    input: str


class AgentResponse(BaseModel):
    output: str
    workflow_id: str


@router.post("/deploy/{workflow_id}", response_model=DeployResponse)
def deploy_workflow(workflow_id: str):
    from app.routers.workflows import _workflows as wf_store
    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow_id in _deployments:
        return DeployResponse(**_deployments[workflow_id])

    api_key = f"agk_{secrets.token_urlsafe(32)}"
    endpoint = f"http://localhost:8000/agent/{workflow_id}"
    curl = f'curl -X POST {endpoint} -H "X-API-Key: {api_key}" -H "Content-Type: application/json" -d \'{{"input": "your query here"}}\''

    deployment = {
        "workflow_id": workflow_id,
        "api_key": api_key,
        "endpoint": endpoint,
        "curl_example": curl,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _deployments[workflow_id] = deployment
    _api_keys[api_key] = workflow_id
    return DeployResponse(**deployment)


@router.post("/agent/{workflow_id}", response_model=AgentResponse)
def run_agent(workflow_id: str, body: AgentRequest, x_api_key: str = Header(...)):
    from app.routers.workflows import _workflows as wf_store
    from app.compiler import compile_workflow

    if _api_keys.get(x_api_key) != workflow_id:
        raise HTTPException(status_code=401, detail="Invalid API key")

    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_store[workflow_id]
    try:
        graph = compile_workflow(wf.nodes, wf.edges)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        result = graph.invoke({"input": body.input})
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Execution failed: {exc}")

    output = (result or {}).get("final_output") or (result or {}).get("output", "")
    return AgentResponse(output=output, workflow_id=workflow_id)
