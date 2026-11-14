import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.compiler import compile_workflow, _ssrf_check
from app.models import RunCreate, RunResponse, WorkflowNode, WorkflowEdge
from pydantic import BaseModel

router = APIRouter(prefix="/runs", tags=["runs"])

_runs: dict[str, dict[str, Any]] = {}


class StreamRequest(BaseModel):
    input: str = "Hello from Agentra!"


def _get_workflows_store() -> dict:
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

    try:
        graph = compile_workflow(nodes, edges)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

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
def stream_run(workflow_id: str, body: StreamRequest):
    wf_store = _get_workflows_store()

    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_store[workflow_id]
    nodes = wf.nodes
    edges = wf.edges

    try:
        compile_workflow(nodes, edges)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user_input = body.input

    def emit(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    def event_stream():
        import os
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        state: dict[str, Any] = {"input": user_input}

        # --- Trigger ---
        trigger_node = next((n for n in nodes if n.data.nodeType == "trigger"), None)
        if trigger_node:
            yield emit({"type": "node_start", "node_id": trigger_node.id})
            state["triggered_by"] = trigger_node.data.config.get("kind", "manual")
            yield emit({"type": "node_done", "node_id": trigger_node.id})

        # --- Tool nodes ---
        tool_nodes = [n for n in nodes if n.data.nodeType == "tool"]
        for tool_node in tool_nodes:
            yield emit({"type": "node_start", "node_id": tool_node.id})
            try:
                config = tool_node.data.config
                tool_id = config.get("tool_id", "")
                params = config.get("params", {})
                output_key = config.get("output_key", "search_results")

                if tool_id == "tavily_search":
                    from tavily import TavilyClient
                    client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
                    query_template = params.get("query", state.get("input", ""))
                    query = query_template.format(**{k: v for k, v in state.items() if v is not None})
                    max_results = int(params.get("max_results", 5))
                    response = client.search(query=query, max_results=max_results)
                    results = response.get("results", [])
                    formatted = "\n\n".join(
                        f"**{r.get('title', '')}**\n{r.get('content', '')}\nSource: {r.get('url', '')}"
                        for r in results
                    )
                    state[output_key] = formatted

                elif tool_id == "jina_reader":
                    import urllib.request
                    url_template = params.get("url", state.get("input", ""))
                    url = url_template.format(**{k: v for k, v in state.items() if v is not None})
                    jina_url = f"https://r.jina.ai/{url}"
                    req = urllib.request.Request(
                        jina_url,
                        headers={"Accept": "text/markdown", "User-Agent": "Agentra/1.0"},
                    )
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        content = resp.read().decode("utf-8")
                    state[output_key] = content[:8000]

                elif tool_id == "http_request":
                    import urllib.request as _urllib
                    url_template = params.get("url", "")
                    url = url_template.format(**{k: v for k, v in state.items() if v is not None})
                    _ssrf_check(url)
                    method = params.get("method", "GET").upper()
                    headers = params.get("headers", {})
                    body_template = params.get("body", "")
                    body = body_template.format(**{k: v for k, v in state.items() if v is not None}) if body_template else None
                    data = body.encode() if body else None
                    req = _urllib.Request(url, data=data, method=method)
                    req.add_header("User-Agent", "Agentra/1.0")
                    for hk, hv in headers.items():
                        req.add_header(hk, hv)
                    with _urllib.urlopen(req, timeout=15) as resp:
                        raw = resp.read().decode("utf-8")
                    try:
                        import json as _json
                        result = _json.dumps(_json.loads(raw), indent=2)[:8000]
                    except Exception:
                        result = raw[:8000]
                    state[output_key] = result

                else:
                    yield emit({"type": "error", "message": f"Unknown tool_id: {tool_id}"})
                    return

            except Exception as exc:
                yield emit({"type": "error", "message": f"Tool error: {exc}"})
                return
            yield emit({"type": "node_done", "node_id": tool_node.id})

        # --- LLM node ---
        llm_node = next((n for n in nodes if n.data.nodeType == "llm_call"), None)
        if llm_node is None:
            yield emit({"type": "error", "message": "No LLM node found"})
            return

        yield emit({"type": "node_start", "node_id": llm_node.id})

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
        user_prompt_template = config.get("user_prompt", "{input}")
        user_prompt = user_prompt_template.format(**{k: v for k, v in state.items() if v is not None})

        llm = ChatGroq(model=model_name, temperature=temperature, streaming=True)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]

        for chunk in llm.stream(messages):
            token = chunk.content
            if token:
                yield emit({"type": "token", "value": token})

        yield emit({"type": "node_done", "node_id": llm_node.id})

        # --- Output node ---
        output_node = next((n for n in nodes if n.data.nodeType == "output"), None)
        if output_node:
            yield emit({"type": "node_start", "node_id": output_node.id})
            yield emit({"type": "node_done", "node_id": output_node.id})

        yield emit({"type": "done"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
