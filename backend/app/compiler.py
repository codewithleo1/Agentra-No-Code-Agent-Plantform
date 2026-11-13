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


# ---------------------------------------------------------------------------
# Node factories
# ---------------------------------------------------------------------------

def make_trigger_node(node: WorkflowNode):
    def trigger(state: WorkflowState) -> WorkflowState:
        return {"triggered_by": node.data.config.get("kind", "manual")}
    return trigger


def make_llm_node(node: WorkflowNode):
    config = node.data.config
    model_name: str = config.get("model", "openai/gpt-oss-120b")
    _MODEL_ALIASES = {
        "groq/llama-3.3-70b-versatile": "openai/gpt-oss-120b",
        "groq/llama-3.3-70b": "openai/gpt-oss-120b",
        "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
        "llama-3.3-70b": "openai/gpt-oss-120b",
    }
    model_name = _MODEL_ALIASES.get(model_name, model_name)
    temperature: float = float(config.get("temperature", 0.7))
    system_prompt: str = config.get("system_prompt", "You are a helpful assistant.")
    user_prompt: str = config.get("user_prompt", "{input}")

    def llm_call(state: WorkflowState) -> WorkflowState:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatGroq(model=model_name, temperature=temperature)
        prompt = user_prompt.format(**state)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        return {"output": response.content}

    return llm_call


def make_output_node(node: WorkflowNode):
    def output(state: WorkflowState) -> WorkflowState:
        return {"final_output": state.get("output", "")}
    return output


NODE_FACTORIES: dict[str, Any] = {
    "trigger": make_trigger_node,
    "llm_call": make_llm_node,
    "output": make_output_node,
}


# ---------------------------------------------------------------------------
# Compiler
# ---------------------------------------------------------------------------

def compile_workflow(nodes: list[WorkflowNode], edges: list[WorkflowEdge]):
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