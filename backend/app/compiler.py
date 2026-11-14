from __future__ import annotations
from typing import Any
from typing_extensions import TypedDict
from langgraph.graph import END, StateGraph
from app.models import WorkflowEdge, WorkflowNode


class WorkflowState(TypedDict, total=False):
    input: str
    triggered_by: str
    output: str
    final_output: str
    search_results: str
    page_content: str
    http_response: str


_MODEL_ALIASES = {
    "groq/llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "groq/llama-3.3-70b": "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.3-70b": "openai/gpt-oss-120b",
}

_SSRF_BLOCKED = (
    "localhost", "127.", "0.0.0.0", "169.254.",
    "10.", "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
    "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
    "172.30.", "172.31.", "192.168.", "::1", "metadata.google",
)

def _ssrf_check(url: str) -> None:
    lower = url.lower()
    for blocked in _SSRF_BLOCKED:
        if blocked in lower:
            raise ValueError(f"SSRF blocked: requests to {blocked} are not allowed")


def make_trigger_node(node):
    def trigger(state):
        return {"triggered_by": node.data.config.get("kind", "manual")}
    return trigger


def make_llm_node(node):
    config = node.data.config
    model_name = _MODEL_ALIASES.get(config.get("model", "openai/gpt-oss-120b"), config.get("model", "openai/gpt-oss-120b"))
    temperature = float(config.get("temperature", 0.7))
    system_prompt = config.get("system_prompt", "You are a helpful assistant.")
    user_prompt = config.get("user_prompt", "{input}")

    def llm_call(state):
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage
        llm = ChatGroq(model=model_name, temperature=temperature)
        prompt = user_prompt.format(**{k: v for k, v in state.items() if v is not None})
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        return {"output": response.content}
    return llm_call


def make_tool_node(node):
    config = node.data.config
    tool_id = config.get("tool_id", "")
    params = config.get("params", {})
    output_key = config.get("output_key", "search_results")

    if tool_id == "tavily_search":
        def tavily_search(state):
            import os
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
            return {output_key: formatted}
        return tavily_search

    if tool_id == "jina_reader":
        def jina_reader(state):
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
            return {output_key: content[:8000]}
        return jina_reader

    if tool_id == "http_request":
        def http_request(state):
            import json as _json
            import urllib.request
            url_template = params.get("url", "")
            url = url_template.format(**{k: v for k, v in state.items() if v is not None})
            _ssrf_check(url)
            method = params.get("method", "GET").upper()
            headers = params.get("headers", {})
            body_template = params.get("body", "")
            body = body_template.format(**{k: v for k, v in state.items() if v is not None}) if body_template else None
            data = body.encode() if body else None
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("User-Agent", "Agentra/1.0")
            for k, v in headers.items():
                req.add_header(k, v)
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8")
            # Try to pretty-print JSON, fall back to raw text
            try:
                parsed = _json.loads(raw)
                result = _json.dumps(parsed, indent=2)[:8000]
            except Exception:
                result = raw[:8000]
            return {output_key: result}
        return http_request

    raise ValueError(f"Unknown tool_id: {tool_id!r}")


def make_output_node(node):
    def output(state):
        return {"final_output": state.get("output", state.get("search_results", state.get("page_content", state.get("http_response", ""))))}
    return output


NODE_FACTORIES = {
    "trigger": make_trigger_node,
    "llm_call": make_llm_node,
    "tool": make_tool_node,
    "output": make_output_node,
}


def compile_workflow(nodes, edges):
    for node in nodes:
        if node.data.nodeType not in NODE_FACTORIES:
            raise ValueError(f"Unknown node type: {node.data.nodeType!r}")

    trigger_nodes = [n for n in nodes if n.data.nodeType == "trigger"]
    if not trigger_nodes:
        raise ValueError("Workflow must have at least one trigger node")

    graph = StateGraph(WorkflowState)
    for node in nodes:
        factory = NODE_FACTORIES[node.data.nodeType]
        graph.add_node(node.id, factory(node))

    graph.set_entry_point(trigger_nodes[0].id)

    sources = {e.source for e in edges}
    for edge in edges:
        graph.add_edge(edge.source, edge.target)

    for node in nodes:
        if node.id not in sources:
            graph.add_edge(node.id, END)

    return graph.compile()
