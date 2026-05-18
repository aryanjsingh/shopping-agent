# Shopping Agent

Track 1 submission for the Kasparro Agentic Commerce Hackathon.

## Problem Statement

Online shopping still depends on browse, search, filter, compare, and guess. Buyers often know what they need in plain language, but product catalogs are structured for keywords and categories. The result is too many options, weak explanations, and low confidence before purchase.

This project builds an AI shopping agent on Shopify Catalog MCP. The agent helps a buyer explain their intent, asks useful follow-up questions, searches live Shopify catalog data, compares tradeoffs, and recommends products with clear reasoning.

## Track

**Track 1: AI Shopping Agent**

Goal: build an AI shopping agent that helps users discover the right products across Shopify merchants and move from intent to purchase.

## Core User Journey

1. Buyer describes what they want in natural language.
2. Agent asks follow-up questions only when needed.
3. Agent searches Shopify Catalog MCP.
4. Agent compares relevant products across useful dimensions.
5. Agent explains why each recommendation fits.
6. Buyer can inspect product details and move toward cart or checkout.

## Shopify Runtime

The runtime uses Shopify's UCP-compliant Catalog MCP server instead of a custom REST catalog or Storefront API search path.

- Global MCP endpoint: `https://catalog.shopify.com/api/ucp/mcp`
- Tools used: `search_catalog`, `lookup_catalog`, `get_product`
- Agent profile is sent in `meta.ucp-agent.profile`
- Catalog images render directly from merchant URLs so results stay live and compliant

Optional environment overrides live in `frontend/.env.example`.

## What Makes This Strong

- Understands buyer intent beyond keyword matching.
- Asks smart follow-up questions instead of showing every product.
- Handles tradeoffs explicitly, such as price vs. quality or availability vs. preference.
- Grounds answers in Shopify catalog data.
- Explains recommendations clearly.
- Provides a clean path toward purchase.
- Documents product and technical decisions.

## Required Submission Files

The final GitHub repo should include:

- Product Document
- Technical Document
- Clear setup instructions
- Working code
- Demo video link
- Screenshots or product walkthrough
- Contribution note
- Decision log

## Evaluation Focus

The hackathon judging weights are:

- Product Thinking & Documentation: 25%
- Technical Execution & Architecture: 25%
- Product Experience: 20%
- Business Relevance: 15%
- Originality & Insight: 15%

## Project Status

Working frontend implementation with Shopify Catalog MCP tools, generative shopping UI cards, and guest auth flow.
