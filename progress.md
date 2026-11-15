# Progress

## Project Status

**Current phase:** Phase 2 — Integrations & Deploy (Phase 1 complete ✅)

| Milestone | Status |
|---|---|
| Vision & strategy defined | Done |
| architecture.md complete | Done |
| progress.md complete | Done |
| security.md complete | Done |
| NODE_SCHEMA_v1.md complete | Done |
| Repo initialized | Done |
| Phase 1 build started | Done |
| **Phase 1 complete** | **Done — 2026-11-13** |
| **Phase 2 in progress** | **Started 2026-11-14** |

## 12-Month Roadmap

| Phase | Months | Goal | Key Deliverable |
|---|---|---|---|
| 1 | 1–2 | Working canvas + execution | 3 node types run end-to-end |
| 2 | 3–4 | 10 integrations + dynamic canvas | Users can build agents without code |
| 3 | 5–6 | Auth + saved workflows | Multi-user accounts live |
| 4 | 7–8 | Marketplace MVP | Users publish & fork agents |
| 5 | 9–10 | Observability (SwarmTrace) | Full run tracing dashboard |
| 6 | 11–12 | Teams + monetization | Paid plans, creator revenue |

## Phase 1 — Core Canvas & Execution ✅

**Months 1–2 | Goal: a user can draw a 3-node workflow and run it end-to-end.**

**Completed: 2026-11-13**

**Tasks:**
- [x] Initialize monorepo (frontend/, backend/, workers/)
- [x] Set up Vercel + Render + Supabase + Upstash accounts
- [x] React Flow canvas with Trigger, LLM Call, Output nodes
- [x] Node config panel (schema-driven, Zustand state)
- [x] FastAPI backend: /workflows and /runs endpoints
- [x] Workflow JSON to LangGraph compiler (core IP)
- [x] Groq integration (openai/gpt-oss-120b)
- [x] SSE streaming from worker to frontend
- [x] Live execution view — nodes light up as they run
- [x] Save/load workflow from Supabase

**Definition of done:** ✅ A user visits the site, draws Trigger → LLM Call → Output, clicks Run, sees streaming output in real time, workflow saved to Supabase.

## Phase 2 — Integrations & Deploy (In Progress)

**Months 3–4 | Goal: users can build agents visually without touching code.**

> ⚠️ Roadmap note (2026-11-14): Dynamic canvas pulled forward. Without it, students can't use Agentra as a no-code platform.

**Tasks:**
- [x] Tool node: Web Search (Tavily)
- [x] Input prompt UI — text field in header, Enter key triggers run
- [x] Tool node: Jina Reader (URL scrape, no API key)
- [x] Dynamic canvas — node sidebar, click-to-add, editable edges, delete nodes/edges
- [x] Tool node: HTTP Request (generic REST, SSRF-protected)
- [x] Condition node (if/else branching, true/false handles, topological BFS walk)
- [x] Memory node (Qdrant read/write) ✅ 2026-11-14
- [x] Deploy as REST API endpoint (per workflow) ✅ 2026-11-14
- [x] Embeddable chat widget (script tag) ✅ 2026-11-14
- [x] Webhook trigger (inbound POST) ✅ 2026-11-14
- [x] Tool node: Send Email (Resend) ✅ 2026-11-15
- [ ] Scheduled cron trigger ← **next**
- [ ] Tool node: Telegram Bot
- [ ] Tool node: Google Sheets read/write

## Phase 3 — Marketplace & Accounts

**Months 5–6 | Goal: users have accounts, workflows are saved, public agents can be forked.**

**Tasks:**
- [ ] Supabase Auth — email/password + Google OAuth
- [ ] User dashboard — my workflows, my runs, usage stats
- [ ] Workflow versioning (git-like, stored in Supabase)
- [ ] Marketplace browse page — categories, search, ratings
- [ ] Publish workflow to Marketplace
- [ ] Fork agent in one click
- [ ] Template gallery (10 curated starter agents)
- [ ] Agent ratings + run count display
- [ ] Creator profile page
- [ ] Plan tier enforcement (Free: 3 workflows, 500 runs/month)

## Phase 4 — Observability & Teams

**Months 7–8 | Goal: every run is fully inspectable; teams share workspaces.**

**Tasks:**
- [ ] Run trace view — per-node timeline, token usage, latency
- [ ] Error inspector — traceback + input state at failure
- [ ] Replay mode — rerun from any failed node
- [ ] Token usage + cost dashboard (chart per workflow per day)
- [ ] Team workspaces — invite members, shared workflow library
- [ ] Team run dashboard — all org runs in one view
- [ ] Long-term log storage (Cloudflare R2)
- [ ] Email alerts on run failure
- [ ] SwarmTrace integration (pull from existing project where applicable)

## Phase 5 — Scale & Monetization

**Months 9–12 | Goal: paying customers, creator revenue, mobile monitor app.**

