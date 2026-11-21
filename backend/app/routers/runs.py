import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.compiler import compile_workflow, _ssrf_check
from app.models import RunCreate, RunResponse
from pydantic import BaseModel

router = APIRouter(prefix="/runs", tags=["runs"])
_runs: dict[str, dict[str, Any]] = {}


class StreamRequest(BaseModel):
    input: str = "Hello from Agentra!"


def _get_workflows_store() -> dict:
    from app.routers.workflows import _workflows as wf_store
    return wf_store


def _qdrant_client():
    import os
    from qdrant_client import QdrantClient
    return QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"])


def _text_to_vec(text: str, dim: int = 384) -> list[float]:
    """Deterministic pseudo-vector from text � Phase 2 placeholder for real embeddings."""
    import hashlib
    import struct
    import math
    result = []
    seed = text.encode()
    i = 0
    while len(result) < dim:
        h = hashlib.sha256(seed + i.to_bytes(4, 'little')).digest()
        for j in range(0, len(h) - 3, 4):
            if len(result) >= dim:
                break
            val = struct.unpack('f', h[j:j+4])[0]
            if math.isfinite(val):
                result.append(val)
        i += 1
    return result[:dim]


def _memory_write(collection: str, text: str) -> None:
    from qdrant_client.models import Distance, VectorParams, PointStruct
    client = _qdrant_client()
    dim = 384
    existing = [c.name for c in client.get_collections().collections]
    if collection not in existing:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
    client.upsert(
        collection_name=collection,
        points=[PointStruct(
            id=str(uuid.uuid4()),
            vector=_text_to_vec(text, dim),
            payload={"text": text},
        )],
    )


def _memory_read(collection: str, query: str, top_k: int) -> str:
    client = _qdrant_client()
    existing = [c.name for c in client.get_collections().collections]
    if collection not in existing:
        return ""
    results = client.query_points(
        collection_name=collection,
        query=_text_to_vec(query, 384),
        limit=top_k,
    ).points
    return "\n---\n".join(r.payload.get("text", "") for r in results if r.payload)


