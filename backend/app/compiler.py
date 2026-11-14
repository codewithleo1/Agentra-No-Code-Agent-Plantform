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


_MODEL_ALIASES = {
    "groq/llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "groq/llama-3.3-70b": "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.3-70b": "openai/gpt-oss-120b",
}


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
            # Resolve query template against state
            query_template = params.get("query", state.get("input", ""))
            query = query_template.format(**{k: v for k, v in state.items() if v is not None})
            max_results = int(params.get("max_results", 5))
            response = client.search(query=query, max_results=max_results)
            # Format results as readable text
            results = response.get("results", [])
            formatted = "\n\n".join(
                f"**{r.get('title', '')}**\n{r.get('content', '')}\nSource: {r.get('url', '')}"
                for r in results
            )
            return {output_key: formatted}
        return tavily_search

    raise ValueError(f"Unknown tool_id: {tool_id!r}")


def make_output_node(node):
    def output(state):
        return {"final_output": state.get("output", state.get("search_results", ""))}
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
