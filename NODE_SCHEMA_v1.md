# NODE_SCHEMA_v1

## Philosophy

This schema is the **single source of truth** between every layer of the platform:
- The **canvas** serializes it when a user saves
- The **compiler** deserializes it into a LangGraph graph
- The **marketplace** stores and distributes it
- The **observability layer** references it to label traces
- The **deploy layer** reads it to generate API endpoints

**Four design principles:**
1. **Forward-compatible** — every field has an explicit version. Adding new node types or config keys never breaks old workflows. The compiler ignores unknown keys gracefully.
2. **Self-describing** — the schema carries enough metadata that a UI can render any workflow without hardcoded node knowledge. Node types are registered, not hardcoded.
3. **Portable** — a workflow JSON is a standalone artifact. It can be exported, forked, imported, run via CLI, or published to the Marketplace with no platform-specific transformation.
4. **Execution-agnostic** — the schema describes *what* to do, not *how*. The compiler decides whether to use LangGraph, a future Temporal worker, or a serverless function. The schema never changes when the runtime does.

## Schema Version Contract

Every workflow carries a `schema_version` field. The platform maintains a compiler per version and never drops support for a version while live workflows use it.

| Version | Status | Notes |
|---|---|---|
| `1.0` | **Current** | MVP — all Phase 1-2 node types |
| `1.x` | Additive | New node types, new config keys — backward compatible |
| `2.0` | Future | Breaking change — requires migration tool |

**Compatibility rules:**
- A `1.x` compiler can run any `1.0` workflow (forward-compatible reads)
- A `1.0` compiler rejects a `1.5` workflow with a clear `schema_version_unsupported` error — never silent failure
- The canvas auto-migrates a workflow to the latest `1.x` on open — the user sees a "Workflow updated to schema 1.3" banner
- A `2.0` migration is always opt-in with a migration wizard, never automatic

**Version bump triggers:**
- Minor (`1.0` → `1.1`): new node type added, new optional config key
- Patch is not used — schema changes are always at least minor
- Major (`1.x` → `2.0`): rename of a required field, change to edge semantics, state model restructure

## Top-Level Workflow Object

The root envelope every workflow is wrapped in.

```json
{
  "schema_version": "1.0",

  "workflow": {
    "id": "wf_01j9kx2m3n4p5q6r7s8t",
    "name": "Lead Qualifier Agent",
    "description": "Qualifies inbound leads from webhook and sends result to Slack.",
    "version": "3",
    "created_at": "2026-11-05T10:00:00Z",
    "updated_at": "2026-11-05T14:22:00Z",
    "author_id": "user_suraj",
    "workspace_id": "ws_codewithleo",
    "tags": ["sales", "lead-gen", "slack"],
    "is_public": false,
    "fork_of": null
  },

  "permissions": {
    "tools_used": ["web_search", "send_slack", "llm_call"],
    "external_domains": ["api.tavily.com", "slack.com"],
    "requires_credentials": ["slack_bot_token"]
  },

  "execution": { },
  "state": { },
  "nodes": [ ],
  "edges": [ ],

  "metadata": {
    "canvas_layout": { },
    "ui_theme": "default"
  }
}
```

**Field notes:**

| Field | Required | Purpose |
|---|---|---|
| `schema_version` | Yes | Compiler selects the right parser |
| `workflow.id` | Yes | Globally unique, prefixed `wf_` |
| `workflow.version` | Yes | Integer, incremented on each save |
| `permissions` | Yes | Shown to user before fork/run; enforced at execution |
| `execution` | Yes | Timeout, retry, concurrency settings |
| `state` | Yes | Declares all variables the workflow uses |
| `nodes` | Yes | Array of node objects |
| `edges` | Yes | Array of directed connections |
| `metadata` | No | Canvas layout, UI prefs — ignored by compiler |

## Node Object

Every node shares this base shape. Type-specific config lives inside `config`.

```json
{
  "id": "n_abc123",
  "type": "llm_call",
  "label": "Classify Intent",
  "description": "Classifies the lead message into a priority tier.",

  "inputs": {
    "message": "{{state.lead_message}}"
  },

  "outputs": {
    "priority": "string",
    "reasoning": "string"
  },

  "config": { },

  "on_error": {
    "strategy": "retry",
    "max_retries": 2,
    "fallback_node": "n_error_handler"
  },

  "require_approval": false,
  "timeout_seconds": 30,
  "tags": ["classification"],
  "enabled": true
}
```

