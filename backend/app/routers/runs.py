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
    except Exception as exc:
        run_id = str(uuid.uuid4())
        _runs[run_id] = {"id": run_id, "workflow_id": wf_id, "status": "failed", "error": str(exc), "created_at": datetime.now(timezone.utc).isoformat()}
        raise HTTPException(status_code=502, detail=f"Execution failed: {exc}")

    run_id = str(uuid.uuid4())
    run = {"id": run_id, "workflow_id": wf_id, "status": "completed", "output": (result or {}).get("final_output", ""), "created_at": datetime.now(timezone.utc).isoformat()}
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

    def _eval_condition(expression: str, state: dict) -> bool:
        try:
            return bool(eval(expression, {"__builtins__": {}}, {"state": state, "len": len, "str": str, "int": int, "float": float}))
        except Exception:
            return False

    def event_stream():
        import os
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        state: dict[str, Any] = {"input": user_input}

        # Build adjacency: node_id -> list of (target_id, sourceHandle)
        adjacency: dict[str, list[tuple[str, str | None]]] = {}
        for e in edges:
            adjacency.setdefault(e.source, []).append((e.target, e.sourceHandle))

        # Topological walk from trigger
        trigger_node = next((n for n in nodes if n.data.nodeType == "trigger"), None)
        if not trigger_node:
            yield emit({"type": "error", "message": "No trigger node"})
            return

        node_map = {n.id: n for n in nodes}
        visited: set[str] = set()
        queue = [trigger_node.id]

        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            visited.add(node_id)
            node = node_map.get(node_id)
            if not node:
                continue

            yield emit({"type": "node_start", "node_id": node_id})

            ntype = node.data.nodeType
            config = node.data.config

            if ntype == "trigger":
                state["triggered_by"] = config.get("kind", "manual")

            elif ntype == "tool":
                try:
                    tool_id = config.get("tool_id", "")
                    params = config.get("params", {})
                    output_key = config.get("output_key", "search_results")

                    if tool_id == "tavily_search":
                        from tavily import TavilyClient
                        client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
                        query = params.get("query", state.get("input", "")).format(**{k: v for k, v in state.items() if v is not None})
                        response = client.search(query=query, max_results=int(params.get("max_results", 5)))
                        state[output_key] = "\n\n".join(
                            f"**{r.get('title', '')}**\n{r.get('content', '')}\nSource: {r.get('url', '')}"
                            for r in response.get("results", [])
                        )
                    elif tool_id == "jina_reader":
                        import urllib.request
                        url = params.get("url", state.get("input", "")).format(**{k: v for k, v in state.items() if v is not None})
                        req = urllib.request.Request(f"https://r.jina.ai/{url}", headers={"Accept": "text/markdown", "User-Agent": "Agentra/1.0"})
                        with urllib.request.urlopen(req, timeout=20) as resp:
                            state[output_key] = resp.read().decode("utf-8")[:8000]
                    elif tool_id == "http_request":
                        import urllib.request as _ur
                        url = params.get("url", "").format(**{k: v for k, v in state.items() if v is not None})
                        _ssrf_check(url)
                        method = params.get("method", "GET").upper()
                        body_str = params.get("body", "")
                        body_str = body_str.format(**{k: v for k, v in state.items() if v is not None}) if body_str else None
                        req = _ur.Request(url, data=body_str.encode() if body_str else None, method=method)
                        req.add_header("User-Agent", "Agentra/1.0")
                        for hk, hv in params.get("headers", {}).items():
                            req.add_header(hk, hv)
                        with _ur.urlopen(req, timeout=15) as resp:
                            raw = resp.read().decode("utf-8")
                        try:
                            import json as _j
                            state[output_key] = _j.dumps(_j.loads(raw), indent=2)[:8000]
                        except Exception:
                            state[output_key] = raw[:8000]
                    else:
                        yield emit({"type": "error", "message": f"Unknown tool_id: {tool_id}"})
                        return
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Tool error: {exc}"})
                    return

            elif ntype == "condition":
                expression = config.get("condition", "True")
                result = _eval_condition(expression, state)
                branch = "true" if result else "false"
                yield emit({"type": "node_done", "node_id": node_id, "branch": branch})
                # Only queue the matching branch target
                for (target_id, handle) in adjacency.get(node_id, []):
                    if handle == branch:
                        queue.append(target_id)
                continue  # skip normal adjacency expansion below

            elif ntype == "llm_call":
                model_name = config.get("model", "openai/gpt-oss-120b")
                _aliases = {"groq/llama-3.3-70b": "openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile": "openai/gpt-oss-120b", "llama-3.3-70b": "openai/gpt-oss-120b"}
                model_name = _aliases.get(model_name, model_name)
                temperature = float(config.get("temperature", 0.7))
                system_prompt = config.get("system_prompt", "You are a helpful assistant.")
                user_prompt = config.get("user_prompt", "{input}").format(**{k: v for k, v in state.items() if v is not None})
                llm = ChatGroq(model=model_name, temperature=temperature, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
                for chunk in llm.stream(messages):
                    if chunk.content:
                        yield emit({"type": "token", "value": chunk.content})
                state["output"] = state.get("output", "")

            elif ntype == "output":
                pass  # terminal

            yield emit({"type": "node_done", "node_id": node_id})

            # Queue next nodes
            for (target_id, _) in adjacency.get(node_id, []):
                queue.append(target_id)

        yield emit({"type": "done"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
