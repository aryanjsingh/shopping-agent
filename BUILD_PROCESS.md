# Build Process Notes

Use this file as the running source of truth for future Product Document, Technical Document, README updates, demo script, and decision log.

## Hackathon Track

- Track: **Track 1: AI Shopping Agent**
- Goal: build an AI shopping agent that helps shoppers discover the right products in a Shopify catalog and move from intent to purchase.
- Product framing: store-native AI shopping assistant for a Shopify merchant.
- Demo framing: Shopify development store seeded with realistic electronics catalog data.

## Product Direction

The product is not a generic chatbot and not a scraper. It is a shopping assistant grounded in Shopify's UCP catalog tools.

The assistant should:

- understand buyer intent in natural language
- ask follow-up questions only when needed
- search the Shopify catalog
- compare products on useful dimensions
- explain recommendations clearly
- support a path toward product page, cart, or checkout

## Data Strategy

Initial idea was Best Buy API -> Shopify CSV -> Shopify import. Best Buy API access was unavailable for free/edu email accounts, so we moved to a local Amazon Canada product CSV dataset.

Current source files:

- `product_extractor/amz_ca_total_products_data_processed.csv`
- `product_extractor/product_template.csv`

The source CSV has these fields:

- `asin`
- `title`
- `imgUrl`
- `productURL`
- `stars`
- `reviews`
- `price`
- `listPrice`
- `categoryName`
- `isBestSeller`
- `boughtInLastMonth`

Important limitation: the source CSV does not contain original product descriptions. Description text must be generated from available structured fields unless another data source is added.

## Shopify Catalog Generation

We created scripts in `product_extractor`:

- `amazon_to_shopify_csv.py`: converts source Amazon Canada CSV rows into Shopify import CSV format.
- `split_amazon_to_shopify_by_category.py`: creates one full Shopify CSV and one Shopify CSV per source category.
- `bestbuy_to_shopify_csv.py`: kept as optional fallback if Best Buy API access becomes available later.

Generated outputs:

- `product_extractor/output/shopify-all-products.csv`
- `product_extractor/output/by-category/*.csv`
- `product_extractor/output/shopify-tech-electronics.csv`

Current preferred import file:

- `product_extractor/output/shopify-tech-electronics.csv`

It contains:

- `249,401` products
- tech/electronics-related categories only
- Shopify template-compatible headers
- no source-reference text in product descriptions
- no "Imported as demo catalog data" text in product descriptions

## Category Selection

We first counted broad keyword matches across the full dataset. Broad matching returned `450,721` products but included noisy categories like storage furniture, baby strollers, beauty tools, watches, and non-electronics categories.

We then moved to a cleaner category allowlist for:

- electronics
- electrical products
- mobile-related products
- routers/networking
- laptops/desktops/computers
- TVs/projectors
- servers/storage/hard disks
- monitors
- printers
- cameras
- audio/video electronics
- peripherals and accessories

This produced `249,401` products in `shopify-tech-electronics.csv`.

## Description Strategy

Because original descriptions are absent from the source CSV, current descriptions are generated from:

- title
- category
- rating
- review count
- recent demand signal where available

Rejected description text:

- source reference links
- "Imported as demo catalog data for an AI shopping agent prototype"

Reason: those made Shopify product pages look fake and hurt product experience.

Future improvement:

- extract specs from titles into structured tags/metafields
- generate richer descriptions for a smaller selected catalog
- enrich only the imported Shopify subset, not all 2M+ products

## Shopify Runtime Plan

After CSV import, the app should use Shopify APIs:

- Storefront API for buyer-facing product search, details, variants, and cart flow.
- Admin API only for backend-only sync/admin workflows if needed.

Admin API tokens must never be exposed in frontend code.

The production story:

- each merchant installs the Shopify app
- merchant authorizes required scopes
- app indexes that merchant's catalog
- shopping agent runs against that store's products

The hackathon demo story:

- one Shopify development store
- seeded electronics catalog
- same architecture as production, scoped to one demo store

## App Folder Structure

Initial app folders:

