"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../ai-elements/tool";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageThinking, toThinkingTool } from "./message-thinking";
import { PreviewAttachment } from "./preview-attachment";
import { BuyCta } from "./shopping/buy-cta";
import {
  isClarifyMenuRestatement,
  tryParseClarifyMenuFromText,
  type ClarifyMenuOutput,
} from "./shopping/clarify-menu-utils";
import { ComparisonTable } from "./shopping/comparison-table";
import { OptionChips } from "./shopping/option-chips";
import { ProductDetailCard } from "./shopping/product-detail-card";
import { ProductGrid, ProductGridSkeleton } from "./shopping/product-grid";
import { ProductMarkdownResponse } from "./shopping/product-markdown-response";
import { SellerComparison } from "./shopping/seller-comparison";
import {
  WebSearchResults,
  type WebSearchResult,
} from "./shopping/web-search-results";
import { Weather } from "./weather";

type SearchProductsPart = {
  toolCallId?: string;
  state?: string;
  output?: {
    error?: unknown;
    products?: Parameters<typeof ProductGrid>[0]["products"];
    query?: string;
  };
};

type ThinkingDataPart = {
  type: "data-thinking";
  data?: {
    durationSeconds?: number;
    toolTrace?: {
      name: string;
      state?: string;
      inputSummary?: string;
      errorText?: string;
    }[];
  };
};

type ProductResult = NonNullable<
  NonNullable<SearchProductsPart["output"]>["products"]
