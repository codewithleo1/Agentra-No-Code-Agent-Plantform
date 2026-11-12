from pydantic import BaseModel, Field
from typing import Any
from uuid import UUID
from datetime import datetime


# --- Workflow models ---

class NodePosition(BaseModel):
    x: float
    y: float


class NodeData(BaseModel):
    label: str
    nodeType: str
    config: dict[str, Any] = Field(default_factory=dict)


class WorkflowNode(BaseModel):
    id: str
    type: str
    position: NodePosition
    data: NodeData


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]


class WorkflowResponse(BaseModel):
    id: UUID
    name: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    created_at: datetime


# --- Run models ---

class RunCreate(BaseModel):
    workflow_id: UUID


class RunResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    status: str  # queued | running | complete | failed
    created_at: datetime
