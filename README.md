# Multi-Agent Orchestrator Platform

Production-grade LangGraph.js code generation pipeline on AWS with NestJS — supervisor routing, retry/fallback, cost tracking, and OpenTelemetry observability.

> **Interview signal:** Staff-level architecture ownership — async patterns, distributed tracing, cost tracking, IaC, CI/CD with OIDC.

---

## What It Does

Converts natural-language requirements into reviewed, tested Python code through a supervised multi-agent pipeline:

```
POST /run → SQS → Worker
                    └── LangGraph.js Graph
                          ├── Supervisor  (pure routing function, no LLM)
                          ├── Planner     (requirements → structured plan)
                          ├── Coder       (plan → Python code)
                          ├── Reviewer    (code → quality_score 0–1)
                          └── Tester      (code → test cases + syntax validation)
```

The supervisor routes Coder → Reviewer → Coder in a revision loop until `quality_score ≥ 0.7` (max 3 cycles), then runs the Tester.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent framework | LangGraph.js + LangChain.js |
| API | NestJS (TypeScript) |
| Queue | AWS SQS (long-poll, DLQ) |
| Storage | AWS DynamoDB (single-table, GSI, TTL) |
| Compute | AWS ECS Fargate |
| Tracing | OpenTelemetry → ADOT → CloudWatch X-Ray |
| Logging | Pino (JSON, auto trace_id injection) |
| Metrics | CloudWatch EMF |
| IaC | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions + OIDC (no long-lived keys) |
| Docs | Astro → Cloudflare Pages |

---

## GitHub overview page

This repo powers the public profile overview at https://github.com/venkateshwarreddyr/venkateshwarreddyr.
The Astro site under `docs/` highlights the flagship Multi-Agent Orchestrator Platform alongside experiments, and editing `docs/src/pages/index.astro`
changes what visitors see when they land on the overview.

- **Preview locally:** `cd docs && npm install && npm run dev` starts Astro on http://localhost:3000.  
- **Publish the site:** `cd docs && npm run build` produces a `dist/` tree that can be deployed via GitHub Pages, Cloudflare Pages, or another static host.
- **Keep it in sync:** Commits to `main` rebuild the documentation site so the GitHub overview tracks the latest architecture and experiments.

## Architecture Highlights

### Hub-and-spoke supervisor routing
Every agent returns to the supervisor. Routing is a pure function — no LLM call, no latency, fully unit-testable.

### Retry + fallback model
`@WithRetry({ maxAttempts: 3, fallbackAttr: 'fallbackLlm' })` — exponential backoff with jitter. On the last attempt, gpt-4o-mini replaces gpt-4o to keep the run alive at lower cost.

### Cost tracking
Per-agent token usage accumulates in `AgentState`. Final cost persisted to DynamoDB. CloudWatch EMF metrics emitted (no `PutMetricData` API calls).

### Distributed tracing
OTLP → localhost:4318 (ADOT sidecar) → CloudWatch X-Ray. Every agent node has its own span. `trace_id` injected into every log line via Pino mixin — correlated logs + traces in one CloudWatch Logs Insights query.

### Queue-depth autoscaling
ECS scales on `ApproximateNumberOfMessagesVisible`, not CPU. Predictive, not reactive. Circuit breaker with `rollback=true`.

---

## Getting Started

### Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | 20+ | All |
| npm | 10+ | All |
| Docker + Docker Compose | Latest | Local AWS (LocalStack), full-stack dev |
| AWS CLI | v2 | LocalStack bootstrap (optional) |

### 1. Clone and install

```bash
git clone https://github.com/venkateshwarreddyr/Multi-Agent-Orchestrator-Platform
cd Multi-Agent-Orchestrator-Platform
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```bash
XAI_API_KEY=xai-...            # xAI key (preferred when using xAI)
LLM_BASE_URL=https://api.x.ai/v1
ORCHESTRATOR_MODE=api          # "api" for HTTP server, "worker" for SQS consumer
```

All other variables have sensible defaults for local development. See [.env.example](.env.example) for the full list.

### 3. Run locally (without Docker)

**API mode** — starts the NestJS HTTP server on port 3000:

```bash
ORCHESTRATOR_MODE=api npm run start:dev
```

**Worker mode** — starts the SQS consumer loop (requires LocalStack or real SQS):

```bash
ORCHESTRATOR_MODE=worker npm run start:dev
```

**Both modes with hot-reload** (two terminals):

```bash
# Terminal 1 — API
make dev

# Terminal 2 — Worker
make worker
```

> `make dev` also starts LocalStack and the OTel collector via Docker Compose.

### 4. Run with Docker Compose (full stack)

Starts LocalStack (SQS + DynamoDB), API, Worker, and OTel collector:

```bash
make up
```

Stop everything:

```bash
make down
```

### 5. Submit a run

```bash
# Create a new run
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"requirements": "Build a FastAPI endpoint that accepts a list of integers and returns their mean."}'

