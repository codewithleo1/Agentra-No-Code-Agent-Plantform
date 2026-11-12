# Security

## Threat Model

The platform faces four distinct threat surfaces:

| Threat Surface | Key Risks |
|---|---|
| User accounts | Account takeover, credential stuffing, unauthorized workflow access |
| Agent execution | Prompt injection, tool abuse, infinite loops, cost escalation |
| Integration credentials | Stolen API keys, OAuth token leakage |
| Marketplace | Malicious agents, data exfiltration, supply-chain attacks |

**Highest risk:** Agent execution — a user's workflow can call external APIs, write to databases, and send messages. A compromised or malicious workflow must not be able to affect other users or the platform itself.

## Authentication & Authorization

**Auth provider:** Supabase Auth (email/password + Google OAuth). JWTs issued with 1-hour expiry + refresh tokens.

**Authorization model:**
- Every resource (workflow, run, integration credential) has an `owner_id`
- API Gateway validates JWT on every request, injects `user_id` and `plan_tier` into request context
- Row-Level Security (RLS) enforced at the Supabase DB layer — a user can only SELECT/UPDATE/DELETE their own rows, even if the API is bypassed directly
- Team workspaces: a `workspace_members` table with roles (`owner`, `editor`, `viewer`) — RLS policies check membership before granting access

**Integration credentials storage:**
- User API keys (Telegram tokens, Gmail OAuth, etc.) never stored in plaintext
- Encrypted at rest using AES-256 before writing to Supabase
- Encryption key stored in environment variable (not in DB)
- Keys only decrypted in-memory at worker execution time, never returned to frontend

**Session management:**
- Refresh token rotation — each use issues a new refresh token
- Logout invalidates refresh token immediately (Supabase Auth revocation)
- No session state on the backend — fully stateless JWT validation

## API Security

**Rate limiting:** Redis sliding window counter per `user_id`. Limits by plan tier:

| Plan | Runs/month | Runs/hour | Max workflow nodes |
|---|---|---|---|
| Free | 500 | 20 | 10 |
| Builder | 10,000 | 100 | 50 |
| Team | 50,000 | 500 | 100 |

**Input validation:** All API inputs validated with Pydantic models — no raw dict access. Workflow JSON schema validated against a JSON Schema definition before compilation.

**CORS:** Strict allowlist — only the platform's own frontend domain. Webhook endpoints have no CORS restriction but require HMAC signature verification.

**HTTPS everywhere:** Vercel and Render enforce HTTPS. All internal service communication over TLS. No HTTP endpoints.

**Webhook security:** Every webhook URL is unique per workflow. Incoming webhooks verified with an HMAC-SHA256 signature (shared secret stored encrypted per workflow).

## Agent Execution Sandbox

The most critical security boundary — agent code runs in an isolated environment.

**Isolation:** Each workflow run executes in a separate Docker container (Render worker). Containers have no network access to other users' data, no filesystem access outside `/tmp`, and are destroyed after the run completes.

**Prompt injection defense:**
- System prompt is always prepended before user-controlled content — cannot be overridden by node config
- LLM output is never `eval()`-ed or used as Python code
- Tool inputs are schema-validated before execution — a tool expecting a URL rejects arbitrary shell commands

**Resource limits per run:**

| Resource | Limit |
|---|---|
| Max execution time | 5 minutes (Free), 15 minutes (Builder+) |
| Max LLM calls per run | 50 |
| Max tool calls per run | 100 |
| Max output size | 1 MB |
| Max concurrent runs per user | 3 (Free), 10 (Builder+) |

**Loop detection:** The workflow engine tracks node visit counts. Any node visited more than 10 times in a single run triggers a circuit breaker — the run is halted with a `loop_detected` error.

**Cost protection:** Each run tracks token usage in real time. If a run exceeds the user's monthly token budget, it is halted gracefully. Users can set their own per-run cost cap in settings.

## Data Security

**Data at rest:**
- Supabase PostgreSQL — encrypted at rest by default (AES-256)
- Integration credentials — additional application-layer AES-256 encryption before DB write
- Run logs — encrypted in Cloudflare R2
- Qdrant vector data — encrypted at rest (Qdrant Cloud default)

**Data in transit:**
- All traffic over TLS 1.2+
- SSE streams encrypted (HTTPS)
- Internal Redis communication over TLS (Upstash enforces this)

**Data isolation:**
- Every user's workflows, runs, and credentials are scoped by `user_id` / `workspace_id`
- Supabase Row-Level Security policies enforce isolation at DB level
- Vector memory is namespaced by `user_id` in Qdrant — no cross-user similarity search possible

**Data retention:**
- Run logs: 30 days (Free), 90 days (Builder), 1 year (Team/Enterprise)
- Deleted workflows: soft-deleted for 7 days, then hard-deleted
- User account deletion: all data permanently purged within 30 days (GDPR Article 17)

## Integration Security

