# Architecture

## Platform Overview

An open, visual, agent-native workflow platform where anyone can build, deploy, share, and monetize AI agents without writing code. The platform sits between n8n (integration-first) and Copilot Studio (Microsoft-locked) — it is model-agnostic, free-first, and built for builders, students, and SMBs.

**Three core value propositions:**
- Visual multi-agent orchestration powered by LangGraph under the hood
- One-click deploy to API endpoint, chat widget, or messaging app
- Agent Marketplace where users share, fork, and monetize agents

## Core Layers

Seven layers, each independently deployable and replaceable.

Data flows top-down: the user draws on the canvas → API Gateway validates and routes → Workflow Engine compiles the JSON graph → Multi-Agent Runtime executes → Integration Hub calls external tools → Observability logs everything → Infrastructure scales it.

## Frontend — Visual Agent Studio

**Stack:** React + React Flow + Tailwind CSS, hosted on Vercel.

**Canvas features:**
- Drag-drop node editor — each node type has a schema-driven config panel
- Multi-agent canvas — multiple agents on one board, connected by edges
- Sub-agent nesting — an agent node can contain an entire child workflow
- Live execution view — data pulses through nodes in real time via SSE
- Time-travel debugging — replay any past run step by step
- Version history — every saved workflow is git-versioned in Supabase

**Node types (MVP):** Trigger, LLM Call, Tool, Condition, Memory, Output

**Node config panel schema (JSON):**
```json
{
  "id": "uuid",
  "type": "llm_call",
  "label": "Classify Intent",
  "config": {
    "model": "groq/llama-3.3-70b",
    "prompt": "Classify the user message into one of: ...",
    "temperature": 0.3,
    "output_key": "intent"
  },
  "inputs": ["user_message"],
  "outputs": ["intent"]
}
```

**State management:** Zustand for canvas state; React Query for API calls.

**Hosting:** Vercel free tier — zero config deploy from GitHub.

## Backend — API Gateway

**Stack:** FastAPI (Python), hosted on Render free tier.

**Responsibilities:**
- JWT auth validation (tokens issued by Supabase Auth)
- Request routing to Workflow Engine or Marketplace Service
- Rate limiting per user/plan tier (Redis sliding window)
- Server-Sent Events (SSE) for streaming agent output to frontend
- Webhook ingestion — every workflow can receive a POST trigger

**Key endpoints:**

| Method | Path | Purpose |
|---|---|---|
| POST | /workflows | Save a workflow |
| GET | /workflows/{id} | Load a workflow |
| POST | /runs | Execute a workflow |
| GET | /runs/{id}/stream | SSE stream for live output |
| GET | /runs/{id}/replay | Time-travel replay |
| POST | /webhooks/{id} | External trigger |
| GET | /marketplace | Browse published agents |

**Auth flow:** Supabase issues JWT on login → frontend attaches Bearer token → FastAPI validates signature on every request → user plan tier injected into request context for rate-limit enforcement.

## Workflow Engine

The core IP of the platform. Converts the visual JSON graph into a runnable LangGraph StateGraph.

**Compiler pipeline:**
1. Receive workflow JSON from API
2. Validate node schema and edge connections
3. Build LangGraph `StateGraph` dynamically — each node type maps to a Python function
4. Inject tool bindings for integration nodes (Tavily, Gmail, HTTP, etc.)
5. Compile and return a runnable graph

**Node type to function mapping:**

| Node Type | LangGraph Implementation |
|---|---|
| LLM Call | `model.invoke(state)` with Groq/Gemini |
| Tool | `tool.run(state['input'])` via LangChain tools |
| Condition | `if/else` branch on state key |
| Memory Read | `vectorstore.similarity_search(query)` |
| Memory Write | `vectorstore.add_texts(texts)` |
| Sub-Agent | Nested `StateGraph.compile()` call |
| Output | Return final state to SSE stream |

**Human-in-the-loop:** Any node can set `"require_approval": true` — the engine pauses, emits an SSE event to the frontend, waits for the user to click Approve/Reject, then resumes.

**Retry/fallback:** Each LLM node supports `"fallback_model"` — if Groq fails, the engine automatically retries on Gemini Flash before surfacing an error.

## Multi-Agent Runtime

Multiple agents collaborate on a single task using LangGraph's Supervisor/Worker pattern.

**Patterns supported:**
- **Supervisor/Worker** — a Supervisor LLM decides which Worker agent to call next
- **Parallel agents** — multiple agents run simultaneously, results merged
- **Sequential chain** — Agent A output feeds Agent B input
- **Sub-agent nesting** — an agent node is itself a full compiled workflow

**Shared state:** Each run maintains a typed `AgentState` dict passed between all nodes. Memory nodes read/write to Qdrant (vector) or Supabase (structured) for cross-session persistence.

**Execution model:**
1. Run queued in Redis (Upstash)
2. Worker process (Docker/Render) picks up run
3. LangGraph graph executes with async streaming
4. Each node emits SSE events: `{type: 'node_start', node_id, timestamp}` and `{type: 'node_end', output}`
5. Final output written to Supabase runs table + streamed to frontend

