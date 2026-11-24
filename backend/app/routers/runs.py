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
    import hashlib, struct, math
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
        import urllib.request as _ur
        import urllib.parse as _up
        import base64 as _b64
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
                    req = _ur.Request(url, data=data, method="POST")
                    req.add_header("Content-Type", "application/x-www-form-urlencoded")
                    try:
                        import urllib.error
                        with _ur.urlopen(req, timeout=15) as resp:
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

            elif ntype == "slack":
                try:
                    import json as _j
                    webhook_url = config.get("webhook_url", "").strip()
                    if not webhook_url:
                        yield emit({"type": "error", "message": "Slack error: webhook_url is empty"})
                        return
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    payload = _j.dumps({"text": message}).encode()
                    req = _ur.Request(webhook_url, data=payload, method="POST")
                    req.add_header("Content-Type", "application/json")
                    with _ur.urlopen(req, timeout=15) as resp:
                        resp.read()
                    output_key = config.get("output_key", "slack_result")
                    state[output_key] = "Slack message sent"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Slack error: {exc}"})
                    return

            elif ntype == "whatsapp":
                try:
                    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
                    auth_token  = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
                    from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()
                    if not account_sid or not auth_token:
                        yield emit({"type": "error", "message": "WhatsApp error: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set"})
                        return
                    to_number = config.get("to_number", "").strip()
                    if not to_number:
                        yield emit({"type": "error", "message": "WhatsApp error: to_number is empty"})
                        return
                    if not to_number.startswith("whatsapp:"):
                        to_number = "whatsapp:" + to_number
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                    payload = _up.urlencode({"From": from_number, "To": to_number, "Body": message}).encode()
                    creds = _b64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
                    req = _ur.Request(url, data=payload, method="POST")
                    req.add_header("Authorization", f"Basic {creds}")
                    req.add_header("Content-Type", "application/x-www-form-urlencoded")
                    try:
                        with _ur.urlopen(req, timeout=15) as resp:
                            resp.read()
                    except Exception as _http_exc:
                        import urllib.error
                        if isinstance(_http_exc, urllib.error.HTTPError):
                            print("TWILIO ERROR:", _http_exc.read().decode())
                        raise
                    output_key = config.get("output_key", "whatsapp_result")
                    state[output_key] = "WhatsApp message sent"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"WhatsApp error: {exc}"})
                    return

            elif ntype == "transform":
                try:
                    operation  = config.get("operation", "set")
                    input_key  = config.get("input_key", "output")
                    output_key = config.get("output_key", "transformed")
                    value      = config.get("value", "")
                    source     = str(state.get(input_key, ""))
                    if operation == "set":
                        result = value.format(**{k: v for k, v in state.items() if v is not None})
                    elif operation == "append":
                        result = source + value
                    elif operation == "prepend":
                        result = value + source
                    elif operation == "uppercase":
                        result = source.upper()
                    elif operation == "lowercase":
                        result = source.lower()
                    elif operation == "replace":
                        if "|" in value:
                            find, rep = value.split("|", 1)
                            result = source.replace(find, rep)
                        else:
                            result = source
                    elif operation == "extract_json":
                        import json as _j
                        try:
                            parsed = _j.loads(source)
                            result = str(parsed.get(value, ""))
                        except Exception:
                            result = ""
                    else:
                        result = source
                    state[output_key] = result
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Transform error: {exc}"})
                    return

            elif ntype == "output":
                final = state.get("output", state.get("search_results", state.get("input", "")))
                yield emit({"type": "output", "content": final})

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

    user_input = body.input

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
        import urllib.request as _ur
        import urllib.parse as _up
        import base64 as _b64
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
                model_name = config.get("model", "") or "openai/gpt-oss-120b"
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

            elif ntype == "slack":
                try:
                    import json as _j
                    webhook_url = config.get("webhook_url", "").strip()
                    if not webhook_url:
                        yield emit({"type": "error", "message": "Slack error: webhook_url is empty"})
                        return
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    payload = _j.dumps({"text": message}).encode()
                    req = _ur.Request(webhook_url, data=payload, method="POST")
                    req.add_header("Content-Type", "application/json")
                    with _ur.urlopen(req, timeout=15) as resp:
                        resp.read()
                    output_key = config.get("output_key", "slack_result")
                    state[output_key] = "Slack message sent"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Slack error: {exc}"})
                    return

            elif ntype == "whatsapp":
                try:
                    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
                    auth_token  = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
                    from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()
                    if not account_sid or not auth_token:
                        yield emit({"type": "error", "message": "WhatsApp error: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set"})
                        return
                    to_number = config.get("to_number", "").strip()
                    if not to_number:
                        yield emit({"type": "error", "message": "WhatsApp error: to_number is empty"})
                        return
                    if not to_number.startswith("whatsapp:"):
                        to_number = "whatsapp:" + to_number
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                    payload = _up.urlencode({"From": from_number, "To": to_number, "Body": message}).encode()
                    creds = _b64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
                    req = _ur.Request(url, data=payload, method="POST")
                    req.add_header("Authorization", f"Basic {creds}")
                    req.add_header("Content-Type", "application/x-www-form-urlencoded")
                    try:
                        with _ur.urlopen(req, timeout=15) as resp:
                            resp.read()
                    except Exception as _http_exc:
                        import urllib.error
                        if isinstance(_http_exc, urllib.error.HTTPError):
                            print("TWILIO ERROR:", _http_exc.read().decode())
                        raise
                    output_key = config.get("output_key", "whatsapp_result")
                    state[output_key] = "WhatsApp message sent"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"WhatsApp error: {exc}"})
                    return
            elif ntype == "sms":
                try:
                    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
                    auth_token  = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
                    from_number = os.environ.get("TWILIO_SMS_FROM", "").strip()
                    if not account_sid or not auth_token or not from_number:
                        yield emit({"type": "error", "message": "SMS error: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_SMS_FROM not set"})
                        return
                    to_number = config.get("to_number", "").strip()
                    if not to_number:
                        yield emit({"type": "error", "message": "SMS error: to_number is empty"})
                        return
                    raw_msg = config.get("message", "{output}")
                    try:
                        message = raw_msg.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        message = raw_msg
                    if not message.strip():
                        message = str(state.get("output", "No output"))
                    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                    payload = _up.urlencode({"From": from_number, "To": to_number, "Body": message}).encode()
                    creds = _b64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
                    req = _ur.Request(url, data=payload, method="POST")
                    req.add_header("Authorization", f"Basic {creds}")
                    req.add_header("Content-Type", "application/x-www-form-urlencoded")
                    with _ur.urlopen(req, timeout=15) as resp:
                        resp.read()
                    output_key = config.get("output_key", "sms_result")
                    state[output_key] = "SMS sent"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"SMS error: {exc}"})
                    return

            elif ntype == "transform":
                try:
                    operation  = config.get("operation", "set")
                    input_key  = config.get("input_key", "output")
                    output_key = config.get("output_key", "transformed")
                    value      = config.get("value", "")
                    source     = str(state.get(input_key, ""))

                    if operation == "set":
                        result = value.format(**{k: v for k, v in state.items() if v is not None})
                    elif operation == "append":
                        result = source + value
                    elif operation == "prepend":
                        result = value + source
                    elif operation == "uppercase":
                        result = source.upper()
                    elif operation == "lowercase":
                        result = source.lower()
                    elif operation == "replace":
                        if "|" in value:
                            find, rep = value.split("|", 1)
                            result = source.replace(find, rep)
                        else:
                            result = source
                    elif operation == "extract_json":
                        import json as _j
                        try:
                            parsed = _j.loads(source)
                            result = str(parsed.get(value, ""))
                        except Exception:
                            result = ""
                    else:
                        result = source

                    state[output_key] = result
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Transform error: {exc}"})
                    return

            elif ntype == "loop":
                try:
                    input_key  = config.get("input_key", "output")
                    output_key = config.get("output_key", "loop_results")
                    separator  = config.get("separator", "\n\n")
                    source     = str(state.get(input_key, ""))
                    if separator == "comma":
                        items = [i.strip() for i in source.split(",") if i.strip()]
                    else:
                        items = [i.strip() for i in source.split(separator) if i.strip()]
                    state[output_key] = items
                    state["loop_count"] = len(items)
                    state["loop_items"] = "\n".join(f"{i+1}. {item}" for i, item in enumerate(items))
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Loop error: {exc}"})
                    return

            elif ntype == "gmail":
                try:
                    import urllib.parse, json as _j
                    client_id     = os.environ.get("GMAIL_CLIENT_ID", "").strip()
                    client_secret = os.environ.get("GMAIL_CLIENT_SECRET", "").strip()
                    refresh_token = os.environ.get("GMAIL_REFRESH_TOKEN", "").strip()
                    from_addr     = os.environ.get("GMAIL_FROM", "").strip()
                    if not all([client_id, client_secret, refresh_token, from_addr]):
                        yield emit({"type": "error", "message": "Gmail error: missing env vars"})
                        return
                    # Get access token
                    token_data = urllib.parse.urlencode({
                        "client_id": client_id, "client_secret": client_secret,
                        "refresh_token": refresh_token, "grant_type": "refresh_token"
                    }).encode()
                    token_req = _ur.Request("https://oauth2.googleapis.com/token", data=token_data, method="POST")
                    with _ur.urlopen(token_req, timeout=15) as r:
                        access_token = _j.loads(r.read())["access_token"]
                    # Build email
                    to_addr = config.get("to", "").strip()
                    subject = config.get("subject", "Agent Output")
                    try:
                        subject = subject.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        pass
                    body = config.get("body", "{output}")
                    try:
                        body = body.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        pass
                    import base64, email.mime.text, email.mime.multipart
                    msg = email.mime.multipart.MIMEMultipart()
                    msg["To"] = to_addr
                    msg["From"] = from_addr
                    msg["Subject"] = subject
                    msg.attach(email.mime.text.MIMEText(body, "plain"))
                    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
                    send_req = _ur.Request(
                        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                        data=_j.dumps({"raw": raw}).encode(), method="POST"
                    )
                    send_req.add_header("Authorization", f"Bearer {access_token}")
                    send_req.add_header("Content-Type", "application/json")
                    with _ur.urlopen(send_req, timeout=15) as r:
                        r.read()
                    state[config.get("output_key", "gmail_result")] = f"Gmail sent to {to_addr}"
                except Exception as exc:
                    yield emit({"type": "error", "message": f"Gmail error: {exc}"})
                    return

            elif ntype == "youtube":
                try:
                    from youtube_transcript_api import YouTubeTranscriptApi
                    url = config.get("url", state.get("input", "")).strip()
                    try:
                        url = url.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        pass
                    # Extract video ID
                    if "v=" in url:
                        video_id = url.split("v=")[1].split("&")[0]
                    elif "youtu.be/" in url:
                        video_id = url.split("youtu.be/")[1].split("?")[0]
                    else:
                        video_id = url.strip()
                    transcript = YouTubeTranscriptApi().fetch(video_id)
                    text = " ".join(entry.text for entry in transcript)
                    output_key = config.get("output_key", "transcript")
                    state[output_key] = text[:10000]
                    state["output"] = text[:10000]
                except Exception as exc:
                    yield emit({"type": "error", "message": f"YouTube error: {exc}"})
                    return

            elif ntype == "pdf_reader":
                try:
                    import fitz  # pymupdf
                    import tempfile, os as _os
                    url = config.get("url", state.get("input", "")).strip()
                    try:
                        url = url.format(**{k: v for k, v in state.items() if v is not None})
                    except Exception:
                        pass
                    max_chars = int(config.get("max_chars", 8000))
                    req = _ur.Request(url, headers={"User-Agent": "Agentra/1.0"})
                    with _ur.urlopen(req, timeout=30) as resp:
                        pdf_bytes = resp.read()
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        tmp.write(pdf_bytes)
                        tmp_path = tmp.name
                    try:
                        doc = fitz.open(tmp_path)
                        text = "\n\n".join(page.get_text() for page in doc)
                        doc.close()
                    finally:
                        _os.unlink(tmp_path)
                    output_key = config.get("output_key", "pdf_text")
                    state[output_key] = text[:max_chars]
                    state["output"] = text[:max_chars]
                except Exception as exc:
                    yield emit({"type": "error", "message": f"PDF Reader error: {exc}"})
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