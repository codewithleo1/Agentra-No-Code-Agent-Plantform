# Agentra

Open, visual, model-agnostic platform to build, deploy, share, and monetize AI agents — without writing code.

## Stack

Frontend: React | React Flow | Tailwind | Vercel  
Backend: FastAPI | Python 3.12 | Render  
Workers: LangGraph | Python 3.12 | Render  
DB/Auth: Supabase (PostgreSQL + Auth + RLS)  
Queue: Upstash Redis  
Vector memory: Qdrant Cloud  

## Monorepo Structure

Agentra/
├── frontend/ # React canvas (Vercel)
├── backend/ # FastAPI gateway (Render)
├── workers/ # LangGraph executor (Render)
├── packages/
│ └── shared/ # Shared TypeScript types
├── turbo.json
└── package.json

## Getting Started

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your keys
3. See each subfolder's README for setup instructions

## Roadmap

See `progress.md` for the current phase and task checklist.