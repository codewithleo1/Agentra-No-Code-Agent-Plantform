from __future__ import annotations
from typing import Any, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class NodeData(BaseModel):
    label: str
    nodeType: str
    config: dict[str, Any] = Field(default_factory=dict)
    baseColor: str = "#4f46e5"


class WorkflowNode(BaseModel):
    id: str
    type: str = "default"
    position: dict[str, float]
    data: NodeData


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]


class WorkflowResponse(BaseModel):
    id: str
    name: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    created_at: str


class RunCreate(BaseModel):
    workflow_id: UUID


class RunResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    output: str = ""
    error: str = ""
    created_at: str
