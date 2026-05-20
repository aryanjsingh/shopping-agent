"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getProductHref, ProductHoverPreview, type Product } from "./product-grid";

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

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <a
          className="mx-0.5 inline-flex max-w-full items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 align-baseline font-medium text-[12px] leading-none text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={href}
          rel="noreferrer noopener"
          target="_blank"
        >
          {text}
        </a>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 p-3">
        <ProductHoverPreview product={product} />
      </HoverCardContent>
    </HoverCard>
  );
}

function splitProductTags(text: string, products: Product[]) {
  const names = products
    .map((product) => ({
      lowerTitle: product.title.toLowerCase(),
      product,
      title: product.title,
    }))
    .filter(({ title }) => title.length >= 8)
    .sort((a, b) => b.title.length - a.title.length)
    .slice(0, 8);
  const pieces: { product?: Product; text: string }[] = [];
  const lowerText = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    let match: { index: number; product: Product; title: string } | undefined;

    for (const candidate of names) {
      const index = lowerText.indexOf(candidate.lowerTitle, cursor);
      if (index === -1) {
        continue;
      }
      if (!match || index < match.index) {
        match = {
          index,
          product: candidate.product,
          title: candidate.title,
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
      text: text.slice(match.index, match.index + match.title.length),
    });
    cursor = match.index + match.title.length;
  }

  return pieces.length > 0 ? pieces : [{ text }];
}
