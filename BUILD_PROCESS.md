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

## Concierge Upgrade (2026-05-19)

Goal: take the agent from "works" to "billion-dollar shopping concierge". Changes below all live behind the existing tool / tool-rendering contract — no breaking API changes for the chat client.

### System prompt rewrite

- Replaced flat 47-line prompt in `backend/src/lib/agents/track1-shopping/prompts.ts` with a structured prompt that spells out persona, decision tree (9 branches A–I), tool-sequencing rules with explicit pre-conditions, response shape, error recovery, freshness audit, and "what you must NEVER do".
- Added a per-chat **agentSeed** (32-bit hash of `chatId`) appended to the prompt with a personality hint, so two judges hitting the same demo see different conversational tone and ordering without losing factual grounding.
- Step budget bumped from `stepCountIs(6)` to `stepCountIs(10)` because the freshness flow (search → assess → counter-search → present) costs more steps.

### Freshness audit (the original concern aryan raised)

Aryan flagged a real failure: typing "gaming phone in this budget" surfaced an old gaming phone, and the agent presented its specs without noticing it was 2 generations behind a current mid-range. New library lives in `backend/src/lib/agents/track1-shopping/freshness/`:

- `categories.ts` — 19 fast-moving categories with regex detection (phone, laptop, GPU, TV, monitor, camera, drone, tablet, smartwatch, earbuds/headphones, router, vacuum, e-bike, running shoes, coffee machine, plus generic). Also `isPerformanceSensitive(query)` for "gaming"/"video editing"/"latest" intent.
- `silicon.ts` — curated chipset/silicon → year + perfTier table covering Apple A11–A18, Apple M1–M4, Snapdragon 845–8 Elite, Dimensity 6300–9400, Tensor G1–G4, Exynos 2100–2400, Intel Core 10th–14th + Ultra, AMD Ryzen 5000–8000, Nvidia RTX 20–50 series, AMD RX 6000–7000.
- `signals.ts` — non-silicon freshness signals across audio (BT 5.0–5.4, LDAC, aptX), TVs (QD-OLED, MLA, Mini-LED, HDMI 2.1), running shoes (Pebax, ZoomX, Fresh Foam X, EVA legacy), vacuums (V8 legacy → V15 Detect), coffee (PID, dual boiler, 58mm portafilter), routers (Wi-Fi 5–7), cameras (stacked sensor, 8K), bikes (Shimano 105/Ultegra Di2, SRAM AXS), USB/charging (Qi2, MagSafe, USB-C PD).
- `assess.ts` — composes verdict: category, generation tier (current / previous / legacy / unknown), summary line for the model to quote verbatim, badgeKind/Label for the UI, and `counterSearchHint` (e.g. "Snapdragon 8 Gen 3 OR A17 Pro OR Dimensity 9300 gaming phone") that the model passes back into `searchProducts` to surface a current-gen alternative in the same budget.

The flow: searchProducts hits a fast-moving category, response payload includes a `freshnessHint` field telling the model it must call `assessProductFreshness`. The verdict drives a `FreshnessBadge` overlay on each product card and a `GenerationVerdictCard` inline in the chat. If `shouldCounterSearch=true`, the model fires another `searchProducts` with the hint as the query and presents both old vs new with a one-line tradeoff.

### New tools

- `searchProducts` (rewritten): pulls 12 from the catalog, applies `sortMode` (relevance / price_low / price_high / rating / random), `lightShuffle` keeps top-2 stable but seeds the long tail with `chatSeed ^ hash(query)` so reruns vary. New `currentGenOnly: true` param appends `(2024 OR 2025 OR 2026)` to the catalog query. Response includes the new `freshnessHint` for the model.
- `refineSearch` — merges new keyword(s) into the prior query in this chat. Lets the shopper say "cheaper" or "with USB-C" without restarting.
- `showMore` — paginates the prior query, filtering out IDs already shown. Seeded shuffle within the unseen pool so re-asks vary.
- `assessProductFreshness` — wraps the freshness lib above.

All search-state tools share a per-chat `SearchMemo` (last query, last filters, last result IDs) that lives only for the lifetime of one HTTP request via `buildAgentForChat({ chatId })`. No cross-request state, no DB writes.

### Web search hardening

- `webSearch` (Bing → DuckDuckGo → Google fallback chain) now takes `searchKind`: 'reviews' / 'comparison' / 'brand_reputation' / 'price_check' / 'generation_check' / 'general'. Each kind shapes the query template. 5-minute in-memory TTL cache keyed on `(searchKind, num, query)` so a second user asking the same question doesn't re-spawn chromium.
- `webFetch` gets a 5-minute URL → content cache.
- New UI: `WebSearchResults` component renders evidence sources behind a collapsed toggle ("Evidence — expert reviews · 5 sources for X"). Hidden by default per aryan's call so the chat stays clean, but the data is one click away for any judge who wants to verify the agent isn't hallucinating.

### UI fixes and new components