**Base fields (all node types):**

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | Yes | string | Unique within workflow, prefixed `n_` |
| `type` | Yes | string | Registered node type key |
| `label` | Yes | string | Shown on canvas |
| `description` | No | string | Shown in config panel tooltip |
| `inputs` | Yes | object | Maps input names to state references or literals |
| `outputs` | Yes | object | Declares keys this node writes to state |
| `config` | Yes | object | Type-specific — see Node Types Reference |
| `on_error` | No | object | Error handling strategy for this node |
| `require_approval` | No | bool | Pauses run for human approval before executing |
| `timeout_seconds` | No | int | Defaults to execution-level timeout if absent |
| `enabled` | No | bool | `false` = node is skipped, edges still route through it |

## Node Types Reference

All `config` schemas per node type. Every type has a `type_version` so individual node types can evolve independently of the workflow schema.

---

### `trigger`

Starts the workflow. Every workflow has exactly one trigger node.

```json
"config": {
  "type_version": "1.0",
  "kind": "manual",
  "input_schema": {
    "lead_message": { "type": "string", "required": true },
    "source": { "type": "string", "required": false, "default": "unknown" }
  }
}
```

`kind` options: `manual` | `webhook` | `schedule` | `event` | `email` | `form`

---

### `llm_call`

Calls a language model with a prompt.

```json
"config": {
  "type_version": "1.0",
  "model": "groq/llama-3.3-70b",
  "fallback_model": "google/gemini-1.5-flash",
  "system_prompt": "You are a lead qualification expert.",
  "user_prompt": "Classify this lead: {{inputs.message}}. Output JSON: {priority, reasoning}",
  "temperature": 0.3,
  "max_tokens": 512,
  "output_format": "json",
  "output_schema": {
    "priority": { "type": "string", "enum": ["high", "medium", "low"] },
    "reasoning": { "type": "string" }
  },
  "stream": true
}
```

`model` follows `provider/model-name` convention — provider-agnostic by design.

---

### `tool`

Calls a registered integration tool.

```json
"config": {
  "type_version": "1.0",
  "tool_id": "tavily_search",
  "credential_ref": "tavily_api_key",
  "params": {
    "query": "{{inputs.company_name}} funding news",
    "max_results": 5
  },
  "output_key": "search_results"
}
```

---

### `condition`

Branches the graph based on a boolean expression.

```json
"config": {
  "type_version": "1.0",
  "expression": "{{state.priority}} == 'high'",
  "true_branch": "n_send_slack",
  "false_branch": "n_send_email",
  "expression_language": "jinja2"
}
```

Future: `expression_language` will support `cel` (Common Expression Language) for enterprise.

---

### `memory_read`

Retrieves relevant context from vector or structured memory.

```json
"config": {
  "type_version": "1.0",
  "store": "qdrant",
  "collection": "{{workflow.id}}_memory",
  "query": "{{inputs.message}}",
  "top_k": 5,
  "score_threshold": 0.75,
  "output_key": "memory_context",
  "scope": "user"
}
```

`scope`: `user` | `workspace` | `workflow` — controls which memory namespace is queried.

---

### `memory_write`

Writes content to vector or structured memory.

```json
"config": {
  "type_version": "1.0",
  "store": "qdrant",
  "collection": "{{workflow.id}}_memory",
  "content": "{{state.llm_output}}",
  "metadata": {
    "run_id": "{{run.id}}",
    "timestamp": "{{run.started_at}}"
  },
  "scope": "user"
}
```

---

### `http_request`

Makes an arbitrary HTTP call — the most powerful tool node.

```json
"config": {
  "type_version": "1.0",
  "method": "POST",
  "url": "https://api.example.com/leads",
  "headers": {
    "Authorization": "Bearer {{credentials.example_api_key}}",
    "Content-Type": "application/json"
  },
  "body": {
    "name": "{{state.lead_name}}",
    "priority": "{{state.priority}}"
  },
  "timeout_seconds": 30,
  "output_key": "api_response",
  "expected_status": [200, 201]
}
```

---

### `transform`

Manipulates state data without an LLM — pure computation.

```json
"config": {
  "type_version": "1.0",
  "operations": [
    { "op": "set", "key": "full_name", "value": "{{state.first}} {{state.last}}" },
    { "op": "filter", "key": "results", "condition": "item.score > 0.8" },
    { "op": "map", "key": "names", "source": "results", "extract": "item.name" },
    { "op": "join", "key": "names_str", "source": "names", "separator": ", " }
  ]
}
```

