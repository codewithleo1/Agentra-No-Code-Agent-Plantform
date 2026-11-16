import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.post("/{workflow_id}")
async def webhook_trigger(workflow_id: str, request: Request):
    """QStash calls this URL on each cron tick to run a scheduled workflow."""
    from app.routers.workflows import _workflows as wf_store
    if workflow_id not in wf_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    try:
        raw = await request.body()
        payload = json.loads(raw) if raw else {}
    except Exception:
        payload = {}

    user_input = payload.get("input", "Scheduled run")

    # Run the workflow synchronously (non-streaming) for background execution
    from app.compiler import compile_workflow
    wf = wf_store[workflow_id]
    try:
        graph = compile_workflow(wf.nodes, wf.edges)
        result = graph.invoke({"input": user_input})
    except Exception as exc:
        # Return 200 so QStash doesn't retry on our own errors
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=200)

    return JSONResponse({
        "status": "ok",
        "workflow_id": workflow_id,
        "output": (result or {}).get("final_output", ""),
    })