**Tasks:**
- [ ] Stripe integration — Builder ($9/mo) and Team ($29/mo) plans
- [ ] Creator premium agents — listing, purchase, 80/20 payout
- [ ] Usage metering — per-run cost, monthly invoice
- [ ] Mobile app (React Native) — monitor running agents, approve Human-in-the-loop from phone
- [ ] Enterprise self-host package — Docker Compose, env config docs
- [ ] SSO (SAML/OIDC) for Enterprise
- [ ] Custom domain deploy (white-label chat widget)
- [ ] MCP server support (plug any MCP server as a node)
- [ ] API key management (user-supplied LLM keys to bypass rate limits)
- [ ] Multi-language UI (Hindi, Tamil — targeting Indian market)

## Open Decisions

| Decision | Options | Deadline |
|---|---|---|
| Platform name | ~~AgentOS / FlowForge / NovaBuild / Agentra / custom~~ | ✅ Locked: **Agentra** |
| Repo structure | ~~Monorepo (Turborepo) vs separate repos~~ | ✅ Locked: **Turborepo monorepo** |
| Primary LLM for free users | Groq only vs round-robin Groq+Gemini | Phase 2 |
| Workflow JSON schema version | Lock v1 now vs iterate as we build | Phase 2 |
| Marketplace moderation | Manual review vs automated sandbox | Phase 3 |
| Mobile app approach | React Native vs Flutter vs PWA | Phase 5 |
| Payment processor | Stripe vs Razorpay (India-first) | Phase 5 |

## Gotchas

Bugs and environment quirks found during the build. Format: `G-001`, `G-002`, ...
Check this list before writing any new code so known bugs don't come back.

| ID | Problem | Cause | Fix |
|---|---|---|---|
| G-001 | Python 3.14 compatibility issues | System default is 3.14 | Use `uv python install 3.12` — pin per project with `uv init --python 3.12` |
| G-002 | Qdrant free tier has no Asia region | Free tier limited to Americas + Europe | Using eu-west-1 (Ireland) for Phase 1; migrate on paid plan |
| G-003 | Supabase project landed in Tokyo instead of Mumbai | Region auto-selected | Acceptable for Phase 1; migrate to ap-south-1 before Phase 3 auth launch |
| G-004 | `@import "tailwindcss"` kept landing in App.tsx | VS Code tab confusion during paste | Use PowerShell `Set-Content` to write files, never paste across tabs |
| G-005 | `NodeType` / `NodeMouseHandler` import errors | These are TS types, not runtime values | Use `import type { ... }` for type-only imports |
| G-006 | `llama-3.3-70b-versatile` decommissioned | Groq retired it Aug 2026 | Use `openai/gpt-oss-120b` |
| G-007 | `WorkflowState(dict)` causes LangGraph to return `None` | LangGraph needs `TypedDict` for state merging | Use `TypedDict` |
| G-008 | Spaces around `=` in `.env` break dotenv | `KEY = value` loads as `"KEY "` | Always write `KEY=value` with no spaces |
| G-009 | React Flow ignores style updates on re-renders | RF manages internal node state; derived nodes are discarded | Use `useNodesState` + `useEffect` calling `setNodes` to force style re-renders |
| G-010 | `api.ts streamRun` passed raw SSE text as tokens | Old version had no JSON parsing or `onNodeState` callback | Parse each `data:` line as JSON; dispatch `token`/`node_start`/`node_done`/`done` |
| G-011 | Supabase `permission denied for table workflows` | service_role not granted table access despite RLS policy | Run `grant all on public.workflows to service_role;` in SQL Editor |
| G-012 | `def event_stream()` indented inside `except` block | Stray `d` character left by PowerShell `-replace` | Always use `Set-Content` with heredoc for full file rewrites, never `-replace` for indented code |
| G-013 | `Set-Content` path doubled when already in `frontend/` folder | Command used `frontend\\src\\App.tsx` while CWD was already `frontend/` | When inside a subfolder, use relative path from there: `src\\App.tsx` not `frontend\\src\\App.tsx` |
| G-014 | `WorkflowEdge` missing `sourceHandle` field | Pydantic model didn't include optional field | Add `sourceHandle: Optional[str] = None` to `WorkflowEdge` in `models.py` |
| G-015 | Send Email node silently skipped in streaming path | `runs.py` event_stream had no `elif ntype == "email"` branch | Add email handler to runs.py alongside tool/memory/llm_call handlers |
| G-016 | Email `to` field arrived empty in send_email | `make_tool_node` reads from `params` dict (nested), email config is flat | Use `config.get("to")` not `params.get("to")` for email node |
| G-017 | LLM output not in state when email body tries to format `{output}` | `state["output"]` assigned after loop, not accumulated during streaming | Move accumulation inside the `if chunk.content:` block: `state["output"] += chunk.content` |
| G-018 | PowerShell `-replace` fails silently on multi-line patterns | `\r\n` line endings don't match regex patterns with literal newlines | For multi-line edits always use VS Code manual edit or full `Set-Content` rewrite |