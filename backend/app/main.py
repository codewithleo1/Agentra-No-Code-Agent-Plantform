from dotenv import load_dotenv
load_dotenv(dotenv_path=r"C:\Users\suraj\Documents\Projects\AI Agent\Agentra\backend\.env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import workflows, runs, deploy, schedule, webhook

app = FastAPI(title="Agentra API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows.router)
app.include_router(runs.router)
app.include_router(deploy.router)
app.include_router(schedule.router)
app.include_router(webhook.router)


