from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import workflows, runs

app = FastAPI(
    title="Agentra API",
    version="0.1.0",
    description="Backend API for the Agentra visual AI agent platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows.router)
app.include_router(runs.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