@router.post("/", status_code=201, response_model=RunResponse)
def create_run(body: RunCreate) -> RunResponse:
    wf_store = _get_workflows_store()
    wf_id = str(body.workflow_id)
    if wf_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")
    wf = wf_store[wf_id]
    try:
        graph = compile_workflow(wf.nodes, wf.edges)
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

        adjacency: dict[str, list[tuple[str, str | None]]] = {}
        for e in edges:
            adjacency.setdefault(e.source, []).append((e.target, e.sourceHandle))

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
                        import json as _j
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
                            state[output_key] = _j.dumps(_j.loads(raw), indent=2)[:8000]
                        except Exception:
                            state[output_key] = raw[:8000]
                    else:
                        yield emit({"type": "error", "message": f"Unknown tool_id: {tool_id}"})
                        return
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Tool error: {exc}"})
                    return

            elif ntype == "memory":
                try:
                    operation = config.get("operation", "read")
                    collection = config.get("collection", "agentra_memory")
                    top_k = int(config.get("top_k", 3))
                    text_key = config.get("text_key", "input")
                    if operation == "write":
                        text = state.get(text_key, state.get("input", ""))
                        _memory_write(collection, text)
                    else:
                        state["memory_results"] = _memory_read(collection, state.get("input", ""), top_k)
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Memory error: {exc}"})
                    return

            elif ntype == "condition":
                expression = config.get("condition", "True")
                result = _eval_condition(expression, state)
                branch = "true" if result else "false"
                yield emit({"type": "node_done", "node_id": node_id, "branch": branch})
                for (target_id, handle) in adjacency.get(node_id, []):
                    if handle == branch:
                        queue.append(target_id)
                continue

            elif ntype == "llm_call":
                model_name = config.get("model", "") or "openai/gpt-oss-120b"
                temperature = float(config.get("temperature", 0.7))
                system_prompt = config.get("system_prompt", "You are a helpful assistant.")
                user_prompt = config.get("user_prompt", "{input}").format(**{k: v for k, v in state.items() if v is not None})
                llm = ChatGroq(model=model_name, temperature=temperature, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
                for chunk in llm.stream(messages):
                    if chunk.content:
                        yield emit({"type": "token", "value": chunk.content})
                        state["output"] = state.get("output", "") + chunk.content

            elif ntype == "telegram":
                try:
                    import urllib.request
                    import urllib.parse
                    import json as _json
                    token = os.environ["TELEGRAM_BOT_TOKEN"]
                    chat_id = config.get("chat_id", "")
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    url = f"https://api.telegram.org/bot{token}/sendMessage"
                    if not chat_id:
                        yield emit({"type": "error", "message": "Telegram error: chat_id is empty"})
                        return
                    data = urllib.parse.urlencode({"chat_id": chat_id, "text": message or "test"}).encode()
                    req = urllib.request.Request(url, data=data, method="POST")
                    req.add_header("Content-Type", "application/x-www-form-urlencoded")
                    try:
                        with urllib.request.urlopen(req, timeout=15) as resp:
                            result = _json.loads(resp.read().decode())
                    except urllib.error.HTTPError as e:
                        err_body = e.read().decode()
                        yield emit({"type": "error", "message": f"Telegram API error: {err_body}"})
                        return
                    output_key = config.get("output_key", "telegram_result")
                    state[output_key] = f"Telegram sent: {result.get('ok')}"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Telegram error: {exc}"})
                    return

            elif ntype == "sheets":
                try:
                    import json as _json
                    import gspread
                    from google.oauth2.service_account import Credentials
                    sa_json = _json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
                    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
                    creds = Credentials.from_service_account_info(sa_json, scopes=scopes)
                    gc = gspread.authorize(creds)
                    spreadsheet_id = config.get("spreadsheet_id", "")
                    sheet_name = config.get("sheet_name", "Sheet1")
                    operation = config.get("operation", "append")
                    sh = gc.open_by_key(spreadsheet_id)
                    ws = sh.worksheet(sheet_name)
                    output_key = config.get("output_key", "sheets_result")
                    if operation == "read":
                        rows = ws.get_all_values()
                        state[output_key] = _json.dumps(rows[:20])
                    else:
                        values_raw = config.get("values", "{output}").format(**{k: v for k, v in state.items() if v is not None})
                        ws.append_row([values_raw])
                        state[output_key] = f"Appended row to {sheet_name}"
                except Exception as exc:
                    import traceback
                    yield emit({"type": "error", "message": f"Sheets error: {exc} | {traceback.format_exc()}"})
                    return

            elif ntype == "email":
                try:
                    import resend
                    resend.api_key = os.environ["RESEND_API_KEY"]
                    to_addr = config.get("to", "")
                    subject = config.get("subject", "Agent Output").format(**{k: v for k, v in state.items() if v is not None})
                    body = config.get("body", "{output}").format(**{k: v for k, v in state.items() if v is not None})
                    resend.Emails.send({
                        "from": "Agentra <onboarding@resend.dev>",
                        "to": [to_addr],
                        "subject": subject,
                        "text": body,
                    })
                    output_key = config.get("output_key", "email_result")
                    state[output_key] = f"Email sent to {to_addr}"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Email error: {exc}"})
                    return

            elif ntype == "output":
                pass

            yield emit({"type": "node_done", "node_id": node_id})
            for (target_id, _) in adjacency.get(node_id, []):
                queue.append(target_id)

        yield emit({"type": "done"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")

class DirectNode(BaseModel):
    id: str
    type: str
    config: dict = {}

class DirectEdge(BaseModel):
    source: str
    target: str
    sourceHandle: str | None = None

class DirectStreamRequest(BaseModel):
    input: str = ""
    nodes: list[DirectNode] = []
    edges: list[DirectEdge] = []

@router.post("/stream")
def stream_direct(body: DirectStreamRequest, request: Request):
    import os as _os
    from supabase import create_client as _sb_client

    # ── Plan enforcement ─────────────────────────────────────────────────
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    sb = _sb_client(_os.environ["SUPABASE_URL"], _os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    user_resp = sb.auth.get_user(token)
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = user_resp.user.id

    prof = sb.table("profiles").select("*").eq("id", user_id).single().execute().data
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")

    now = datetime.now(timezone.utc)
    if now.isoformat() > prof["runs_reset_at"]:
        m, y = (now.month % 12) + 1, now.year + (1 if now.month == 12 else 0)
        sb.table("profiles").update({
            "runs_this_month": 0,
            "runs_reset_at": datetime(y, m, 1, tzinfo=timezone.utc).isoformat()
        }).eq("id", user_id).execute()
        prof["runs_this_month"] = 0

    if prof["plan"] == "free" and prof["runs_this_month"] >= 500:
        raise HTTPException(status_code=429, detail="Free plan limit: 500 runs/month reached.")
    # ────────────────────────────────────────────────────────────────────

    user_input = body.input

    # Wrap into objects matching what event_stream expects
    class _D:
        def __init__(self, node_type, config):
            self.nodeType = node_type
            self.config = config
    class _N:
        def __init__(self, n):
            self.id = n.id
            self.data = _D(n.type, n.config)
    class _E:
        def __init__(self, e):
            self.source = e.source
            self.target = e.target
            self.sourceHandle = e.sourceHandle

    nodes = [_N(n) for n in body.nodes]
    edges = [_E(e) for e in body.edges]

    adjacency: dict[str, list[tuple[str, str | None]]] = {}
    for e in edges:
        adjacency.setdefault(e.source, []).append((e.target, e.sourceHandle))

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

        trigger_node = next((n for n in nodes if n.data.nodeType == "trigger"), None)
        if not trigger_node:
            yield emit({"type": "error", "message": "No trigger node found"})
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
                    tool_id = config.get("tool_id", "tavily_search")
                    params = config.get("params", {})
                    output_key = config.get("output_key", "search_results")
                    if tool_id in ("tavily_search", ""):
                        from tavily import TavilyClient
                        client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
                        query = params.get("query", state.get("input", ""))
                        try:
                            query = query.format(**{k: v for k, v in state.items() if v is not None})
                        except Exception:
                            pass
                        response = client.search(query=query, max_results=int(params.get("max_results", 5)))
                        state[output_key] = "\n\n".join(
                            f"**{r.get('title','')}**\n{r.get('content','')}\nSource: {r.get('url','')}"
                            for r in response.get("results", [])
                        )
                    else:
                        yield emit({"type": "error", "message": f"Unknown tool_id: {tool_id}"})
                        return
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Tool error: {exc}"})
                    return

            elif ntype == "llm_call":
                model_name = config.get("model", "") or "openai/gpt-oss-20b"
                temperature = float(config.get("temperature", 0.7))
                system_prompt = config.get("system_prompt", "You are a helpful assistant.")
                user_prompt_tpl = config.get("user_prompt", "{input}")
                try:
                    user_prompt = user_prompt_tpl.format(**{k: v for k, v in state.items() if v is not None})
                except Exception:
                    user_prompt = user_prompt_tpl
                llm = ChatGroq(model=model_name, temperature=temperature, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
                for chunk in llm.stream(messages):
                    if chunk.content:
                        yield emit({"type": "token", "value": chunk.content})
                        state["output"] = state.get("output", "") + chunk.content

            elif ntype == "condition":
                expression = config.get("condition", "True")
                result = _eval_condition(expression, state)
                branch = "true" if result else "false"
                yield emit({"type": "node_done", "node_id": node_id, "branch": branch})
                for (target_id, handle) in adjacency.get(node_id, []):
                    if handle == branch:
                        queue.append(target_id)
                continue

            elif ntype == "memory":
                try:
                    operation = config.get("operation", "read")
                    collection = config.get("collection", "agentra_memory")
                    top_k = int(config.get("top_k", 3))
                    text_key = config.get("text_key", "input")
                    if operation == "write":
                        _memory_write(collection, state.get(text_key, state.get("input", "")))
                    else:
                        state["memory_results"] = _memory_read(collection, state.get("input", ""), top_k)
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Memory error: {exc}"})
                    return

            elif ntype == "output":
                final = state.get("output", state.get("search_results", state.get("input", "")))
                yield emit({"type": "output", "content": final})

            yield emit({"type": "node_done", "node_id": node_id})
            for (target_id, _) in adjacency.get(node_id, []):
                queue.append(target_id)

        yield emit({"type": "done"})
        sb.table("profiles").update(
            {"runs_this_month": prof["runs_this_month"] + 1}
        ).eq("id", user_id).execute()

    return StreamingResponse(event_stream(), media_type="text/event-stream")