>[number];

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate,
  sendMessage,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  isLatestMessage,
  onEdit,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  isLatestMessage: boolean;
  onEdit?: (message: ChatMessage) => void;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" &&
        "text" in part &&
        part.text?.trim().length > 0) ||
      part.type.startsWith("tool-")
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;
  const hasTextContent = message.parts?.some(
    (part) => part.type === "text" && part.text?.trim().length > 0
  );

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false }
  ) ?? { text: "", isStreaming: false, rendered: false };

  const renderProductToolFallback = (part: SearchProductsPart, key: string) => {
    const { toolCallId, state } = part;
    if (
      state === "output-available" &&
      part.output &&
      !("error" in part.output)
    ) {
      return null;
    }
    if (
      state === "output-available" &&
      part.output &&
      "error" in part.output
    ) {
      return (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-600 text-sm dark:bg-red-950/50"
          key={toolCallId ?? key}
        >
          Search failed: {String(part.output.error)}
        </div>
      );
    }
    return (
      <div className="w-full" key={toolCallId ?? key}>
        <ProductGridSkeleton count={4} />
      </div>
    );
  };

  const productToolParts =
    message.parts
      ?.filter(
        (part) =>
          part.type === "tool-searchProducts" ||
          part.type === "tool-showMore" ||
          part.type === "tool-refineSearch"
      )
      .map((part, index) => ({
        key: `message-${message.id}-product-${index}`,
        part: part as SearchProductsPart,
      })) ?? [];
  const productOutputs = productToolParts
    .map(({ part }) => part.output)
    .filter(
      (
        output
      ): output is NonNullable<SearchProductsPart["output"]> & {
        products: ProductResult[];
      } =>
        Boolean(
          output &&
            !("error" in output) &&
            Array.isArray(output.products) &&
            output.products.length > 0
        )
    );
  const productQuery =
    productOutputs.length === 1
      ? (productOutputs[0]?.query ?? "products")
      : "matched products";
  const consolidatedProducts = Array.from(
      productOutputs
        .flatMap((output) => output.products)
        .reduce((map, product) => {
          if (!map.has(product.id)) {
            map.set(product.id, product);
          }
          return map;
        }, new Map<string, ProductResult>())
        .values()
  );
  const lastProductToolPart = productToolParts.at(-1);
  const productResults =
    consolidatedProducts.length > 0 ? (
      <div className="w-full" key={`message-${message.id}-products`}>
        <ProductGrid
          defaultOpen={true}
          products={consolidatedProducts}
          query={productQuery}
        />
      </div>
    ) : lastProductToolPart ? (
      renderProductToolFallback(
        lastProductToolPart.part,
        lastProductToolPart.key
      )
    ) : null;
  const shouldRenderClarify = isLatestMessage && productToolParts.length === 0;
  const taggableProducts =
    consolidatedProducts.length > 0
      ? consolidatedProducts.filter((product): product is ProductResult =>
          Boolean(product?.title?.trim())
        )
      : [];
  const clarifyOutputs =
    message.parts
      ?.filter((part) => part.type === "tool-clarifyIntent")
      .map((part) => {
        const p = part as { state?: string; output?: unknown; input?: unknown };
        const raw = p.state === "output-available" ? p.output : p.input;
        return raw as ClarifyMenuOutput | undefined;
      })
      .filter(Boolean) ?? [];

  // Salvage clarifyIntent menus the model emitted as JSON text instead of a tool call.
  const salvagedClarify: { partIndex: number; menu: ClarifyMenuOutput }[] = [];
  if (isAssistant && shouldRenderClarify && clarifyOutputs.length === 0) {
    message.parts?.forEach((part, idx) => {
      if (part.type !== "text" || !part.text) return;
      const parsed = tryParseClarifyMenuFromText(part.text);
      if (parsed) salvagedClarify.push({ partIndex: idx, menu: parsed });
    });
  }
  const salvagedByPart = new Map(
    salvagedClarify.map((s) => [s.partIndex, s.menu])
  );

  // Suppress getProduct cards when compareProducts is also in this message
  const hasCompareProducts = message.parts?.some(
    (part) => part.type === "tool-compareProducts"
  ) ?? false;

  const thinkingTools =
    message.parts
      ?.filter((part) => part.type.startsWith("tool-"))
      .map((part) =>
        toThinkingTool(
          part as {
            type: string;
            toolCallId?: string;
            state?: string;
            input?: unknown;
            errorText?: string;
          }
        )
      ) ?? [];
  const thinkingData = message.parts?.find(
    (part) => part.type === "data-thinking"
  ) as ThinkingDataPart | undefined;
  const persistedThinkingTools =
    thinkingData?.data?.toolTrace?.map((tool, index) =>
      toThinkingTool({
        errorText: tool.errorText,
        input: tool.inputSummary ? { query: tool.inputSummary } : undefined,
        state: tool.state,
        toolCallId: `persisted-${index}-${tool.name}`,
        type: `tool-${tool.name}`,
      })
    ) ?? [];
  const displayThinkingTools =
    thinkingTools.length > 0 ? thinkingTools : persistedThinkingTools;
  const hasRunningTool = thinkingTools.some(
    (tool) =>
      tool.state !== "output-available" &&
      tool.state !== "output-denied" &&
      tool.state !== "output-error"
  );
  const isThinkingPanelStreaming =
    isAssistant && isLoading && (!hasTextContent || hasRunningTool);
  const thinkingPanel =
    isAssistant &&
    (mergedReasoning.text ||
      displayThinkingTools.length > 0 ||
      thinkingData) ? (
      <MessageThinking
        durationSeconds={thinkingData?.data?.durationSeconds}
        isStreaming={isThinkingPanelStreaming}
        reasoning={mergedReasoning.text}
        tools={displayThinkingTools}
      />
    ) : null;

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      mergedReasoning.rendered = true;
      return null;
    }

    if (type === "text") {
      // Salvaged clarifyIntent JSON — render menu, suppress raw JSON text.
      const salvaged = salvagedByPart.get(index);
      if (salvaged) {
        const menuOptions = (salvaged.options ?? [])
          .filter(
            (o): o is { label: string; value: string; description?: string; searchHint?: string } =>
              typeof o.label === "string" && typeof o.value === "string"
          );
        return (
          <div key={key}>
            <OptionChips
              onSelect={
                sendMessage
                  ? (value) => {
                      sendMessage({
                        role: "user",
                        parts: [{ type: "text", text: value }],
                      });
                    }
                  : undefined
              }
              options={menuOptions}
              question={salvaged.question ?? ""}
              reason={salvaged.reason}
              mode={salvaged.mode}
            />
          </div>
        );
      }

      // When clarifyIntent is present, suppress only restated menu text — keep
      // the short setup sentence the model writes above the chips.
      if (
        isAssistant &&
        clarifyOutputs.some((output) =>
          isClarifyMenuRestatement(part.text, output)
        )
      ) {
        return null;
      }

      return (
        <MessageContent
          className={cn("text-[13px] leading-[1.65]", {
            "w-fit max-w-[min(80%,56ch)] whitespace-pre-wrap break-words rounded-lg border border-border/40 bg-secondary px-3.5 py-2 text-left shadow-[var(--shadow-card)]":
              message.role === "user",
          })}
          data-testid="message-content"
          key={key}
        >
          {isAssistant && taggableProducts.length > 0 ? (
            <ProductMarkdownResponse
              products={taggableProducts}
              text={sanitizeText(part.text)}
            />
          ) : (
            <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
          )}
        </MessageContent>
      );
    }

    if (type === "tool-searchProducts" || type === "tool-showMore" || type === "tool-refineSearch") {
      return null;
    }

    if (type === "tool-webSearch") {
      const { toolCallId, state } = part;
      if (state === "output-available" && part.output) {
        const out = part.output as {
          query?: string;
          searchKind?: string;
          cached?: boolean;
          results?: WebSearchResult[];
          error?: string;
        };
        if (out.error) {
          return (
            <div
              key={toolCallId}
              className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300"
            >
              Web search couldn't reach a source. Continuing with catalog data.
            </div>
          );
        }
        return (
          <div key={toolCallId}>
            <WebSearchResults
              query={out.query ?? ""}
              searchKind={out.searchKind}
              results={out.results ?? []}
              cached={out.cached}
            />
          </div>
        );
      }
      return null;
    }

    if (type === "tool-webFetch") {
      // Hidden by default — fetched content shows up in model narration.
      return null;
    }

    if (type === "tool-compareProducts") {
      const { toolCallId, state } = part;
      if (
        state === "output-available" &&
        part.output &&
        "rows" in part.output
      ) {
        return (
          <div className="w-full" key={toolCallId}>
            <ComparisonTable rows={part.output.rows} />
          </div>
        );
      }
      return (
        <div
          className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-muted-foreground text-xs"
          key={toolCallId}
        >
          Comparing products…
        </div>
      );
    }

    if (type === "tool-compareSellers") {
      const { toolCallId, state } = part;
      if (
        state === "output-available" &&
        part.output &&
        "sellers" in part.output
      ) {
        const out = part.output as {
          productTitle?: string;
          sellers?: {
            variantId: string;
            shopName: string;
            shopUrl?: string;
            price: { amount: number; currency: string };
            availableForSale: boolean;
            secondhand: boolean;
            checkoutUrl: string;
            productUrl: string;
          }[];
        };
        return (
          <div className="w-full" key={toolCallId}>
            <SellerComparison
              productTitle={out.productTitle ?? ""}
              sellers={out.sellers ?? []}
            />
          </div>
        );
      }
      return (
        <div
          className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-muted-foreground text-xs"
          key={toolCallId}
        >
          Finding sellers…
        </div>
      );
    }

    if (type === "tool-getProduct") {
      // Don't render a card when compareProducts is also present — the comparison table covers it
      if (hasCompareProducts) return null;
      const { toolCallId, state } = part;
      if (
        state === "output-available" &&
        part.output &&
        "product" in part.output
      ) {
        const product = part.output.product as
          | Parameters<typeof ProductDetailCard>[0]["product"]
          | undefined;
        if (!product) {
          return null;
        }
        return (
          <div key={toolCallId}>
            <ProductDetailCard product={product} />
          </div>
        );
      }
      return null;
    }

    if (type === "tool-buyProduct") {
      const { toolCallId, state } = part;
      if (state === "output-available" && part.output) {
        const o = part.output;
        return (
          <div key={toolCallId}>
            <BuyCta
              checkoutUrl={o.checkoutUrl}
              image={o.image}
              price={o.price}
              productTitle={o.productTitle}
              shopName={o.shopName}
            />
          </div>
        );
      }
      return null;
    }

    if (type === "tool-clarifyIntent") {
      if (!shouldRenderClarify) {
        return null;
      }
      const { toolCallId, state } = part;
      type ClarifyData = {
        question?: string;
        reason?: string;
        mode?: "use_case" | "budget" | "style" | "feature" | "recipient";
        options?: { label: string; value: string; description?: string; searchHint?: string }[];
      };
      const rawData: unknown =
        state === "output-available" ? (part as { output?: unknown }).output :
        state === "input-available" ? (part as { input?: unknown }).input :
        null;
      const chipData = rawData as ClarifyData | null;
      if (chipData && Array.isArray(chipData.options) && chipData.options.length > 0) {
        return (
          <div key={toolCallId}>
            <OptionChips
              onSelect={
                sendMessage
                  ? (value) => {
                      sendMessage({
                        role: "user",
                        parts: [{ type: "text", text: value }],
                      });
                    }
                  : undefined
              }
              options={chipData.options}
              question={chipData.question ?? ""}
              reason={chipData.reason}
              mode={chipData.mode}
            />
          </div>
        );
      }
      return null;
    }

    if (type === "tool-getWeather") {
      const { toolCallId, state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved ===
            false);
      const widthClass = "w-[min(100%,450px)]";

      if (state === "output-available") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Weather weatherAtLocation={part.output} />
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state="output-denied" type="tool-getWeather" />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  Weather lookup was denied.
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state={state} type="tool-getWeather" />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              {(state === "input-available" ||
                state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
              {state === "approval-requested" && approvalId && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  <button
                    className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: "User denied weather lookup",
                      });
                    }}
                    type="button"
                  >
                    Deny
                  </button>
                  <button
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                    type="button"
                  >
                    Allow
                  </button>
                </div>
              )}
            </ToolContent>
          </Tool>
        </div>
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    return null;
  });

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      regenerate={regenerate}
      vote={vote}
    />
  );

  const content = isThinking ? (
    <MessageThinking
      durationSeconds={thinkingData?.data?.durationSeconds}
      isStreaming={true}
      reasoning=""
      tools={displayThinkingTools}
    />
  ) : (
    <>
      {attachments}
      {thinkingPanel}
      {parts}
      {productResults}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-2" : "flex items-start gap-3"
        )}
      >
        {isAssistant && (
          <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
              <SparklesIcon size={13} />
            </div>
          </div>
        )}
        {isAssistant ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <SparklesIcon size={13} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <MessageThinking
            isStreaming={true}
            reasoning=""
            tools={[]}
          />
        </div>
      </div>
    </div>
  );
};
