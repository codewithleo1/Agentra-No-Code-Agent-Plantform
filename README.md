
# Agentra

**Agentra** is an open, visual, and model-agnostic platform for building, deploying, sharing, and monetizing AI agents — without writing a single line of code.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Flow, Tailwind CSS, Vercel |
| Backend | FastAPI, Python 3.12, Render |
| Workers / Agent Execution | LangGraph, Python 3.12, Render |
| Database & Authentication | Supabase (PostgreSQL, Auth, Row Level Security) |
| Task Queue | Upstash Redis |
| Vector Database & Memory | Qdrant Cloud |

## Monorepo Structure

```text
Agentra/
│
├── frontend/              # React-based visual canvas
├── backend/               # FastAPI gateway
├── workers/               # LangGraph-based agent executor
│
├── packages/
│   └── shared/            # Shared TypeScript types
│
├── turbo.json             # Turborepo configuration
├── package.json           # Root project configuration
└── progress.md            # Development roadmap and task checklist
```

## Getting Started

Follow these steps to set up Agentra locally:

### 1. Clone the Repository

Clone the Agentra repository to your local machine.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure the required API keys, credentials, and environment variables.

### 3. Install Dependencies

Install the required dependencies by following the instructions in the respective project directories.

### 4. Set Up Individual Services

Refer to the README files inside the following directories for detailed setup instructions:

- `frontend/` – Frontend application setup.
- `backend/` – FastAPI backend setup.
- `workers/` – LangGraph worker setup.

### 5. Run the Application

Start the frontend, backend, and worker services according to their respective setup instructions.

## Development Roadmap

The development roadmap and current implementation status are maintained in `progress.md`.

Refer to this file to:

- Identify the current development phase.
- Review completed features and pending tasks.
- Track implementation progress.
- Understand upcoming milestones.
- Determine the next development priorities.

---

**Agentra — Build, Deploy, and Monetize AI Agents. No Code Required.**
