"""
Tests for the Workflow JSON → LangGraph compiler.
These tests do NOT call Groq — they verify graph structure only.
"""
import pytest
from app.compiler import compile_workflow
from app.models import WorkflowNode, WorkflowEdge, NodeData, NodePosition


def make_node(id: str, node_type: str, config: dict = {}) -> WorkflowNode:
    return WorkflowNode(
        id=id,
        type="default",
        position=NodePosition(x=0, y=0),
        data=NodeData(label=node_type, nodeType=node_type, config=config),
    )


def make_edge(source: str, target: str) -> WorkflowEdge:
    return WorkflowEdge(id=f"{source}-{target}", source=source, target=target)


# --- Tests ---

def test_compile_basic_workflow():
    """A 3-node workflow compiles without error."""
    nodes = [
        make_node("n1", "trigger", {"kind": "manual"}),
        make_node("n2", "llm_call", {"model": "groq/llama-3.3-70b", "temperature": 0.3}),
        make_node("n3", "output", {"store_result": "false"}),
    ]
    edges = [make_edge("n1", "n2"), make_edge("n2", "n3")]
    graph = compile_workflow(nodes, edges)
    assert graph is not None


def test_compile_fails_without_trigger():
    """A workflow with no trigger node raises ValueError."""
    nodes = [
        make_node("n1", "llm_call"),
        make_node("n2", "output"),
    ]
    edges = [make_edge("n1", "n2")]
    with pytest.raises(ValueError, match="trigger"):
        compile_workflow(nodes, edges)


def test_compile_fails_with_unknown_node_type():
    """A workflow with an unknown node type raises ValueError."""
    nodes = [
        make_node("n1", "trigger"),
        make_node("n2", "unknown_node"),
    ]
    edges = [make_edge("n1", "n2")]
    with pytest.raises(ValueError, match="Unknown node type"):
        compile_workflow(nodes, edges)


def test_compile_trigger_only():
    """A single trigger node compiles (no edges needed)."""
    nodes = [make_node("n1", "trigger", {"kind": "manual"})]
    edges = []
    graph = compile_workflow(nodes, edges)
    assert graph is not None