- `backend/`: API server, Shopify Storefront API integration, product search/ranking, AI orchestration.
- `frontend/`: buyer-facing shopping assistant UI and product recommendation experience.

Frontend base:

- installed Vercel `chatbot` template from `https://github.com/vercel/chatbot`
- package manager: `pnpm`
- framework: Next.js App Router
- UI stack: Tailwind CSS, shadcn/ui, Radix primitives
- AI stack: Vercel AI SDK / AI Gateway by default

Frontend local setup needs env vars from `frontend/.env.example` before running full app:

- `AUTH_SECRET`
- `AI_GATEWAY_API_KEY` for non-Vercel local AI Gateway usage
- `POSTGRES_URL`
- `REDIS_URL`
- `BLOB_READ_WRITE_TOKEN`

Backend Shopify setup:

- `backend/scripts/get-admin-token.js`: exchanges Shopify client credentials for an Admin API access token using client credentials grant.
- `backend/scripts/create-storefront-token.js`: creates a Storefront access token through the Admin API.
- `backend/scripts/test-storefront-products.js`: validates Storefront token by reading five products.
- Secrets must live only in `backend/.env`, never in git or chat.

## Pivot: Shopify Catalog MCP (2026-05-16)

After reviewing current Shopify agentic commerce docs, runtime moved from the old REST Catalog Search endpoints to Shopify's UCP-compliant Catalog MCP server.

Current endpoint:

- Global Catalog MCP: `POST https://catalog.shopify.com/api/ucp/mcp`

Current tool calls:

- `search_catalog`
- `lookup_catalog`
- `get_product`

Each request sends `meta.ucp-agent.profile`, defaulting locally to Shopify's example UCP agent profile unless `SHOPIFY_UCP_AGENT_PROFILE` is set.

Why this changes everything:

- Returns rich product data (`description`, `uniqueSellingPoint`, `topFeatures`, `techSpecs`) — no description generation needed.
- Aggregates variants across multiple merchants per product, so we get built-in seller / price comparison.
- Each variant exposes `checkoutUrl` (Shop Pay) — full purchase flow without ever touching the Cart API.
- Search is cross-merchant, which is the literal Track 1 framing ("across Shopify merchants").

Decision: drop the custom REST catalog and old Storefront search path for runtime. Shopify Catalog MCP is the data source. Storefront Catalog MCP remains a future single-merchant option.

Important compliance detail: Shopify Catalog docs say not to cache search results and not to cache/re-use catalog images. The implementation sends `cache: "no-store"` for MCP calls and renders merchant image URLs directly in the UI.

## Stack (current)

- Frontend: Vercel AI Chatbot template, Next.js 16 App Router, Tailwind, shadcn/ui, framer-motion, Vercel AI SDK 6.
- LLM: OpenRouter via `@openrouter/ai-sdk-provider`. Primary `z-ai/glm-4.5-air:free`, fallbacks `openai/gpt-oss-120b:free` and `meta-llama/llama-3.3-70b-instruct:free`. Title model `meta-llama/llama-3.2-3b-instruct:free`. We confirmed tool calling works on the primary + first fallback.
- Catalog: Shopify Catalog MCP (above).
- Postgres + Redis: local Docker (`docker-compose.yml` at repo root, services `postgres:16-alpine` and `redis:7-alpine`, volumes `pgdata` / `redisdata`).
- Auth: next-auth credentials provider with prominent **Continue as guest** CTA on both login and register pages (writes to `Users` table via existing `createGuestUser`).

## Local environment

`frontend/.env.local`:

- `AUTH_SECRET` (generated by `openssl rand -base64 32`)
- `POSTGRES_URL=postgres://shopper:shopper@localhost:5432/shopping_agent`
- `REDIS_URL=redis://localhost:6379`
- `OPENROUTER_API_KEY`

`frontend/.env.local` optional Shopify MCP overrides:

- `SHOPIFY_CATALOG_MCP_URL=https://catalog.shopify.com/api/ucp/mcp`
- `SHOPIFY_UCP_AGENT_PROFILE=<your UCP agent profile URL>`

