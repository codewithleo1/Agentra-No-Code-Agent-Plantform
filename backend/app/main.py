from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from app.routers import workflows, runs  # noqa: E402

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
