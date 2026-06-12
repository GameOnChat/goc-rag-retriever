# goc-rag-retriever

The retriever microservice for the GameOnChat RAG system. Given a natural-language query it embeds the text with OpenAI, searches a pgvector database for the most similar document chunks, and returns ranked results that an LLM can use to answer questions about video games.

## How it fits in

```
goc-dev-env  ──► PostgreSQL + pgvector  ◄──  goc-rag-retriever
(offline pipeline:                            (this service:
 scrape → chunk → embed)                       embed query → vector search → results)
```

The offline pipeline (`goc-dev-env`) populates `t_fandom_document_chunks` with text chunks and their embeddings. This service queries that table at inference time.

## API

### `POST /retrieve`

Embed a query and return the top-K most similar document chunks.

**Request body**

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `query` | string | yes | — | non-empty |
| `top_k` | number | no | `5` | 1 – 50 |
| `game_id` | number | no | — | integer; omit to search all games |

**Response**

```json
{
  "results": [
    {
      "score": 0.92,
      "text": "...",
      "metadata": { "source": "...", "game": "..." }
    }
  ]
}
```

`score` is the inner-product similarity (higher = more relevant).

---

#### Retrieve top 5 chunks for a query (all games)

```bash
curl -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "Who is the final boss in Elden Ring?"}'
```

```json
{
  "results": [
    {
      "score": 0.94,
      "text": "Elden Beast is the final boss of Elden Ring, encountered after defeating Radagon of the Golden Order...",
      "metadata": { "title": "Elden Beast", "game": "Elden Ring" }
    },
    ...
  ]
}
```

---

#### Retrieve top 3 chunks filtered to a specific game

```bash
curl -X POST http://localhost:3000/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "best starting weapon", "top_k": 3, "game_id": 7}'
```

```json
{
  "results": [
    {
      "score": 0.88,
      "text": "The Uchigatana is a Dexterity-scaling katana available from the start...",
      "metadata": { "title": "Uchigatana", "game": "Elden Ring" }
    },
    ...
  ]
}
```

---

### `GET /health`

Liveness / readiness probe for Docker and Kubernetes.

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "info": {}, "error": {}, "details": {} }
```

---

## Setup

### Prerequisites

- Node.js 20+
- A running PostgreSQL instance populated by `goc-dev-env` (embeddings must exist in `t_fandom_document_chunks`)

### Environment variables

Copy `.env.example` and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | no | `3000` | HTTP port |
| `POSTGRES_HOST` | no | `db` | PostgreSQL host |
| `POSTGRES_PORT` | no | `5432` | PostgreSQL port |
| `POSTGRES_USER` | yes | — | PostgreSQL user |
| `POSTGRES_PASSWORD` | yes | — | PostgreSQL password |
| `POSTGRES_DB` | yes | — | PostgreSQL database name |
| `OPENAI_API_KEY` | yes | — | Used to embed incoming queries |
| `EMBEDDING_DIMENSIONS` | no | `384` | Must match the vector column size in the DB |

> `EMBEDDING_DIMENSIONS` must match the value used when the offline pipeline generated embeddings. Mismatches cause insert/query failures.

### Install and run

```bash
npm install
npm run start:dev   # watch mode
npm run start       # production
npm run build       # compile to dist/
```

### Docker

```bash
docker build -t goc-rag-retriever .
docker run --env-file .env -p 3000:3000 goc-rag-retriever
```

Or via the compose file in `goc-dev-env/`:

```bash
cd ../goc-dev-env
docker compose up -d
```

---

## Architecture

```
RetrieveController  (POST /retrieve)
       │
RetrieveService
   ├── EmbedderService   → OpenAI text-embedding-3-small → float[] vector
   └── DatabaseService   → pgvector  (<#> inner-product search)
                            circuit breaker (opossum) + retry (p-retry)
```

**Resilience**

- Circuit breaker opens after 50 % error rate over 5 requests; resets after 30 s.
- DB calls are retried up to 3 times with exponential backoff (200 ms base, ×2).

**Performance**

- Fastify adapter instead of Express.
- HNSW index on the embedding column keeps similarity search sub-millisecond at scale.