`backend/.env` (never committed) remains only for legacy Admin/Storefront helper scripts:

- `SHOPIFY_SHOP`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_STOREFRONT_ACCESS_TOKEN`

Both files are gitignored at the repo root.

## Agent registry

To keep the door open for Tracks 2–5 without refactor, agents live behind a registry:

- `frontend/lib/agents/registry.ts` maps `trackId` → `{ id, name, systemPrompt, tools, activeToolNames }`.
- `track1-shopping` is the live agent with six tools:
  - `searchProducts` — Shopify Catalog MCP `search_catalog`, no search-result cache.
  - `getProduct` — Shopify Catalog MCP `get_product`, with `lookup_catalog` fallback.
  - `compareProducts` — fans out 2–4 product lookups, builds a normalized comparison row.
  - `compareSellers` — groups variants by shop and sorts by price.

## UI Baseline Reset (2026-05-17)

The custom shopping dashboard shell was removed from the active chat path.

Why:

- It made the app look like a fake ecommerce dashboard instead of a Vercel AI SDK chatbot.
- It added static recommendations, saved items, premium upsell UI, and a fake user name that were not grounded in the real Shopify Catalog MCP flow.
- Future UI changes should be made manually on top of the Vercel-style chat components, not through a separate fake home dashboard.

Current direction:

- Empty state uses `Greeting` and `SuggestedActions`.
- Sidebar uses New Chat, chat history, and user nav.
- Composer remains the primary first-screen action.
- Shopping-specific UI should live in message/tool components after real catalog calls.
  - `buyProduct` — pass-through tool that emits a checkout CTA card.
  - `clarifyIntent` — emits quick-reply chips for cases where one piece of intent is genuinely missing.
- `track2-checkout-recovery`, `track3-checkout-copilot`, `track4-support`, `track5-rep-optimizer` are stubs that share the same `AgentDefinition` shape so they can be filled in without code changes elsewhere.
- `/api/chat` reads `selectedAgentId` from the request body (defaults to `track1-shopping`) and wires the registry entry into `streamText`.

## Generative UI

`frontend/components/chat/shopping/*` holds the AI-rendered message parts:

- `ProductGrid` — 2-up grid of product cards (image, USP, price, rating, primary checkout button).
- `OptionChips` — clickable chips that call `sendMessage` for the chip value.
- `ComparisonTable` — image / price / rating / features / specs / action matrix for 2–4 products.
- `SellerComparison` — per-merchant table with "Best price" / "Used" / "Out of stock" badges.
- `BuyCta` — final purchase card with Shop Pay note.

These render off the AI SDK `tool-<name>` message parts in `components/chat/message.tsx`. The artifact UI from the original template is left dormant — not wired in the registry, so its branches never trigger.

## Important Decisions

- Shopify Catalog MCP is the runtime source of truth — no custom REST catalog, no CSV import, no Storefront API for the demo path. This buys us cross-merchant search and checkout links in the same UCP flow, which directly maps to Track 1's product framing.
- Free-tier OpenRouter only. We accept the rate-limit risk and add fallback model chains rather than ask for paid keys.
- Postgres + Redis run locally via Docker for reproducibility. No external paid databases for the demo.
- Auth is preserved (next-auth) but a **Continue as guest** CTA is the dominant entry on both login and register pages so judges can demo without signup.
- Track-agnostic registry from day one so Tracks 2–5 plug in without surgery.
- Artifact tools (`createDocument`, `editDocument`, `getWeather`, etc.) from the chatbot template are not deleted but are unwired from the agent — keeping types stable while we focus on Track 1. Cleanup deferred.
- Build process notes from the original Shopify dev store + CSV plan are kept above for historical context, but they are not part of the current runtime.

## Submission Requirements To Remember

Final repo should include:

- Product Document
- Technical Document
- README with setup instructions
- working code
- demo video link
- screenshots or walkthrough
- contribution note
- decision log

Judging weights:

- Product Thinking & Documentation: 25%
- Technical Execution & Architecture: 25%
- Product Experience: 20%
- Business Relevance: 15%
- Originality & Insight: 15%