This node handles 80% of data shaping needs without an LLM call — cheaper and faster.

---

### `loop`

Iterates over a list, running a sub-workflow for each item.

```json
"config": {
  "type_version": "1.0",
  "iterate_over": "{{state.leads}}",
  "item_key": "current_lead",
  "body_nodes": ["n_classify", "n_enrich"],
  "max_iterations": 50,
  "mode": "sequential",
  "output_key": "processed_leads",
  "break_condition": "{{state.current_lead.score}} < 0"
}
```

`mode`: `sequential` | `parallel` (runs all iterations concurrently, results merged)

---

### `sub_agent`

Embeds an entire compiled workflow as a single node.

```json
"config": {
  "type_version": "1.0",
  "workflow_id": "wf_enrich_lead_v2",
  "workflow_version": "5",
  "input_map": {
    "lead_name": "{{state.name}}",
    "company": "{{state.company}}"
  },
  "output_map": {
    "enrichment": "enrich_result"
  },
  "timeout_seconds": 120
}
```

The sub-agent runs in its own isolated context. Its internal state does not pollute the parent's state.

---

### `human_in_loop`

Explicitly pauses for a human decision.

```json
"config": {
  "type_version": "1.0",
  "prompt": "Lead {{state.lead_name}} scored {{state.score}}. Approve outreach?",
  "display_data": ["state.lead_name", "state.company", "state.reasoning"],
  "options": ["approve", "reject", "escalate"],
  "output_key": "human_decision",
  "timeout_hours": 24,
  "timeout_action": "auto_reject",
  "notify_channels": ["slack", "email"]
}
```

---

### `output`

Terminates the workflow and declares the final result.

```json
"config": {
  "type_version": "1.0",
  "result": {
    "summary": "{{state.priority}} lead: {{state.lead_name}}",
    "priority": "{{state.priority}}",
    "reasoning": "{{state.reasoning}}"
  },
  "channels": [
    { "type": "slack", "credential_ref": "slack_bot_token", "channel": "#leads" },
    { "type": "webhook", "url": "{{workflow.config.callback_url}}" }
  ],
  "store_result": true
}
```

A workflow can have multiple `output` nodes — different branches terminate differently.

---

### `code` *(v1.1 — future)*

Runs sandboxed Python or JavaScript.

```json
"config": {
  "type_version": "1.0",
  "language": "python",
  "code": "result = sum(item['score'] for item in state['leads']) / len(state['leads'])",
  "output_key": "avg_score",
  "allowed_imports": ["math", "json", "datetime"]
}
```

Executes in a micro-sandbox (Pyodide/WASM) — no network, no filesystem access.

## Edge Object

Edges are directed connections between nodes.

```json
{
  "id": "e_n1_n2",
  "from": "n_classify",
  "from_port": "default",
  "to": "n_send_slack",
  "to_port": "default",
  "condition": "{{state.priority}} == 'high'",
  "label": "High priority"
}
```

**Field notes:**

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Unique within workflow, prefixed `e_` |
| `from` | Yes | Source node `id` |
| `from_port` | No | Named output port — `default` if absent |
| `to` | Yes | Target node `id` |
| `to_port` | No | Named input port — `default` if absent |
| `condition` | No | Jinja2 expression evaluated against state. Edge is only followed if `true`. Absent = always follow |
| `label` | No | Shown on canvas next to the edge |

**Named ports** enable future node types that emit multiple streams — e.g. a `classifier` node with ports `intent_a`, `intent_b`, `intent_c` routing to different downstream nodes without a chain of `condition` nodes.

## State & Variables

State is the shared memory of a workflow run — a typed dictionary passed between all nodes.

```json
"state": {
  "schema": {
    "lead_message": { "type": "string", "required": true },
    "lead_name": { "type": "string", "required": false },
    "priority": { "type": "string", "enum": ["high", "medium", "low"] },
    "reasoning": { "type": "string" },
    "search_results": { "type": "array", "items": { "type": "object" } },
    "memory_context": { "type": "string" }
  },
  "initial": {
    "priority": "medium"
  },
  "persistence": "run"
}
```

**`persistence` options:**

| Value | Lifetime | Use case |
|---|---|---|
| `run` | One execution only (default) | Stateless agents |
| `session` | Until the user closes the chat session | Conversational agents |
| `user` | Persists across all runs by this user | Personalized agents |
| `workspace` | Shared across all workspace members | Team knowledge bases |

