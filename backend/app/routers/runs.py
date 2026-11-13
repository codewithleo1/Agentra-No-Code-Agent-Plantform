import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.compiler import compile_workflow
from app.models import RunCreate, RunResponse, WorkflowNode, WorkflowEdge

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

@router.post("/{workflow_id}/stream")
def stream_run(workflow_id: str):
    wf_store = _get_workflows_store()

    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_store[workflow_id]
    nodes = wf.nodes
    edges = wf.edges

    try:
        graph = compile_workflow(nodes, edges)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    def event_stream():
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        # Find the llm_call node config
        llm_node = next((n for n in nodes if n.data.nodeType == "llm_call"), None)
        if llm_node is None:
            yield "data: [ERROR] No LLM node found\n\n"
            return

        config = llm_node.data.config
        model_name = config.get("model", "openai/gpt-oss-120b")
        _aliases = {
            "groq/llama-3.3-70b": "openai/gpt-oss-120b",
            "groq/llama-3.3-70b-versatile": "openai/gpt-oss-120b",
            "llama-3.3-70b": "openai/gpt-oss-120b",
        }
        model_name = _aliases.get(model_name, model_name)
        temperature = float(config.get("temperature", 0.7))
        system_prompt = config.get("system_prompt", "You are a helpful assistant.")
        user_prompt = config.get("user_prompt", "Say hello.")

        llm = ChatGroq(model=model_name, temperature=temperature, streaming=True)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]

        for chunk in llm.stream(messages):
            token = chunk.content
            if token:
                yield f"data: {token}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")