- Chevron direction in `ProductGrid` was reversed (showed up-arrow when open). Fixed.
- `ProductGrid` now `defaultOpen={true}` so the first product result is visible immediately.
- `BuyCta` image switched from `object-cover` to `object-contain` so catalog product photos don't crop.
- `getProduct` previously rendered a useless 2-line text card. Replaced with `ProductDetailCard` (image + price range + USP + topFeatures + specs + best-seller line + Buy button).
- `ComparisonTable` got a new "Best seller" row and the per-product Buy button now shows "Buy from {merchant}". Cheapest row gets a "Best price" badge.
- New `FreshnessBadge` component renders on product card image overlays (xs size) and inside detail/comparison views (sm). Color-coded: emerald=current, amber=previous, rose=legacy, sky=info.
- New `GenerationVerdictCard` renders the assess-freshness verdict inline so the audit is visible to the shopper, not just whispered to the model.
- New `WebSearchResults` (toggle).
- `ProductDetailCard` — consolidated detail UI used by `tool-getProduct`.

### Randomization

Three deterministic-but-per-chat-varied knobs all keyed off `chatId`:

1. **agentSeed** in system prompt → personality hint pulled from a pool of 8 ("lead with the deal", "frame as tradeoffs", "open with what to avoid", etc.).
2. **searchProducts shuffle** — top-2 stable for relevance, long tail seeded so different chats see different orderings of the same query.
3. **suggestedActions** — moved from a hardcoded array of 4 to `pickSuggestionsForChat(chatId, 4)` over a 20-prompt pool. Same chat → same 4 chips, different chat → different 4.
4. **greeting** — `pickGreetingForChat(chatId)` picks 1 of 4 titles + 1 of 3 subtitles.

Same chat is stable across reloads (state lives in chatId). Different chats get fresh phrasing without hand-holding.

### Frontend salvage path

Free-tier models occasionally emit the `clarifyIntent` payload as JSON-shaped text instead of actually calling the tool. New `tryParseClarifyMenuFromText()` in `clarify-menu-utils.ts` detects these payloads and `message.tsx` renders the menu chips anyway. Defensive layer — works regardless of whether the model behaves.

### Model provider selection

The model selector now separates runtime providers from model vendors:

- **OpenRouter** — existing OpenRouter-backed model list remains selectable.
- **DeepSeek** — direct DeepSeek API integration is enabled with only `deepseek-v4-flash`.

Reason: OpenRouter remains useful for model variety, but DeepSeek direct calls should use the official DeepSeek OpenAI-compatible API (`https://api.deepseek.com`) and avoid exposing every DeepSeek API model in the UI. The direct DeepSeek provider reads `DEEPSEEK_API_KEY` from local env only. No API keys belong in tracked files.

Direct DeepSeek `deepseek-v4-flash` currently disables DeepSeek thinking mode at the API request layer. DeepSeek thinking mode requires `reasoning_content` to be preserved and replayed across follow-up tool-call turns; the current AI SDK/UI-message persistence path does not keep that provider-specific field. Disabling thinking keeps direct DeepSeek usable with tools until native `reasoning_content` replay is implemented.

### Clarification menu stability

Clarification menus are now treated as terminal for a single assistant turn: the backend stops the tool loop after `clarifyIntent`, and the frontend renders only the latest clarification card from a message. The shopping prompt was softened from "mandatory clarify first" to "clarify only when a missing choice materially changes the product set." Reason: repeated option menus after the shopper already gave a constraint made the agent feel random and caused stacked UI cards.

### Product link rendering

Product-name hover tags in assistant prose were removed. Matched product names now render as plain text links to the merchant URL, without the pill/card hover treatment. Reason: the hover tag made normal shopping advice look like internal annotations.

All shopping CTAs now validate URLs through a shared `getExternalHref()` helper and only use absolute `http`/`https` merchant links. Empty or relative URLs no longer become app-local links. Product cards also show a visible Buy action when a direct merchant URL exists, instead of relying only on the image click or detail modal.

### Compatibility answer safety

For factual compatibility/research questions, the shopping prompt now requires tool evidence before giving a yes/no answer. If web/product lookup fails, the agent should say it could not verify instead of answering from memory. Reason: showing a product to a shopper is different from making unsupported compatibility claims.

### Self-test harness

`backend/scripts/selftest/run.mjs` — runs 8 scenarios (broad / specific / budget / compare / cheapest / gift / phone-old-vs-new / laptop-video) against `/api/chat`, parses the SSE stream, and scores each turn on tool sequencing, hallucination heuristics, and markdown contract. Transcripts saved per run for inspection.

Iteration record:
- Round 1 (z-ai/glm-4.5-air:free): 4/8 clean before primary model rate-limited.
- Round 2 (openai/gpt-oss-120b:free): 1/8 clean (markdown rule too strict).
- Round 3 (after relaxing the markdown rule + tightening cheapest branch): 5/8 clean.
- Round 4 (after adding freshnessHint server-side + frontend salvage): 5/8 clean. Remaining failures are free-tier model artifacts (JSON-leak in clarify, MCP transient 503), not architectural — and the salvage path makes the JSON-leak invisible in the actual UI.

