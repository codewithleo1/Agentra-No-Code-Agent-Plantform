# Progress

## Project Status

**Current phase:** Phase 3 — Marketplace & Accounts (Phase 2 complete ✅)

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
| **Phase 2 complete** | **Done — 2026-11-16** |
| **Phase 3 in progress** | **Started 2026-11-16** |

---

## 🗺️ Full Platform Roadmap (12 Months)

### What we're building toward
An open, visual, model-agnostic platform where anyone can build, deploy, share, and monetize AI agents without code — covering every layer from canvas to marketplace to teams to mobile.

---

## Phase 1 — Core Canvas & Execution ✅
**Months 1–2 | Goal: a user can draw a 3-node workflow and run it end-to-end.**
**Completed: 2026-11-13**

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

---

## Phase 2 — Integrations & Deploy ✅
**Months 3–4 | Goal: users can build agents visually without touching code.**
**Completed: 2026-11-16**

- [x] Tool node: Web Search (Tavily)
- [x] Input prompt UI — text field in header, Enter key triggers run
- [x] Tool node: Jina Reader (URL scrape, no API key)
- [x] Dynamic canvas — node sidebar, click-to-add, editable edges, delete nodes/edges
- [x] Tool node: HTTP Request (generic REST, SSRF-protected)
- [x] Condition node (if/else branching, true/false handles, topological BFS walk)
- [x] Memory node (Qdrant read/write)
- [x] Deploy as REST API endpoint (per workflow)
- [x] Embeddable chat widget (script tag)
- [x] Webhook trigger (inbound POST)
- [x] Tool node: Send Email (Resend)
- [x] Scheduled cron trigger (QStash)
- [x] Tool node: Telegram Bot
- [x] Tool node: Google Sheets read/write

---

## Phase 3 — Marketplace & Accounts 🔄
**Months 5–6 | Goal: users have accounts, workflows are saved, public agents can be forked.**

### Canvas Polish
- [x] Workflow auto-save (PUT vs POST on run) — 2026-11-19
- [x] Node debug panel (click node after run → see output) — 2026-11-19
- [x] Mini-map (React Flow MiniMap component) — 2026-11-19
- [x] Node duplication (Ctrl+D) — 2026-11-19
- [ ] Undo/redo (Ctrl+Z / Ctrl+Y)
- [ ] Node search / command palette (Ctrl+K — search node types, add to canvas)
- [ ] Canvas zoom to fit button
- [ ] Node comments (add a sticky note to any node)

### Accounts & Auth
- [x] Supabase Auth — email/password + Google OAuth
- [x] User dashboard — my workflows, my runs, usage stats
- [ ] Workflow versioning (save history, restore previous version)
- [ ] Usage stats page (runs this month, tokens used, workflows count)

### Marketplace
- [x] Marketplace browse page
- [x] Publish workflow to Marketplace
- [x] Fork agent in one click
- [x] 6 starter templates (Web Research, URL Summarizer, Email Drafter, Classifier, Telegram Bot, Sheet Reporter)
- [ ] Categories (Sales · Marketing · HR · Finance · Personal · Education)
- [ ] Search + filter by category/tag
- [ ] Agent ratings (1–5 stars, stored in Supabase)
- [ ] Run count display ("used 1,234 times")
- [ ] Creator profile page (avatar, bio, published agents)
- [ ] Featured agents section (manually curated)
- [ ] Plan tier enforcement (Free: 3 workflows, 500 runs/month)

---

## Phase 4 — More Integrations 🔜
**Months 5–6 (parallel with Phase 3) | Goal: connect to the tools people actually use daily.**

### Trigger Nodes (What starts an agent)
- [ ] Schedule trigger UI (CRON builder, timezone picker) — backend done via QStash
- [ ] Webhook trigger UI (show assigned URL, copy button, test button)
- [ ] Email trigger (inbound email → agent fires, via Resend inbound or Postmark)
- [ ] Form trigger (Agentra-hosted form → agent fires on submit)
- [ ] WhatsApp trigger (Twilio / Meta Cloud API)

### Input / Read Nodes
- [ ] Gmail read (OAuth, read latest N emails, filter by sender/subject)
- [ ] Google Drive read (read a doc or file by ID)
- [ ] Notion read (read a page or database by ID)
- [ ] Airtable read (read rows from a base/table)
- [ ] RSS/Atom feed reader (fetch and parse a feed URL)
- [ ] YouTube transcript (fetch captions from a video URL)
- [ ] PDF reader (upload a PDF, extract text)
- [ ] CSV / Excel reader (upload a file, parse into rows)
- [ ] Slack read (read messages from a channel)
- [ ] HubSpot read (read contacts/deals)

