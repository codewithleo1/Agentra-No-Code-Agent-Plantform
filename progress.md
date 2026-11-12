# Progress

## Project Status

**Current phase:** Pre-build — architecture finalized, no code written yet.

| Milestone | Status |
|---|---|
| Vision & strategy defined | Done |
| architecture.md complete | Done |
| progress.md complete | Done |
| security.md complete | Done |
| NODE_SCHEMA_v1.md complete | Done |
| Repo initialized | Pending |
| Phase 1 build started | Pending |

## 12-Month Roadmap

| Phase | Months | Goal | Key Deliverable |
|---|---|---|---|
| 1 | 1–2 | Working canvas + execution | 3 node types run end-to-end |
| 2 | 3–4 | 10 integrations + deploy | Agents callable as REST API |
| 3 | 5–6 | Auth + saved workflows | Multi-user accounts live |
| 4 | 7–8 | Marketplace MVP | Users publish & fork agents |
| 5 | 9–10 | Observability (SwarmTrace) | Full run tracing dashboard |
| 6 | 11–12 | Teams + monetization | Paid plans, creator revenue |

## Phase 1 — Core Canvas & Execution

**Months 1–2 | Goal: a user can draw a 3-node workflow and run it end-to-end.**

**Tasks:**
- [x] Initialize monorepo (frontend/, backend/, workers/)
- [ ] Set up Vercel + Render + Supabase + Upstash accounts
- [ ] React Flow canvas with Trigger, LLM Call, Output nodes
- [ ] Node config panel (schema-driven, Zustand state)
- [ ] FastAPI backend: /workflows and /runs endpoints
- [ ] Workflow JSON to LangGraph compiler (core IP)
- [ ] Groq integration (LLaMA 3.3 70B)
- [ ] SSE streaming from worker to frontend
- [ ] Live execution view — nodes light up as they run
- [ ] Save/load workflow from Supabase

**Definition of done:** A user visits the site, draws Trigger → LLM Call → Output, clicks Run, sees streaming output in real time, can save and reload the workflow.

**Tech decisions locked for Phase 1:**
- Language: Python (backend) + TypeScript (frontend)
- LLM: Groq (LLaMA 3.3 70B) as default
- DB: Supabase PostgreSQL
- Canvas: React Flow v12

## Phase 2 — Integrations & Deploy

**Months 3–4 | Goal: agents can call real tools and be deployed as live products.**

**Tasks:**
- [ ] Tool node: Web Search (Tavily)
- [ ] Tool node: HTTP Request (generic REST)
- [ ] Tool node: Send Email (Resend)
- [ ] Tool node: Telegram Bot
- [ ] Tool node: Google Sheets read/write
- [ ] Tool node: Jina Reader (URL scrape)
- [ ] Condition node (if/else branching)
- [ ] Memory node (Qdrant read/write)
- [ ] Deploy as REST API endpoint (per workflow)
- [ ] Embeddable chat widget (script tag)
- [ ] Webhook trigger (inbound POST)
- [ ] Scheduled cron trigger

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
| Primary LLM for free users | Groq only vs round-robin Groq+Gemini | Phase 1 |
| Workflow JSON schema version | Lock v1 now vs iterate as we build | Phase 1 |
| Marketplace moderation | Manual review vs automated sandbox | Phase 3 |
| Mobile app approach | React Native vs Flutter vs PWA | Phase 5 |
| Payment processor | Stripe vs Razorpay (India-first) | Phase 5 |


## Gotchas

Bugs and environment quirks found during the build. Format: `G-001`, `G-002`, ...
Check this list before writing any new code so known bugs don't come back.

| ID | Problem | Cause | Fix |
|---|---|---|---|
| G-001 | Python 3.14 compatibility issues | System default is 3.14 | Use `uv python install 3.12` — pin per project with `uv init --python 3.12` |
