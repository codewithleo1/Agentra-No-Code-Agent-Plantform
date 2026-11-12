from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from app.models import WorkflowEdge, WorkflowNode


class WorkflowState(dict):
    """Typed alias for the LangGraph state dict."""
    pass


# ---------------------------------------------------------------------------
# Node factories
# ---------------------------------------------------------------------------

def make_trigger_node(node: WorkflowNode):
    def trigger(state: WorkflowState) -> WorkflowState:
        return {**state, "triggered_by": node.data.config.get("kind", "manual")}
    return trigger


def make_llm_node(node: WorkflowNode):
    config = node.data.config
    model_name: str = config.get("model", "groq/llama-3.3-70b")
    # Strip "groq/" prefix — langchain_groq expects bare model name
    if model_name.startswith("groq/"):
        model_name = model_name[len("groq/"):]
    temperature: float = float(config.get("temperature", 0.7))
    system_prompt: str = config.get("system_prompt", "You are a helpful assistant.")
    user_prompt: str = config.get("user_prompt", "{input}")

    def llm_call(state: WorkflowState) -> WorkflowState:
        # Lazy import — only runs when the node executes, not at compile time
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatGroq(model=model_name, temperature=temperature)
        prompt = user_prompt.format(**state)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        return {**state, "output": response.content}

    return llm_call


def make_output_node(node: WorkflowNode):
    def output(state: WorkflowState) -> WorkflowState:
        return {**state, "final_output": state.get("output", "")}
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
    """Convert a list of canvas nodes + edges into a compiled LangGraph StateGraph."""
    # Validate all node types up front
    for node in nodes:
        if node.data.nodeType not in NODE_FACTORIES:
            raise ValueError(f"Unknown node type: {node.data.nodeType!r}")

    # Ensure there is exactly one trigger
    trigger_nodes = [n for n in nodes if n.data.nodeType == "trigger"]
    if not trigger_nodes:
        raise ValueError("Workflow must have at least one trigger node")

    graph = StateGraph(WorkflowState)

    # Add all nodes
    for node in nodes:
        factory = NODE_FACTORIES[node.data.nodeType]
        graph.add_node(node.id, factory(node))

    # Set entry point to the first trigger
    graph.set_entry_point(trigger_nodes[0].id)

    # Build a set of nodes that have outgoing edges
    targets = {e.target for e in edges}

    # Add edges; wire nodes with no outgoing edges to END
    for edge in edges:
        graph.add_edge(edge.source, edge.target)

    for node in nodes:
        if node.id not in targets and node.data.nodeType == "output":
            graph.add_edge(node.id, END)

    return graph.compile()