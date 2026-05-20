# Shopping Agent

Track 1 submission for the Kasparro Agentic Commerce Hackathon — an AI shopping concierge grounded in the **Shopify Global Catalog MCP**.

## What this is

A buyer types what they want in natural language ("gaming laptop under $1500 with good battery"). The agent asks one clarifying question only when the missing constraint actually changes the answer, searches the live cross-merchant Shopify catalog, audits products in fast-moving categories for generation freshness, compares 2–4 picks side-by-side, and links straight out to the merchant's Shop Pay checkout.

Two surfaces:

- **`/chat`** — the agent loop.
- **`/`** — a non-AI recommendation feed over the same Shopify Catalog MCP. Browse without spending a free-tier LLM token.

## Submission documents

- [PRODUCT.md](./PRODUCT.md) — what we built, for whom, why, scope, tradeoffs.
- [TECHNICAL.md](./TECHNICAL.md) — architecture, implementation, failure handling, limitations.
- [DECISIONS.md](./DECISIONS.md) — decision log ("considered X, chose Y, because Z").
- [CONTRIBUTION.md](./CONTRIBUTION.md) — solo build; time split across product vs. engineering.
- [BUILD_PROCESS.md](./BUILD_PROCESS.md) — running build notebook (source for the four docs above).
- Demo video: _add unlisted YouTube / Drive link here_.

## Stack

- **Frontend** — Next.js 16 App Router, React, Tailwind, shadcn/ui, Vercel AI SDK 6.
- **Backend** — Node + tsx, Vercel AI SDK 6, Hono-style route handler in one `server.ts`.
- **LLM** — OpenRouter (`z-ai/glm-4.5-air:free` primary, free fallbacks) and optional direct DeepSeek (`deepseek-v4-flash`).
- **Catalog** — Shopify Global Catalog MCP (`https://catalog.shopify.com/api/ucp/mcp`).
- **Storage** — Postgres 16 + Redis 7 via Docker Compose.
- **Web evidence** — Playwright + stealth, Bing → DuckDuckGo → Google fallback chain.

## Prerequisites

- Node ≥ 20
- pnpm (frontend) — `corepack enable && corepack prepare pnpm@latest --activate`
- npm (backend)
- Docker Desktop (for Postgres + Redis)
- An OpenRouter API key (free tier is fine) — sign up at https://openrouter.ai/

## Run it locally

### 1. Clone

```bash
git clone <this-repo>
cd shopping-agent
```

### 2. Start Postgres and Redis

```bash
docker compose up -d
```

Postgres comes up on `localhost:5433`, Redis on `localhost:6379`.

### 3. Configure backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=4000
BACKEND_INTERNAL_SECRET=<any random string, e.g. `openssl rand -hex 16`>
POSTGRES_URL=postgres://shopper:shopper@localhost:5433/shopping_agent
REDIS_URL=redis://localhost:6379
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_REFERRER=http://localhost:3000
# optional
DEEPSEEK_API_KEY=
SHOPIFY_CATALOG_MCP_URL=https://catalog.shopify.com/api/ucp/mcp
SHOPIFY_UCP_AGENT_PROFILE=https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json
# optional: residential proxy for Google search on datacenter IPs
SEARCH_PROXY_URL=
```

### 4. Configure frontend

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```env
AUTH_SECRET=<generate with `openssl rand -base64 32`>
POSTGRES_URL=postgres://shopper:shopper@localhost:5433/shopping_agent
REDIS_URL=redis://localhost:6379
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_REFERRER=http://localhost:3000
SHOPIFY_CATALOG_MCP_URL=https://catalog.shopify.com/api/ucp/mcp
SHOPIFY_UCP_AGENT_PROFILE=https://shopify.dev/ucp/agent-profiles/examples/2026-04-08/valid-with-capabilities.json
BACKEND_URL=http://localhost:4000
BACKEND_INTERNAL_SECRET=<same value you set in backend/.env>
# AI_GATEWAY_API_KEY only required if you are NOT on Vercel
AI_GATEWAY_API_KEY=
# Vercel Blob token only required if you want attachment uploads in dev
BLOB_READ_WRITE_TOKEN=
```

### 5. Install dependencies

```bash
# backend
cd backend && npm install