# Response: { "runId": "abc-123", "status": "queued" }

# Check status
curl http://localhost:3000/run/abc-123

# List all runs
curl http://localhost:3000/runs

# Health check
curl http://localhost:3000/health
```

### 6. Run tests

```bash
make test                # Unit tests (no Docker needed)
make test-integration    # Integration tests (uses aws-sdk-client-mock)
make test-e2e            # E2E with mocked LLM
make test-all            # All tests with coverage report
```

### 7. Code quality

```bash
make lint                # ESLint
make lint-fix            # Prettier auto-format
make typecheck           # TypeScript type checking (tsc --noEmit)
```

### 8. Build

```bash
npm run build            # Compiles to dist/
make build               # Docker image (orchestrator:local)
```

---

## Project Structure

```
src/
├── config/
│   ├── config.module.ts         # ConfigModule.forRoot() + Joi validation
│   ├── config.schema.ts         # Joi schema for all env vars
│   └── config.service.ts        # Typed config getters
├── api/
│   ├── controllers/
│   │   ├── runs.controller.ts   # POST /run, GET /run/:id, GET /runs
│   │   └── health.controller.ts # GET /health, GET /metrics
│   ├── dto/                     # class-validator DTOs
│   ├── interceptors/            # Request logging with OTel span
│   └── filters/                 # Global exception filter
├── graph/
│   ├── state/                   # AgentState (LangGraph.js Annotation)
│   ├── supervisor/              # Pure function routing (no LLM)
│   ├── nodes/                   # planner, coder, reviewer, tester
│   ├── graph.service.ts         # StateGraph wiring
│   └── graph.module.ts
├── worker/
│   ├── consumer.service.ts      # SQS long-poll (WaitTimeSeconds=20)
│   └── executor.service.ts      # Graph execution + DynamoDB persistence
├── storage/
│   ├── dynamodb.service.ts      # AWS SDK v3 DynamoDBDocumentClient
│   └── schemas/                 # DynamoDB item interfaces
├── observability/
│   ├── tracing.service.ts       # OTel + @Traced() decorator
│   ├── logging.service.ts       # Pino JSON + auto trace_id
│   └── metrics.service.ts       # CloudWatch EMF helpers
├── utils/
│   ├── retry.decorator.ts       # @WithRetry() + fallback model swap
│   └── cost.service.ts          # Token cost calculation
├── app.module.ts
└── main.ts                      # Bootstrap (api | worker mode)

infra/cdk/lib/
├── network-stack.ts             # VPC, subnets, security groups
├── queue-stack.ts               # SQS + DLQ + DLQ alarm
├── storage-stack.ts             # DynamoDB table + GSI + TTL
├── compute-stack.ts             # ECS Fargate + ADOT sidecar + autoscaling
└── observability-stack.ts       # CloudWatch dashboards + alarms
```

---

## Deploy to AWS

```bash
# Install CDK dependencies
cd infra/cdk && npm ci

# Bootstrap CDK (once per account/region)
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1

# Store LLM key in Secrets Manager
aws secretsmanager create-secret \
  --name orchestrator/llm-api-key \
  --secret-string "xai-..."

# Deploy all stacks
npx cdk deploy --all --require-approval never
```

The deployment outputs:
- `ComputeStack.ALBDnsName` — your API base URL
- `ComputeStack.EcrRepoUri` — ECR repo for CI/CD

### CI/CD Setup

1. Create a GitHub Actions IAM role with OIDC trust (see [AWS docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html))
2. Add `AWS_DEPLOY_ROLE_ARN` to GitHub Secrets
3. Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for docs deployment

Every push to `main` → ECR push → ECS rolling deploy → Cloudflare Pages deploy.

---

## Interview Talking Points

| Topic | Key Point |
|-------|-----------|
| Supervisor pattern | Pure routing function — no LLM call, deterministic, unit-testable |
| NestJS DI | Constructor injection, modules, custom decorators — enterprise patterns |
| Retry jitter | `random(0,1)` prevents thundering herd across multiple workers |
| SQS long-poll | `WaitTimeSeconds=20` — cost-critical, not a performance setting |
| DynamoDB GSI | Enables status-filtered queries without table scans |
| OTel + ADOT | Swap observability backends via config, not code |
| Pino mixin | `trace_id` on every log line automatically — no manual pass-through |
| EMF metrics | Custom CloudWatch metrics at zero API cost |
| OIDC CI/CD | No long-lived AWS credentials in GitHub |
| Queue-depth scaling | Predictive (queue) vs reactive (CPU) scaling |
| CDK over Terraform | Same language, L3 constructs, no state file |

---

## License

MIT
