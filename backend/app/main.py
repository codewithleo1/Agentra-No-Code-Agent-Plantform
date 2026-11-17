from dotenv import load_dotenv
load_dotenv(dotenv_path=r"C:\Users\suraj\Documents\Projects\AI Agent\Agentra\backend\.env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from app.routers import workflows, runs, deploy, schedule, webhook, marketplace  # noqa: E402
from app.middleware.auth import AuthMiddleware  # noqa: E402

app = FastAPI(title="Agentra API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)

app.include_router(workflows.router)
app.include_router(runs.router)
app.include_router(deploy.router)
app.include_router(schedule.router)
app.include_router(webhook.router)
app.include_router(marketplace.router)