# frontend
cd ../frontend && pnpm install
```

### 6. Migrate the database

From the **frontend** directory (the Drizzle config lives there):

```bash
pnpm drizzle-kit migrate
```

### 7. Start both processes

In two terminals, from repo root:

```bash
# terminal 1 — backend
cd backend && npm run dev
```

```bash
# terminal 2 — frontend
cd frontend && pnpm dev
```

### 8. Open the app

- Chat: http://localhost:3000/chat
- Recommendation feed: http://localhost:3000/

Click **Continue as guest** on the auth screens — no signup needed for the demo path.

## Smoke test

A quick sanity flow:

1. Open `http://localhost:3000/chat`.
2. Send: _"gaming laptop under $1500 with good battery"_
3. Agent should ask one clarifying question (use case) as quick-reply chips.
4. Pick a chip — agent searches Shopify Catalog MCP and renders 2–6 product cards.
5. Send: _"compare the top 3"_ — should render a native comparison table.
6. Click **Buy** on the cheapest in-stock card — should open the merchant's Shop Pay / product page in a new tab.

## Project layout

```
shopping-agent/
├── frontend/                       # Next.js 16 App Router app
│   ├── app/(chat)/                 # /chat shell + chat by id
│   ├── app/page.tsx                # Recommendation feed homepage
│   ├── components/chat/            # Chat surface
│   │   └── shopping/               # Generative UI parts
│   ├── hooks/use-active-chat.tsx   # useChat wrapper, transport, persistence sync
│   ├── lib/db/                     # Drizzle schema + queries (Postgres)
│   ├── lib/feed/                   # Typed client around backend /api/feed/*
│   └── lib/ai/models.ts            # Model picker UI options
├── backend/                        # Node + tsx server
│   ├── src/server.ts               # All routes — chat, messages, feed, votes
│   └── src/lib/
│       ├── agents/registry.ts      # Track 1 wired, Tracks 2–5 stubs
│       ├── agents/track1-shopping/ # System prompt + 12 tools + freshness lib
│       ├── shopify/catalog.ts      # Shopify Catalog MCP JSON-RPC client
│       ├── ai/providers.ts         # OpenRouter + direct DeepSeek
│       └── cache/redis.ts          # getOrSet helper
├── docker-compose.yml              # Postgres 16 + Redis 7
├── product_extractor/              # Legacy CSV pipeline — not part of the runtime
├── PRODUCT.md
├── TECHNICAL.md
├── DECISIONS.md
├── CONTRIBUTION.md
└── BUILD_PROCESS.md
```

## Tracks 2–5

`backend/src/lib/agents/registry.ts` already maps `track2-checkout-recovery`, `track3-checkout-copilot`, `track4-support`, `track5-rep-optimizer` to stubs that share the Track 1 `AgentDefinition` shape. They can be filled in with their own system prompts + tools without touching the routing or persistence layer.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:5433`** — Postgres container is not up. `docker compose ps` and `docker compose up -d`.
- **`ECONNREFUSED 127.0.0.1:6379`** — same for Redis.
- **`Shopify Catalog MCP search_catalog failed (4xx)`** — check that your machine has outbound HTTPS to `catalog.shopify.com`. No auth token is required for the public global endpoint.
- **OpenRouter `429 rate limit`** — switch to a different model in the chat header (model picker), or wait the cooldown.
- **`AUTH_SECRET` missing** — frontend will refuse to start. Generate with `openssl rand -base64 32`.
- **Google CAPTCHA in `webSearch`** — set `SEARCH_PROXY_URL` to a residential proxy URL in `backend/.env`. DuckDuckGo / Bing legs of the chain usually succeed without it.

## License

See `frontend/LICENSE`.