**Variable interpolation:** Any string field in a `config` or edge `condition` can reference state with `{{state.key}}` syntax (Jinja2). Special namespaces:

| Namespace | Example | Resolves to |
|---|---|---|
| `state` | `{{state.priority}}` | Current run state |
| `inputs` | `{{inputs.message}}` | Node's declared inputs |
| `run` | `{{run.id}}`, `{{run.started_at}}` | Run metadata |
| `workflow` | `{{workflow.id}}`, `{{workflow.name}}` | Workflow metadata |
| `credentials` | `{{credentials.slack_bot_token}}` | Decrypted credential |
| `env` | `{{env.MY_VAR}}` | Workspace environment variable |

## Execution Config

```json
"execution": {
  "timeout_seconds": 300,
  "max_llm_calls": 50,
  "max_tool_calls": 100,
  "max_loop_iterations": 50,
  "max_node_visits": 10,
  "max_output_bytes": 1048576,
  "concurrency": 1,
  "retry_policy": {
    "max_retries": 2,
    "backoff": "exponential",
    "backoff_base_seconds": 2,
    "retryable_errors": ["rate_limit", "timeout", "network_error"]
  },
  "cost_limit": {
    "max_tokens": 100000,
    "action_on_exceed": "halt"
  },
  "streaming": true,
  "log_level": "full"
}
```

## Trigger Types

`kind` options on the trigger node:

- **`manual`** — user clicks Run, accepts input validated against `input_schema`
- **`webhook`** — inbound HTTP POST, platform assigns unique URL per workflow; supports HMAC-SHA256 auth
- **`schedule`** — CRON expression with timezone (e.g. `"0 9 * * 1-5"` with `"Asia/Kolkata"`)
- **`event`** — fires when another workflow emits a named event (`event_name`, optional `filter` expression)
- **`email`** *(v1.1)* — fires on inbound email to a platform-issued address
- **`form`** *(v1.1)* — fires when a user submits a rendered form

## Sub-Agent & Nesting

Sub-agents are the platform's composability primitive — any workflow can be used as a node inside another workflow.

**Nesting rules:**
- A sub-agent runs in its own isolated state context — its variables do not bleed into the parent
- The parent maps specific parent state keys into the sub-agent's `input_schema`, and maps the sub-agent's output keys back to parent state
- Sub-agents can themselves contain sub-agents (unlimited depth, but execution timeout is shared)
- A circular reference is detected at compile time and rejected
- Sub-agent `workflow_version` can be pinned (`"5"`) or floating (`"latest"`) — floating is not allowed for Marketplace-published agents

## Multi-Agent Patterns

The schema natively supports three patterns. The pattern is set by how nodes and edges are arranged — not a separate top-level field.

**Pattern 1: Supervisor / Worker** — a `supervisor` LLM node decides which worker sub-agent to call next, in a loop, until `state.done == true`. The compiler generates a LangGraph supervisor graph.

**Pattern 2: Parallel Agents** — a node with multiple outgoing edges creates a fan-out. The compiler detects fan-out and runs branches with `asyncio.gather`. A fan-in `transform` node merges results.

**Pattern 3: Event-Driven Chain** — workflows trigger each other via named events (`trigger.kind: "event"`). Each workflow is independently versioned and deployable, with no direct coupling.

## Error Handling

**Node-level `on_error`:**

```json
"on_error": {
  "strategy": "retry",
  "max_retries": 2,
  "backoff": "exponential",
  "backoff_base_seconds": 2,
  "fallback_node": "n_fallback_llm",
  "fallback_value": { "priority": "medium", "reasoning": "Classification failed" }
}
```

**`strategy` options:**

| Strategy | Behaviour |
|---|---|
| `retry` | Retry up to `max_retries` times with backoff, then fail |
| `skip` | Silently skip the node, continue graph with outputs set to `null` |
| `fallback_node` | Route to a named fallback node instead of failing |
| `fallback_value` | Inject a static value into outputs and continue |
| `halt` | Immediately end the run with error status (default if `on_error` absent) |

**Error codes registry:**

