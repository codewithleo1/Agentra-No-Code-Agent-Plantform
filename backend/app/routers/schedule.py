import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/schedule", tags=["schedule"])

# In-memory store: workflow_id -> schedule_id from QStash
_schedules: dict[str, str] = {}


class ScheduleRequest(BaseModel):
    cron: str = "0 9 * * *"          # default: every day at 9 AM UTC
    input: str = ""                   # payload sent to webhook on each tick
    base_url: str = "https://your-render-url.onrender.com"  # public backend URL


class ScheduleResponse(BaseModel):
    workflow_id: str
    schedule_id: str
    cron: str
    webhook_url: str


@router.post("/{workflow_id}", response_model=ScheduleResponse)
def create_schedule(workflow_id: str, body: ScheduleRequest):
    from qstash import QStash
    from app.routers.workflows import _workflows as wf_store
    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    client = QStash(token=os.environ["QSTASH_TOKEN"])
    webhook_url = f"{body.base_url.rstrip('/')}/webhook/{workflow_id}"

    # Remove existing schedule for this workflow if any
    if workflow_id in _schedules:
        try:
            client.schedules.delete(_schedules[workflow_id])
        except Exception:
            pass

    schedule = client.schedules.create(
        destination=webhook_url,
        cron=body.cron,
        body=f'{{"input": "{body.input}"}}',
        headers={"Content-Type": "application/json"},
    )
    _schedules[workflow_id] = schedule.schedule_id
    return ScheduleResponse(
        workflow_id=workflow_id,
        schedule_id=schedule.schedule_id,
        cron=body.cron,
        webhook_url=webhook_url,
    )


@router.delete("/{workflow_id}")
def delete_schedule(workflow_id: str):
    if workflow_id not in _schedules:
        raise HTTPException(status_code=404, detail="No schedule found for this workflow")
    from qstash import QStash
    client = QStash(token=os.environ["QSTASH_TOKEN"])
    try:
        client.schedules.delete(_schedules[workflow_id])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"QStash error: {exc}")
    del _schedules[workflow_id]
    return {"detail": "Schedule deleted"}


@router.get("/{workflow_id}")
def get_schedule(workflow_id: str):
    if workflow_id not in _schedules:
        raise HTTPException(status_code=404, detail="No schedule found")
    return {"workflow_id": workflow_id, "schedule_id": _schedules[workflow_id]}