### Output / Action Nodes
- [ ] Slack send (post to channel or DM — most requested)
- [ ] WhatsApp send (Twilio / Meta Cloud API — critical for India)
- [ ] Gmail send (OAuth, send from user's own Gmail)
- [ ] Google Docs write (create or append to a doc)
- [ ] Google Calendar (create an event)
- [ ] Notion write (create or update a page)
- [ ] Airtable write (append a row)
- [ ] Twitter/X post
- [ ] LinkedIn post
- [ ] WordPress post (REST API)
- [ ] HubSpot write (create/update contact or deal)
- [ ] SMS send (Twilio)
- [ ] PDF generator (HTML → PDF via WeasyPrint or Puppeteer)
- [ ] Stripe webhook handler (payment event → agent fires)

### Logic / Data Nodes
- [ ] Transform node (rename keys, extract fields, format strings — no LLM needed)
- [ ] Loop node (iterate over a list, run sub-nodes per item)
- [ ] Merge node (wait for parallel branches, combine outputs)
- [ ] Code node (sandboxed Python snippet — power users)
- [ ] Delay node (wait N seconds/minutes before continuing)
- [ ] Sub-agent node (embed another workflow as one node)
- [ ] Human-in-the-loop node (pause, send approval request, resume on response)

---

## Phase 5 — Observability & Run History 🔜
**Months 7–8 | Goal: every run is fully inspectable; users trust their agents in production.**

### Run History
- [ ] Run list page (all runs for a workflow — status, time, duration)
- [ ] Run detail page (per-node timeline: input → output → latency)
- [ ] Error inspector (which node failed, what the state was, full traceback)
- [ ] Replay a run (re-execute with same input, one click)
- [ ] Download run log as JSON

### Observability Dashboard
- [ ] Token usage chart (per workflow, per day)
- [ ] Cost estimate per run (tokens × model price)
- [ ] Latency breakdown per node (bar chart)
- [ ] Error rate graph (% of runs that failed this week)
- [ ] Most-used agents (run count across Marketplace)

### Alerts
- [ ] Email alert when agent fails 3× in a row
- [ ] Slack alert on run failure (webhook to user's Slack)
- [ ] Daily digest email (runs today, errors today, tokens used)

### Storage
- [ ] Log storage to Cloudflare R2 (long-term, compressed)
- [ ] Run search (search past runs by input text)

---

## Phase 6 — Teams & Collaboration 🔜
**Months 9–10 | Goal: teams share workspaces and agents; Agentra becomes a team tool.**

- [ ] Team workspaces (create org, invite members by email)
- [ ] Role-based access (Admin · Editor · Viewer per workspace)
- [ ] Shared credential vault (one Slack token for the whole team, encrypted)
- [ ] Shared workflow library (team-private agents not on public Marketplace)
- [ ] Activity feed (who changed what, when)
- [ ] Real-time canvas co-editing (multiple cursors, Yjs/Liveblocks)
- [ ] Agent approval flow (Editor builds → Admin approves before deploy)
- [ ] Team run dashboard (all org runs in one view)
- [ ] Comments on canvas nodes (async collaboration)
- [ ] Version history with author labels ("Suraj changed LLM prompt at 2pm")

---

## Phase 7 — Monetization & Scale 🔜
**Months 11–12 | Goal: paying customers, creator revenue, enterprise.**

### Plans & Billing
- [ ] Free plan (3 workflows, 500 runs/month, community support)
- [ ] Builder plan ₹799/mo (unlimited workflows, 10K runs, priority support)
- [ ] Team plan ₹2,499/mo (5 seats, 50K runs, shared vault, audit logs)
- [ ] Enterprise (custom pricing, SSO, self-host, SLA)
- [ ] Payment: Razorpay (India-first) + Stripe (international)
- [ ] Usage metering (overage at ₹0.10/run after plan limit)
- [ ] Monthly invoice email

### Creator Economy
- [ ] Premium agents on Marketplace (one-time purchase ₹99–₹999)
- [ ] Creator revenue share (80% to creator, 20% to Agentra)
- [ ] Creator dashboard (earnings, run stats, reviews)
- [ ] Withdrawal to bank account (Razorpay payouts)

### Enterprise
- [ ] SSO (SAML 2.0 / OIDC — Google Workspace, Okta, Azure AD)
- [ ] Audit logs (every action, exported as CSV)
- [ ] Self-host Docker Compose package
- [ ] Custom domain for chat widget (agent.yourcompany.com)
- [ ] Data residency options (India region Supabase)
- [ ] Private model support (bring your own OpenAI / Azure key)
- [ ] MCP server support (plug any MCP server as a node)
- [ ] White-label (remove Agentra branding entirely)

### Mobile
- [ ] React Native app (iOS + Android)
  - View running agents
  - Get push notifications on run completion/failure
  - Approve Human-in-the-loop requests from phone
  - Browse Marketplace
  - Basic run trigger

---

## Open Decisions

| Decision | Options | Deadline |
|---|---|---|
| Platform name | ~~AgentOS / FlowForge / NovaBuild / Agentra / custom~~ | ✅ Locked: **Agentra** |
| Repo structure | ~~Monorepo (Turborepo) vs separate repos~~ | ✅ Locked: **Turborepo monorepo** |
| Primary LLM for free users | Groq only vs round-robin Groq+Gemini | Phase 3 |
| Workflow JSON schema version | Lock v1 now vs iterate as we build | Phase 3 |
| Marketplace moderation | Manual review vs automated sandbox | Phase 4 |
| Mobile app approach | React Native vs Flutter vs PWA | Phase 7 |
| Payment processor | Razorpay (India-first) vs Stripe vs both | Phase 7 |
| WhatsApp API | Twilio vs Meta Cloud API direct | Phase 4 |

---

## Gotchas

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
| G-019 | Telegram 400 "chat not found" | Bot can only message users who have started a conversation with it | User must open the bot on Telegram and click Start before first message |
| G-020 | Google Sheets 403 PermissionError | Service account not shared on the sheet | Share the sheet with the service account email as Editor |
| G-021 | `_workflows.pop(workflow_id)` broke streaming after auto-save | PUT removed workflow from cache; runs.py reads from cache only | Re-assign `_workflows[workflow_id] = updated_wf` after PUT instead of popping |
| G-022 | `msg.content` undefined in token handler | Backend sends `{"type":"token","value":"..."}` but frontend read `msg.content` | Read `msg.value ?? msg.content ?? ""` to handle both field names |
| G-023 | `model ""` empty string crashes Groq | `config.get("model", "default")` returns `""` when key exists but is empty | Use `config.get("model", "") or "openai/gpt-oss-120b"` — `or` handles empty string |