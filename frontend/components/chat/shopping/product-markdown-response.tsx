"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { getProductHref, type Product } from "./product-grid";

export function ProductMarkdownResponse({
  products,
  text,
}: {
  products: Product[];
  text: string;
}) {
  const wrapChildren = (children: ReactNode) =>
    tagProductText(children, products);

  return (
    <MessageResponse
      components={{
        a: ({ children, ...props }) => (
          <a {...props}>{wrapChildren(children)}</a>
        ),
        em: ({ children, ...props }) => (
          <em {...props}>{wrapChildren(children)}</em>
        ),
        li: ({ children, ...props }) => (
          <li {...props}>{wrapChildren(children)}</li>
        ),
        p: ({ children, ...props }) => (
          <p {...props}>{wrapChildren(children)}</p>
        ),
        strong: ({ children, ...props }) => (
          <strong {...props}>{wrapChildren(children)}</strong>
        ),
      }}
    >
      {text}
    </MessageResponse>
  );
}

function tagProductText(children: ReactNode, products: Product[]) {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return splitProductTags(child, products).map((piece, index) => {
        if (!piece.product) {
          return piece.text;
        }
        return (
          <ProductTag
            // biome-ignore lint/suspicious/noArrayIndexKey: text fragments are generated from markdown text nodes.
            key={`${piece.product.id}-${index}`}
            product={piece.product}
            text={piece.text}
          />
        );
      });
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      return child;
    }

    return child;
  });
}

function ProductTag({ product, text }: { product: Product; text: string }) {
  const href = getProductHref(product);

  if (!href) {
    return text;
  }

  return (
    <a
      className="font-semibold text-primary underline underline-offset-2 transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={href}
      rel="noreferrer noopener"
      target="_blank"
    >
      {text}
    </a>
  );
}

function getTitleVariations(title: string): string[] {
  const variations = new Set<string>();
  const cleanTitle = title.trim();
  variations.add(cleanTitle);

  // Clean delimiters
  const separators = /[\-|::,\(\[\{]/;
  const parts = title.split(separators);
  if (parts.length > 1) {
    const firstPart = parts[0].trim();
    if (firstPart.length >= 4) {
      variations.add(firstPart);
    }
  }

  // Word prefixes
  const words = cleanTitle.split(/\s+/);
  if (words.length >= 2) {
    variations.add(words.slice(0, 2).join(" "));
  }
  if (words.length >= 3) {
    variations.add(words.slice(0, 3).join(" "));
  }
  if (words.length >= 4) {
    variations.add(words.slice(0, 4).join(" "));
  }

  // Blacklist of common descriptor words
  const BLACKLIST = new Set([
    "wireless", "headphones", "headphone", "active", "noise", "cancelling",
    "canceling", "over-ear", "in-ear", "earbuds", "earbud", "with", "charging",
    "case", "bluetooth", "stereo", "sound", "smart", "pro", "max", "mini",
    "plus", "gen", "generation", "edition", "color", "black", "white", "silver",
    "grey", "gray", "blue", "gold", "pink", "green", "red"
  ]);

  // Individual non-blacklisted words of length >= 4
  for (const word of words) {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    if (cleanWord.length >= 4 && !BLACKLIST.has(cleanWord.toLowerCase())) {
      variations.add(cleanWord);
    }
  }

  return Array.from(variations)
    .map((v) => v.trim())
    .filter((v) => v.length >= 4)
    .sort((a, b) => b.length - a.length);
}

function splitProductTags(text: string, products: Product[]) {
  const candidates: { variation: string; product: Product }[] = [];
  for (const product of products) {
    const variations = getTitleVariations(product.title);
    for (const v of variations) {
      candidates.push({ variation: v.toLowerCase(), product });
    }
  }

  // Sort candidates by length of variation descending to match longest possible string first
  candidates.sort((a, b) => b.variation.length - a.variation.length);

  const pieces: { product?: Product; text: string }[] = [];
  const lowerText = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    let match: { index: number; product: Product; variation: string } | undefined;

    for (const candidate of candidates) {
      const index = lowerText.indexOf(candidate.variation, cursor);
      if (index === -1) {
        continue;
      }

      // Check word boundaries
      const startWordBoundary = index === 0 || /\W/.test(lowerText[index - 1]);
      const endWordBoundary =
        index + candidate.variation.length === lowerText.length ||
        /\W/.test(lowerText[index + candidate.variation.length]);

      if (!startWordBoundary || !endWordBoundary) {
        continue;
      }

      if (!match || index < match.index) {
        match = {
          index,
          product: candidate.product,
          variation: candidate.variation,
        };
      }
    }

    if (!match) {
      pieces.push({ text: text.slice(cursor) });
      break;
    }

    if (match.index > cursor) {
      pieces.push({ text: text.slice(cursor, match.index) });
    }
    pieces.push({
      product: match.product,
      text: text.slice(match.index, match.index + match.variation.length),
    });
    cursor = match.index + match.variation.length;
  }

  return pieces.length > 0 ? pieces : [{ text }];
}