| Code | Cause |
|---|---|
| `llm_rate_limit` | LLM provider rate limit hit |
| `llm_timeout` | LLM call exceeded `timeout_seconds` |
| `llm_invalid_output` | Output did not match `output_schema` |
| `tool_error` | Integration tool returned non-2xx or threw |
| `loop_detected` | Node visit count exceeded `max_node_visits` |
| `cost_exceeded` | Token budget hit |
| `schema_validation` | Input to node failed schema validation |
| `human_timeout` | `human_in_loop` node expired without decision |
| `sub_agent_failed` | Nested workflow run ended in error state |
| `permission_denied` | Node attempted to use an undeclared tool/credential |

## Full Example — Lead Qualifier Agent

A complete, runnable workflow JSON. Trigger via webhook → enrich with web search → classify with LLM → branch on priority → notify Slack (high) or log only (low/medium).

```json
{
  "schema_version": "1.0",
  "workflow": {
    "id": "wf_lead_qualifier_v1",
    "name": "Lead Qualifier Agent",
    "description": "Webhook-triggered. Enriches a lead, classifies priority, routes to Slack or logs.",
    "version": "1",
    "created_at": "2026-11-05T10:00:00Z",
    "updated_at": "2026-11-05T10:00:00Z",
    "author_id": "user_suraj",
    "workspace_id": "ws_codewithleo",
    "tags": ["sales", "lead-gen"],
    "is_public": false,
    "fork_of": null
  },
  "permissions": {
    "tools_used": ["tavily_search", "send_slack", "llm_call"],
    "external_domains": ["api.tavily.com", "slack.com"],
    "requires_credentials": ["tavily_api_key", "slack_bot_token"]
  },
  "execution": {
    "timeout_seconds": 120,
    "max_llm_calls": 5,
    "max_tool_calls": 10,
    "streaming": true,
    "log_level": "full",
    "retry_policy": {
      "max_retries": 2,
      "backoff": "exponential",
      "backoff_base_seconds": 2,
      "retryable_errors": ["llm_rate_limit", "llm_timeout"]
    },
    "cost_limit": { "max_tokens": 10000, "action_on_exceed": "halt" }
  },
  "state": {
    "schema": {
      "lead_name": { "type": "string", "required": true },
      "company": { "type": "string", "required": true },
      "message": { "type": "string", "required": true },
      "search_results": { "type": "string" },
      "priority": { "type": "string", "enum": ["high", "medium", "low"] },
      "reasoning": { "type": "string" },
      "slack_sent": { "type": "boolean" }
    },
    "initial": { "slack_sent": false },
    "persistence": "run"
  },
  "nodes": [
    {
      "id": "n_trigger", "type": "trigger", "label": "Webhook Trigger",
      "inputs": {}, "outputs": { "lead_name": "string", "company": "string", "message": "string" },
      "config": {
        "type_version": "1.0", "kind": "webhook",
        "trigger_config": {
          "method": "POST", "auth": "hmac_sha256", "secret_ref": "webhook_secret",
          "map_body_to_state": { "lead_name": "body.name", "company": "body.company", "message": "body.message" }
        }
      }, "enabled": true
    },
    {
      "id": "n_search", "type": "tool", "label": "Enrich Lead",
      "inputs": { "query": "{{state.company}} funding news recent" },
      "outputs": { "search_results": "string" },
      "config": {
        "type_version": "1.0", "tool_id": "tavily_search", "credential_ref": "tavily_api_key",
        "params": { "query": "{{inputs.query}}", "max_results": 3 }, "output_key": "search_results"
      },
      "on_error": { "strategy": "fallback_value", "fallback_value": { "search_results": "No enrichment data available." } },
      "enabled": true
    },
    {
      "id": "n_classify", "type": "llm_call", "label": "Classify Priority",
      "inputs": { "message": "{{state.message}}", "context": "{{state.search_results}}" },
      "outputs": { "priority": "string", "reasoning": "string" },
      "config": {
        "type_version": "1.0", "model": "groq/llama-3.3-70b", "fallback_model": "google/gemini-1.5-flash",
        "system_prompt": "You are a B2B sales lead qualifier. Classify leads as high, medium, or low priority. Output only valid JSON.",
        "user_prompt": "Lead: {{inputs.message}}\n\nCompany context: {{inputs.context}}\n\nClassify this lead.",
        "temperature": 0.2, "max_tokens": 256, "output_format": "json",
        "output_schema": {
          "priority": { "type": "string", "enum": ["high", "medium", "low"] },
          "reasoning": { "type": "string" }
        }, "stream": true
      }, "enabled": true
    },
    {
      "id": "n_branch", "type": "condition", "label": "High Priority?",
      "inputs": { "priority": "{{state.priority}}" }, "outputs": {},
      "config": {
        "type_version": "1.0", "expression": "{{state.priority}} == 'high'",
        "true_branch": "n_slack", "false_branch": "n_log", "expression_language": "jinja2"
      }, "enabled": true
    },
    {
      "id": "n_slack", "type": "tool", "label": "Notify Slack",
      "inputs": { "message": "High priority lead: {{state.lead_name}} from {{state.company}}. Reason: {{state.reasoning}}" },
      "outputs": { "slack_sent": "boolean" },
      "config": {
        "type_version": "1.0", "tool_id": "send_slack", "credential_ref": "slack_bot_token",
        "params": { "channel": "#leads", "text": "{{inputs.message}}" }, "output_key": "slack_sent"
      }, "enabled": true
    },
    {
      "id": "n_log", "type": "output", "label": "Log Only",
      "inputs": {}, "outputs": {},
      "config": {
        "type_version": "1.0",
        "result": { "status": "logged", "priority": "{{state.priority}}", "lead": "{{state.lead_name}}" },
        "channels": [], "store_result": true
      }, "enabled": true
    },
    {
      "id": "n_output", "type": "output", "label": "Done",
      "inputs": {}, "outputs": {},
      "config": {
        "type_version": "1.0",
        "result": { "status": "completed", "priority": "{{state.priority}}", "lead": "{{state.lead_name}}", "slack_notified": "{{state.slack_sent}}" },
        "channels": [], "store_result": true
      }, "enabled": true
    }
  ],
  "edges": [
    { "id": "e1", "from": "n_trigger", "to": "n_search" },
    { "id": "e2", "from": "n_search", "to": "n_classify" },
    { "id": "e3", "from": "n_classify", "to": "n_branch" },
    { "id": "e4", "from": "n_branch", "to": "n_slack", "label": "High" },
    { "id": "e5", "from": "n_branch", "to": "n_log", "label": "Medium / Low" },
    { "id": "e6", "from": "n_slack", "to": "n_output" },
    { "id": "e7", "from": "n_log", "to": "n_output" }
  ],
  "metadata": {
    "canvas_layout": {
      "n_trigger": { "x": 100, "y": 200 },
      "n_search":  { "x": 300, "y": 200 },
      "n_classify": { "x": 500, "y": 200 },
      "n_branch":  { "x": 700, "y": 200 },
      "n_slack":   { "x": 900, "y": 100 },
      "n_log":     { "x": 900, "y": 300 },
      "n_output":  { "x": 1100, "y": 200 }
    }
  }
}
```

