import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

router = APIRouter(tags=["deploy"])

_deployments: dict[str, dict[str, Any]] = {}
_api_keys: dict[str, str] = {}


class DeployResponse(BaseModel):
    workflow_id: str
    api_key: str
    endpoint: str
    curl_example: str
    widget_snippet: str


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
        d = _deployments[workflow_id]
        return DeployResponse(**d)

    api_key = f"agk_{secrets.token_urlsafe(32)}"
    endpoint = f"http://localhost:8000/agent/{workflow_id}"
    curl = f'curl -X POST {endpoint} -H "X-API-Key: {api_key}" -H "Content-Type: application/json" -d \'{{"input": "your query here"}}\''
    snippet = f'<script src="http://localhost:8000/widget/{workflow_id}?key={api_key}"></script>'

    deployment = {
        "workflow_id": workflow_id,
        "api_key": api_key,
        "endpoint": endpoint,
        "curl_example": curl,
        "widget_snippet": snippet,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _deployments[workflow_id] = deployment
    _api_keys[api_key] = workflow_id
    return DeployResponse(**deployment)


@router.get("/widget/{workflow_id}", response_class=HTMLResponse)
def get_widget(workflow_id: str, key: str):
    if _api_keys.get(key) != workflow_id:
        raise HTTPException(status_code=401, detail="Invalid API key")

    js = f"""
(function() {{
  var WF_ID = "{workflow_id}";
  var API_KEY = "{key}";
  var BASE = "http://localhost:8000";

  var style = document.createElement("style");
  style.textContent = `
    #agn-btn {{
      position:fixed; bottom:24px; right:24px; width:56px; height:56px;
      border-radius:50%; background:#7c3aed; border:none; cursor:pointer;
      box-shadow:0 4px 16px rgba(0,0,0,0.3); font-size:24px; z-index:9999;
      display:flex; align-items:center; justify-content:center; color:#fff;
    }}
    #agn-box {{
      position:fixed; bottom:96px; right:24px; width:360px; max-height:520px;
      background:#1a1a2e; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      display:none; flex-direction:column; z-index:9998; overflow:hidden;
      font-family:system-ui,sans-serif;
    }}
    #agn-header {{
      background:#7c3aed; padding:14px 18px; color:#fff; font-weight:600;
      font-size:14px; display:flex; justify-content:space-between; align-items:center;
    }}
    #agn-msgs {{
      flex:1; overflow-y:auto; padding:16px; display:flex;
      flex-direction:column; gap:10px; min-height:200px; max-height:360px;
    }}
    .agn-msg {{ padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.5; max-width:90%; }}
    .agn-user {{ background:#7c3aed22; color:#e2e8f0; align-self:flex-end; border-bottom-right-radius:4px; }}
    .agn-bot {{ background:#ffffff0f; color:#e2e8f0; align-self:flex-start; border-bottom-left-radius:4px; }}
    .agn-typing {{ color:#888; font-size:12px; padding:4px 14px; }}
    #agn-footer {{ padding:12px; border-top:1px solid #ffffff11; display:flex; gap:8px; }}
    #agn-input {{
      flex:1; background:#ffffff0f; border:1px solid #ffffff22; border-radius:8px;
      padding:8px 12px; color:#fff; font-size:13px; outline:none;
    }}
    #agn-send {{
      background:#7c3aed; border:none; border-radius:8px; padding:8px 14px;
      color:#fff; cursor:pointer; font-size:13px; font-weight:600;
    }}
  `;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "agn-btn"; btn.innerHTML = "&#x1F916;";
  document.body.appendChild(btn);

  var box = document.createElement("div"); box.id = "agn-box";
  box.innerHTML = `
    <div id="agn-header">
      <span>&#x1F680; Agentra Agent</span>
      <span id="agn-close" style="cursor:pointer;font-size:18px;">&#x2715;</span>
    </div>
    <div id="agn-msgs"></div>
    <div id="agn-footer">
      <input id="agn-input" type="text" placeholder="Ask something..." />
      <button id="agn-send">Send</button>
    </div>
  `;
  document.body.appendChild(box);

  btn.onclick = function() {{ box.style.display = box.style.display === "flex" ? "none" : "flex"; }};
  document.getElementById("agn-close").onclick = function() {{ box.style.display = "none"; }};

  function addMsg(text, role) {{
    var msgs = document.getElementById("agn-msgs");
    var d = document.createElement("div");
    d.className = "agn-msg agn-" + role;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }}

  document.getElementById("agn-send").onclick = send;
  document.getElementById("agn-input").addEventListener("keydown", function(e) {{
    if (e.key === "Enter") send();
  }});

  function send() {{
    var inp = document.getElementById("agn-input");
    var q = inp.value.trim();
    if (!q) return;
    inp.value = "";
    addMsg(q, "user");
    var typing = document.createElement("div");
    typing.className = "agn-typing"; typing.textContent = "Thinking…";
    document.getElementById("agn-msgs").appendChild(typing);

    fetch(BASE + "/agent/" + WF_ID, {{
      method: "POST",
      headers: {{"Content-Type": "application/json", "X-API-Key": API_KEY}},
      body: JSON.stringify({{input: q}})
    }})
    .then(function(r) {{ return r.json(); }})
    .then(function(data) {{
      typing.remove();
      addMsg(data.output || data.detail || "No response", "bot");
    }})
    .catch(function(err) {{
      typing.remove();
      addMsg("Error: " + err.message, "bot");
    }});
  }}
}})();
"""
    return HTMLResponse(content=js, media_type="application/javascript")


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