**OAuth flows:** Third-party OAuth (Gmail, Google Sheets, Slack) uses the authorization code flow. The platform never sees the user's password. Access tokens stored encrypted; refresh tokens rotated on each use.

**User-supplied API keys:** When a user provides their own Groq/Tavily/Telegram key, it is:
1. Encrypted with AES-256 before DB write
2. Stored tagged with the integration type and workspace
3. Only decrypted in-memory during the worker run
4. Never logged, never returned to the frontend after initial save

**Scope minimization:** OAuth scopes are requested at the minimum required level. Gmail integration requests `gmail.send` only — not full mailbox access.

**Tool permission declaration:** Every workflow must declare which tools it uses. The execution engine refuses to call any tool not declared in the workflow manifest.

**HTTP Request node restrictions:**
- Cannot call internal platform API endpoints (blocked by SSRF protection)
- Cannot call `localhost`, `127.x.x.x`, or RFC 1918 private IP ranges
- 30-second timeout enforced per HTTP call

## Marketplace Security

Public agents are the highest-risk surface — they execute code and call tools on behalf of users who didn't write them.

**Review process before listing:**
1. Automated static analysis — scan workflow JSON for suspicious patterns
2. Sandboxed test run — agent runs against a dummy input with network egress monitoring
3. Permission manifest review — declared tools verified against actual tool calls in the test run
4. Manual spot-check for agents with 100+ runs or flagged by users

**At fork/run time:**
- User shown a permission summary ("This agent will: search the web, send an email") before first run
- Agent runs only with the forking user's own credentials — it cannot access the original creator's API keys
- All Marketplace agent runs are logged with higher verbosity for audit

**Abuse reporting:** Any user can flag a Marketplace agent. Three flags trigger automatic suspension pending review.

## Infrastructure Security

**Secrets management:**
- No secrets in code or Git — all via environment variables
- GitHub Actions secrets for CI/CD — never printed in logs
- Render + Vercel environment variables for runtime secrets
- Rotate all secrets on a 90-day schedule

**Container security:**
- Worker Docker images built from minimal base (`python:3.11-slim`)
- No SSH, no root processes inside containers
- Read-only filesystem except `/tmp`
- Images scanned with `docker scout` before deploy

**Dependency security:**
- `pip-audit` and `npm audit` run in CI on every PR
- Dependabot enabled on GitHub for automated security PRs
- Pin all dependencies to exact versions in `requirements.txt` and `package.json`

**Monitoring:**
- Render health checks on all services — alerts on downtime
- Supabase anomaly detection on DB (unusual query volumes)
- Failed login attempt tracking — account lockout after 5 failed attempts in 10 minutes

## Compliance & Privacy

**GDPR (EU):**
- Privacy policy published before launch
- Cookie consent banner (only functional cookies by default)
- Right to access: users can export all their data via dashboard
- Right to erasure: account deletion purges all data within 30 days
- Data Processing Agreements with Supabase, Render, Vercel, Upstash

**India (DPDP Act 2023):**
- Data localization: user data stored in Supabase region `ap-south-1` (Mumbai) where possible
- Consent collected at registration
- Grievance officer contact published

**What we do NOT store:**
- LLM prompt content is not stored permanently — only token counts are logged
- Integration credentials are never readable after initial save (write-once-encrypt)
- We do not sell user data to third parties

**Third-party data processors:**

| Processor | Data shared | Purpose |
|---|---|---|
| Supabase | User accounts, workflows, run metadata | Database |
| Render | None (compute only) | Backend hosting |
| Groq | LLM prompt content (transient) | Inference |
| Upstash | Run job IDs (no PII) | Queue |
| Qdrant | Vector embeddings (no raw PII) | Memory |

## Security Checklist

Track before each phase launch.

**Phase 1 (before first public user):**
- [ ] Supabase RLS policies on all tables
- [ ] JWT validation on all API endpoints
- [ ] HTTPS enforced on Vercel + Render
- [ ] No secrets in Git (`.env.example` only)
- [ ] Rate limiting active on /runs endpoint
- [ ] Worker container runs as non-root
- [ ] `pip-audit` passing in CI

**Phase 2 (before tool integrations go live):**
- [ ] Integration credentials encrypted at rest
- [ ] SSRF protection on HTTP Request node
- [ ] OAuth scopes minimized per integration
- [ ] Webhook HMAC verification implemented
- [ ] Run resource limits (timeout, loop detection) enforced

**Phase 3 (before Marketplace launch):**
- [ ] Sandboxed Marketplace agent test run pipeline
- [ ] Permission manifest shown to user before fork
- [ ] Abuse reporting system live
- [ ] Privacy policy published
- [ ] DPDP Act compliance reviewed by legal

**Ongoing:**
- [ ] 90-day secret rotation schedule
- [ ] Monthly `npm audit` + `pip-audit` review
- [ ] Dependabot PRs reviewed weekly
- [ ] Supabase anomaly alerts monitored