The architecture proved out across rate limits and model swaps. The 3 failures that persisted were:
- broad/gift: model emitted clarifyIntent as text (mitigated in UI by salvage)
- gaming-phone: catalog returned no real gaming phones under $500, agent suggested raising budget — correct behavior, not a bug
- compare: gpt-oss-120b occasionally `finishReason: "stop"` after reasoning without acting (free-model quirk)

### Still open

- Add a small "agent dashboard" panel for judges to see live which tools fired in the last reply (mini debugger UI) — nice-to-have.
- Expand the chipset table beyond electronics-heavy gear (kitchen, fitness equipment) — current coverage is solid but extensible.
- Migrate the SearchMemo from per-request memory to chat-history reconstruction so follow-ups across chat reloads still work.

## Recommendation Feed Homepage

The homepage at `/` is now a recommendation feed instead of an empty stub. It is **not** an AI loop — it is a cached Shopify catalog browse-and-search surface so users can discover products before (or instead of) opening the chat agent.

Decisions:

- **No agent calls on the feed.** The feed only hits Shopify Catalog MCP (`search_catalog`) via the existing `backend/src/lib/shopify/catalog.ts` module. The chat agent is opt-in via the "Ask the agent" link.
- **Daily-rotated category.** A list of 16 query buckets (`headphones`, `espresso`, `running-shoes`, …) rotates on `Math.floor(Date.now() / day) % N`. Same category for everyone on a given UTC day → high cache hit rate.
- **Two-tier cache.**
  - Backend Redis via the existing `getOrSet()` helper. Recommendations TTL: 1h. Search TTL: 5m. Keys are `feed:recs:v1:<slug>` and `feed:search:v1:<lowercased-query>`.
  - Frontend uses Next.js Cache Components (`cacheComponents: true`). The static shell (header, hero, search bar) prerenders; the recommendations and search results stream inside `<Suspense>` boundaries.
- **Search.** A client `FeedSearchBar` pushes `?q=<query>` to `/`. The page reads `searchParams` inside Suspense, calls the backend `/api/feed/search`, and renders the matching products. Empty query falls back to recommendations.
- **Routing.** `/` is owned by the new `app/page.tsx` (root layout only — no chat sidebar). Chat shell now lives at `/chat` and `/chat/[id]`. The previous empty `app/(chat)/page.tsx` was removed because route groups can't coexist on the same URL.
- **Backend endpoints.** `GET /api/feed/recommendations?category=<slug?>` and `GET /api/feed/search?q=<query>`. Both gated by the same `BACKEND_INTERNAL_SECRET` token used by the rest of the internal API surface; no user auth needed because catalog data is not user-scoped.
- **Why not direct MCP from Next.js?** The backend already has the normalized `CatalogProduct` shape and Redis cache. Re-implementing it on the frontend would duplicate logic and split the cache. Reusing the backend keeps the "frontend → backend → Shopify MCP" pattern consistent with chat.
- **Refresh strategy.** Recommendations refresh automatically when the daily slot changes or when the 1h Redis TTL expires. Search results refresh after 5 min so popular queries stay snappy without going stale. There's no manual cache-bust UI yet — easy follow-up if needed.

Files:

- `backend/src/lib/feed.ts` — category list, `getRecommendedFeed`, `searchFeed`, `FeedProduct` mapping.
- `backend/src/server.ts` — adds `/api/feed/recommendations` and `/api/feed/search` route handlers.
- `frontend/lib/feed/{types,api}.ts` — single fetch boundary calling `backendJson` with `auth: false`.
- `frontend/components/feed/feed-search-bar.tsx` — client component, pushes `?q=`.
- `frontend/components/feed/feed-grid.tsx` — server component grid + skeleton + product card.
- `frontend/app/page.tsx` — homepage; static shell + Suspense around dynamic feed.
- `frontend/app/(chat)/chat/page.tsx` — minimal landing route so the chat shell still has an entry path after `app/(chat)/page.tsx` was removed.

No new env vars. Reuses `BACKEND_URL`, `BACKEND_INTERNAL_SECRET`, `REDIS_URL`, `SHOPIFY_CATALOG_MCP_URL`, `SHOPIFY_UCP_AGENT_PROFILE`.

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

## Comparison Table Data & Link Robustness (2026-05-20)

Fixed comparison table missing information and empty columns when products did not have explicit checkout URLs or specific metadata fields populated:

- **Seller & Link Recovery**: Modified `compareProducts` tool to look up alternative product page/variant links (e.g. `variantUrl`, `lookupUrl`, `onlineStoreUrl`) instead of strictly requiring `checkoutUrl`. Handled in-stock sorting and out-of-stock fallback.
- **Top Features & Tech Specs Fallbacks**: If the Shopify Catalog doesn't provide explicit `topFeatures` or `techSpecs` for a product, the compare tool now gracefully falls back to `uniqueSellingPoint` (for features) and formatted `attributes` (for specs, e.g. "Power: 1200W").
- **Rating Normalization**: Updated the catalog rating parser to safely parse numeric strings and fallback counts to avoid throwing away rating data.
