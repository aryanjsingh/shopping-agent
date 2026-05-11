# Shopping Agent

Track 1 submission for the Kasparro Agentic Commerce Hackathon.

## Problem Statement

Online shopping still depends on browse, search, filter, compare, and guess. Buyers often know what they need in plain language, but product catalogs are structured for keywords and categories. The result is too many options, weak explanations, and low confidence before purchase.

This project builds an AI shopping agent for a Shopify storefront. The agent helps a buyer explain their intent, asks useful follow-up questions, narrows products, compares tradeoffs, and recommends products with clear reasoning.

## Track

**Track 1: AI Shopping Agent**

Goal: build an AI shopping agent that helps users discover the right products across Shopify merchants and move from intent to purchase.

## Core User Journey

1. Buyer describes what they want in natural language.
2. Agent asks follow-up questions only when needed.
3. Agent searches the Shopify catalog.
4. Agent compares relevant products across useful dimensions.
5. Agent explains why each recommendation fits.
6. Buyer can inspect product details and move toward cart or checkout.

## Shopify Setup

This project is intended to use a Shopify development store with synthetic product data.

Recommended setup:

1. Create a free Shopify Partner account.
2. Create a Shopify development store.
3. Add realistic dummy products for one focused product category.
4. Create a custom Shopify app for API access.
5. Use Shopify Storefront API for buyer-facing product discovery.
6. Keep API tokens in local environment variables, never committed.

Shopify API access is scoped to the store that installs or owns the app. It does not provide access to all Shopify stores.

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

Initial planning stage. Current repo contains hackathon instructions and submission notes. Implementation will be added next.
