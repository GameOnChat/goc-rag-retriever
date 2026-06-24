# Task 3.1 — Implement the RAG Retriever Service

## Context

The `goc-rag-retriever` is the inference-time component of the GameOnChat RAG system. The `goc-dev-env` data pipeline scrapes Fandom wikis, chunks the content with LlamaIndex, and embeds it into PostgreSQL/pgvector using OpenAI `text-embedding-3-small` (384 dims). This service accepts natural language queries, embeds them with the same model, runs a pgvector similarity search, and returns the most relevant chunks to callers (e.g., the Lore Keeper worker agent).

## Architecture

| Concern | Choice | Reason |
|---|---|---|
| Framework | NestJS + Fastify | Structured DI, Fastify perf over Express |
| Language | TypeScript (strict) | Type safety for DTO validation and DB rows |
| DB client | `pg` Pool | Matches goc-dev-env, no ORM overhead needed |
| Embedding | `openai` SDK | Raw SDK, no LlamaIndex needed at inference time |
| Validation | `class-validator` + `ValidationPipe` | Declarative DTO validation with auto-coercion |
| Circuit breaker | `nest-circuit-breaker` | NestJS-native, decorator-based |
| Retry | `p-retry` | Battle-tested, exponential backoff |
| Health | `@nestjs/terminus` | Standard NestJS health check endpoint |
| Similarity | `<#>` inner product | Matches HNSW index's `vector_ip_ops` |

## File Structure

```
src/
├── main.ts                          # Bootstrap with FastifyAdapter, global ValidationPipe
├── app.module.ts                    # Root module
├── database/
│   ├── database.module.ts           # @Global provider via useFactory + addCircuitBreakerSupportTo
│   └── database.service.ts         # pg Pool, searchChunks() with circuit breaker + p-retry
├── embedder/
│   ├── embedder.module.ts
│   └── embedder.service.ts         # OpenAI embeddings wrapper
├── retrieve/
│   ├── retrieve.module.ts
│   ├── retrieve.controller.ts      # POST /retrieve
│   ├── retrieve.service.ts         # Orchestrates embedder + db
│   └── dto/
│       ├── retrieve-request.dto.ts
│       └── retrieve-response.dto.ts
└── health/
    ├── health.module.ts
    └── health.controller.ts        # GET /health via @nestjs/terminus
```

## API

### `POST /retrieve`

**Request:**
```json
{
  "query": "Why did Malenia fight Radahn?",
  "top_k": 5,
  "game_id": 4
}
```
- `query` — required, non-empty string
- `top_k` — optional integer 1–50, defaults to 5
- `game_id` — optional positive integer; omit to search all games

**Response:**
```json
{
  "results": [
    {
      "score": 0.87,
      "text": "Malenia, Blade of Miquella...",
      "metadata": {
        "game_id": 4,
        "game_title": "Elden Ring",
        "doc_id": 123,
        "page_title": "Malenia",
        "category": "Characters",
        "source": "https://..."
      }
    }
  ]
}
```

### `GET /health`
Returns `{ "status": "ok" }` (HTTP 200) when the service is up.

## Resilience

`searchChunks` is protected by:
1. **`p-retry`** — 3 attempts, 200 ms base delay, factor 2 (exponential backoff)
2. **`nest-circuit-breaker`** — opens after 50% errors across ≥5 requests; sleeps 30 s before probing again

## Key Config (`.env`)

```
POSTGRES_HOST=db          # 'db' in Docker, 'localhost' for local dev
POSTGRES_PORT=5432
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
OPENAI_API_KEY=sk-...
EMBEDDING_DIMENSIONS=384  # Must match VECTOR(384) column in DB
PORT=3000
```

## Docker

Multi-stage Dockerfile: `build` stage compiles TypeScript, `production` stage runs `dist/main` with prod deps only. Uncommented in `goc-dev-env/docker-compose.yml` with full env var passthrough.

## Pre-conditions (fixed alongside this task)

- `goc-dev-env/scripts/init-db.sql`: fixed stray `t` typo at end of `t_fandom_documents` CREATE statement
- `EMBEDDING_DIMENSIONS` must be `384` to match `VECTOR(384)` column

## Verification

```bash
# 1. Start services
cd goc-dev-env && docker compose up -d

# 2. Health check
curl http://localhost:3000/health

# 3. Unfiltered retrieval
curl -s -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "final boss fight strategy", "top_k": 3}' | jq .

# 4. Game-scoped retrieval
curl -s -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "Why did Malenia fight Radahn?", "top_k": 5, "game_id": 4}' | jq .

# 5. Validation errors → 400
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" -d '{}'
```