## Migration & Versioning Strategy

Schema versioning is the platform's long-term stability contract with its users.

**How migrations work:**

Each schema version has a corresponding `compiler` class and a `migrator` function:

```python
# platform/compiler/registry.py

COMPILERS = {
    "1.0": CompilerV1_0,
    "1.1": CompilerV1_1,
}

MIGRATORS = {
    ("1.0", "1.1"): migrate_1_0_to_1_1,
    ("1.1", "1.2"): migrate_1_1_to_1_2,
}

def compile_workflow(workflow_json: dict):
    version = workflow_json["schema_version"]
    target = LATEST_MINOR_VERSION  # e.g. "1.2"
    if version != target:
        workflow_json = auto_migrate(workflow_json, version, target)
    return COMPILERS[target](workflow_json).compile()
```

**Auto-migration rules (minor version bumps):**
- New optional fields → filled with defaults, no user action needed
- Renamed optional fields → old key still accepted (aliased), deprecated warning in dashboard
- Removed optional fields → silently ignored
- New node type added → old workflows unaffected; new node type simply becomes available

**Manual migration required (major version bump):**
- Required field renamed or removed
- Edge semantics changed
- State model restructured

For a major bump, the platform provides:
1. A migration wizard in the dashboard — shows what changes, previews the new JSON
2. A CLI tool: `agentforge migrate --workflow wf_id --to 2.0`
3. A 12-month deprecation window — `1.x` compiler stays live while `2.0` is current

**Locked schema fields — never change in any version:**

| Field | Reason |
|---|---|
| `workflow.id` | Primary key across all services |
| `node.id` | Referenced by run traces, replays, comments |
| `edge.id` | Referenced by conditional routing logs |
| `schema_version` | The version contract itself |

Changing any of these is a data integrity violation — not a schema migration.