## Integration Hub

Every external service is a Tool node users drag onto the canvas.

**Tier 1 — Built by platform (MVP launch):**

| Category | Tools |
|---|---|
| Web Search | Tavily, Brave Search |
| LLM | Groq, Gemini Flash, OpenRouter |
| Email | Gmail API, Resend |
| Messaging | Telegram Bot, Discord Webhook, Slack |
| Documents | Google Sheets, Notion, Google Drive |
| Scraping | Jina Reader, Firecrawl |
| Memory | Qdrant, ChromaDB |
| HTTP | Generic HTTP Request (covers any REST API) |
| Utility | OpenWeatherMap, WolframAlpha, ExchangeRate API |

**MCP server support:** The platform natively supports Model Context Protocol — users can connect any MCP server as a node source.

## Marketplace Service

The Marketplace turns the platform into an ecosystem, not just a tool.

- **Browse & search** by category, tag, rating, most-forked
- **One-click fork** — clones workflow into user's canvas, ready to run
- **Templates gallery** — curated starter agents for common use cases
- **Creator revenue** — premium agents ($1–$10 one-time) with 80/20 split
- **Versioning** — agents have published versions; forkers can track upstream updates

**Categories:** Research, Sales, HR, Finance, Education, DevOps, Marketing, Customer Support, Personal Productivity

## Observability Layer

Built on SwarmTrace principles — every agent run is fully inspectable.

| Event | Data Captured |
|---|---|
| Run start | workflow_id, user_id, trigger type, timestamp |
| Node start | node_id, node_type, input state, timestamp |
| LLM call | model, prompt tokens, completion tokens, latency_ms |
| Tool call | tool_name, input, output, latency_ms |
| Node end | output state, success/error |
| Run end | total tokens, total cost estimate, duration_ms |

**Dashboard features:** Per-run trace view, error inspector, replay mode, token usage chart, team view.

**Storage:** Run logs written to Supabase `runs` and `run_events` tables. Long-term retention on Cloudflare R2 (10 GB free).

## Deployment Layer

Every workflow can be deployed as a live product in one click.

| Target | How | Free? |
|---|---|---|
| REST API endpoint | Workflow gets a public POST URL with API key auth | Yes |
| Embeddable chat widget | Script tag + iframe, customizable UI | Yes |
| Telegram bot | Connect Bot Token, platform handles webhook | Yes |
| Slack bot | OAuth install, responds to slash commands | Yes |
| Discord bot | Bot token + gateway, listens to channel | Yes |
| WhatsApp | Meta Cloud API (1000 free conversations/month) | Partial |
| Scheduled cron | CRON expression, runs on Render cron job | Yes |

## Infrastructure & Hosting

| Service | Purpose | Free Limit |
|---|---|---|
| Vercel | Frontend hosting | Unlimited static |
| Render | FastAPI backend + worker processes | 750 hrs/month |
| Supabase | PostgreSQL DB + Auth + Realtime | 500 MB, 50k rows |
| Upstash Redis | Run queue + rate limiting | 10k commands/day |
| Qdrant Cloud | Vector memory for agents | 1 GB free |
| Cloudflare R2 | Long-term run log storage | 10 GB free |
| GitHub Actions | CI/CD pipeline | 2000 min/month |
| Docker Hub | Worker container registry | Free (public) |

**Scaling path:** Render Pro ($7/mo) + Supabase Pro ($25/mo) = ~$32/mo total when free tiers are exceeded.

## Data Flow — End to End

1. **User draws workflow** on React Flow canvas, configures nodes
2. **Save** — canvas serializes to JSON, POST to `/workflows` → stored in Supabase
3. **Run triggered** — user clicks Run (or webhook fires) → POST to `/runs`
4. **API validates** JWT, checks rate limit via Redis, enqueues job in Redis queue
5. **Worker picks up job** — pulls workflow JSON from Supabase, compiles LangGraph graph
6. **Graph executes** — nodes run sequentially/in-parallel; each node emits SSE events
7. **Frontend streams** — SSE listener updates the live execution view in real time
8. **Run completes** — final output displayed, full trace stored, token usage logged
9. **Replay available** — user can open any past run and replay from any node

## Scalability Considerations

**Bottleneck 1 — Concurrent runs:** Redis queue naturally handles burst. Workers are horizontally scalable.

**Bottleneck 2 — LLM rate limits:** Groq free tier has rate limits. Mitigation: round-robin across multiple provider keys, automatic fallback to Gemini Flash, user-supplied API keys for heavy users.

**Bottleneck 3 — Supabase row limits:** At 50k rows (free), migrate to Supabase Pro or self-hosted PostgreSQL on Render. `run_events` partitioned by `created_at`.

**Bottleneck 4 — SSE connections:** At scale, replace with a Redis pub/sub fan-out pattern so any API replica can serve any run's stream.

**Stateless design:** Every API and worker process is stateless — all state lives in Supabase, Redis, or Qdrant.
