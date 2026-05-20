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
import { MessageActions } from "./message-actions";
import {
  MessageThinking,
  type ThinkingStep,
  toThinkingTool,
} from "./message-thinking";
import { PreviewAttachment } from "./preview-attachment";
import { parseAssistantResponseText } from "./shopping/assistant-response-json";
import { BuyCta } from "./shopping/buy-cta";
import {
  type ClarifyMenuOutput,
  isClarifyMenuRestatement,
  looksLikeClarifyMenuJson,
  tryParseClarifyMenuFromText,
} from "./shopping/clarify-menu-utils";
import { ComparisonTable } from "./shopping/comparison-table";
import { OptionChips } from "./shopping/option-chips";
import { ProductDetailCard } from "./shopping/product-detail-card";
import { ProductGrid, ProductGridSkeleton } from "./shopping/product-grid";
import { ProductMarkdownResponse } from "./shopping/product-markdown-response";
import { SellerComparison } from "./shopping/seller-comparison";
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

function getDisplayProductSignature(message: ChatMessage) {
  const productIds = message.parts
    ?.filter((part) => part.type === "tool-displayProducts")
    .flatMap((part) => {
      const products = (part as SearchProductsPart).output?.products;
      return Array.isArray(products)
        ? products
            .map((product) => product?.id)
            .filter((id): id is string => typeof id === "string")
        : [];
    });

  return productIds?.length ? productIds.join("|") : null;
}

const findSelectedOption = (
  options: {
    label: string;
    value: string;
    description?: string;
    searchHint?: string;
  }[],
  allMessages?: ChatMessage[],
  messageIndex?: number
): string | undefined => {
  if (!allMessages || messageIndex === undefined || messageIndex === -1) {
    return undefined;
  }

  for (let i = messageIndex + 1; i < allMessages.length; i++) {
    const nextMsg = allMessages[i];
    if (nextMsg.role === "user") {
      const textParts =
        nextMsg.parts
          ?.filter(
            (p) =>
              p.type === "text" &&
              typeof (p as { text?: string }).text === "string"
          )
          .map((p) => (p as { text: string }).text.trim().toLowerCase()) ?? [];

      for (const opt of options) {
        const valLower = opt.value.toLowerCase();
        const lblLower = opt.label.toLowerCase();
        const hintLower = opt.searchHint?.toLowerCase();

        if (
          textParts.some(
            (t) =>
              t === valLower ||
              t === lblLower ||
              (hintLower && t === hintLower) ||
              valLower.includes(t) ||
              lblLower.includes(t) ||
              t.includes(valLower) ||
              t.includes(lblLower)
          )
        ) {
          return opt.value;
        }
      }
    } else if (nextMsg.role === "assistant") {
      break;
    }
  }
  return undefined;
};

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
  messageIndex,
  allMessages,
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
  messageIndex?: number;
  allMessages?: ChatMessage[];
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

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
    if (state === "output-available" && part.output && "error" in part.output) {
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
      ?.filter((part) => part.type === "tool-displayProducts")
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
  const productSignature = consolidatedProducts.length
    ? consolidatedProducts.map((product) => product.id).join("|")
    : null;
  const hasDisplayedSameProductsBefore = Boolean(
    isAssistant &&
      productSignature &&
      allMessages
        ?.slice(0, messageIndex ?? 0)
        .some(
          (previous) =>
            previous.role === "assistant" &&
            getDisplayProductSignature(previous) === productSignature
        )
  );
  const productResults =
    consolidatedProducts.length > 0 && !hasDisplayedSameProductsBefore ? (
      <div className="w-full" key={`message-${message.id}-products`}>
        <ProductGrid
          defaultOpen={true}
          products={consolidatedProducts}
          query={productQuery}
        />
      </div>
    ) : consolidatedProducts.length === 0 && lastProductToolPart ? (
      renderProductToolFallback(
        lastProductToolPart.part,
        lastProductToolPart.key
      )
    ) : null;
  const latestClarifyPartIndex =
    message.parts?.reduce(
      (latest, part, index) =>
        part.type === "tool-clarifyIntent" ? index : latest,
      -1
    ) ?? -1;
  const shouldRenderClarify =
    isLatestMessage &&
    productToolParts.length === 0 &&
    latestClarifyPartIndex !== -1;
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
  const hasClarifyIntent = clarifyOutputs.length > 0;

  // Salvage clarifyIntent menus the model emitted as JSON text instead of a tool call.
  const salvagedClarify: { partIndex: number; menu: ClarifyMenuOutput }[] = [];
  if (isAssistant && clarifyOutputs.length === 0) {
    message.parts?.forEach((part, idx) => {
      if (part.type !== "text" || !part.text) {
        return;
      }
      const parsed = tryParseClarifyMenuFromText(part.text);
      if (parsed) {
        salvagedClarify.push({ partIndex: idx, menu: parsed });
      }
    });
  }
  const salvagedByPart = new Map(
    salvagedClarify.map((s) => [s.partIndex, s.menu])
  );

  // Suppress getProduct cards when compareProducts is also in this message
  const hasCompareProducts =
    message.parts?.some((part) => part.type === "tool-compareProducts") ??
    false;

  const thinkingSteps: ThinkingStep[] = [];
  let toolIndex = 0;
  let reasoningIndex = 0;

  if (message.parts) {
    message.parts.forEach((part, index) => {
      if (part.type === "reasoning") {
        const text = part.text || "";
        if (text.trim().length > 0) {
          thinkingSteps.push({
            type: "reasoning",
            text,
            id: `reasoning-${index}-${reasoningIndex++}`,
          });
        }
      } else if (part.type.startsWith("tool-")) {
        const tool = toThinkingTool(
          part as {
            type: string;
            toolCallId?: string;
            state?: string;
            input?: unknown;
            errorText?: string;
          }
        );
        thinkingSteps.push({
          type: "tool",
          tool,
          id: tool.id || `tool-${index}-${toolIndex++}`,
        });
      }
    });
  }

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

  // Fallback to persisted tools if no live tool parts exist in the parts list
  const hasLiveTools = thinkingSteps.some((step) => step.type === "tool");
  if (!hasLiveTools && persistedThinkingTools.length > 0) {
    persistedThinkingTools.forEach((tool, index) => {
      thinkingSteps.push({
        type: "tool",
        tool,
        id: tool.id || `persisted-tool-${index}`,
      });
    });
  }

  const hasRunningTool = thinkingSteps.some(
    (step) =>
      step.type === "tool" &&
      step.tool.state !== "output-available" &&
      step.tool.state !== "output-denied" &&
      step.tool.state !== "output-error"
  );
  const isThinkingPanelStreaming =
    isAssistant && isLoading && (!hasTextContent || hasRunningTool);

  const thinkingPanel =
    isAssistant && (thinkingSteps.length > 0 || thinkingData) ? (
      <MessageThinking
        durationSeconds={thinkingData?.data?.durationSeconds}
        isStreaming={isThinkingPanelStreaming}
        steps={thinkingSteps}
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
      if (isAssistant && hasClarifyIntent) {
        return null;
      }

      if (isAssistant && looksLikeClarifyMenuJson(part.text)) {
        return null;
      }
      const parsedResponse = isAssistant
        ? parseAssistantResponseText(part.text)
        : { isJsonLike: false, responseText: part.text };
      if (isAssistant && parsedResponse.responseText === null) {
        return null;
      }
      const displayText = parsedResponse.responseText ?? part.text;
      if (!displayText.trim()) {
        return null;
      }

      // Salvaged clarifyIntent JSON — render menu, suppress raw JSON text.
      const salvaged = salvagedByPart.get(index);
      if (salvaged) {
        const menuOptions = (salvaged.options ?? []).filter(
          (
            o
          ): o is {
            label: string;
            value: string;
            description?: string;
            searchHint?: string;
          } => typeof o.label === "string" && typeof o.value === "string"
        );
        const selectedValue = findSelectedOption(
          menuOptions,
          allMessages,
          messageIndex
        );
        return (
          <div key={key}>
            <OptionChips
              mode={salvaged.mode}
              onSelect={
                sendMessage && !selectedValue
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
              selectedValue={selectedValue}
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
          className={cn("text-[15px] leading-[1.65]", {
            "w-fit max-w-[min(80%,56ch)] whitespace-pre-wrap break-words rounded-2xl border border-border/40 bg-secondary px-3.5 py-2 text-left shadow-[var(--shadow-card)]":
              message.role === "user",
          })}
          data-testid="message-content"
          key={key}
        >
          {isAssistant && taggableProducts.length > 0 ? (
            <ProductMarkdownResponse
              products={taggableProducts}
              text={sanitizeText(displayText)}
            />
          ) : (
            <MessageResponse>{sanitizeText(displayText)}</MessageResponse>
          )}
        </MessageContent>
      );
    }

    if (
      type === "tool-searchProducts" ||
      type === "tool-displayProducts" ||
      type === "tool-showMore" ||
      type === "tool-refineSearch"
    ) {
      return null;
    }

    if (type === "tool-webSearch") {
      // Consolidated inside the thinking collapsible panel
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
      if (hasCompareProducts) {
        return null;
      }
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
      if (index !== latestClarifyPartIndex) {
        return null;
      }
      const { toolCallId, state } = part;
      type ClarifyData = {
        question?: string;
        reason?: string;
        mode?: string;
        options?: {
          label: string;
          value: string;
          description?: string;
          searchHint?: string;
        }[];
      };
      const rawData: unknown =
        state === "output-available"
          ? (part as { output?: unknown }).output
          : state === "input-available"
            ? (part as { input?: unknown }).input
            : null;
      const chipData = rawData as ClarifyData | null;
      if (
        chipData &&
        Array.isArray(chipData.options) &&
        chipData.options.length > 0
      ) {
        const menuOptions = chipData.options.filter(
          (
            o
          ): o is {
            label: string;
            value: string;
            description?: string;
            searchHint?: string;
          } => typeof o.label === "string" && typeof o.value === "string"
        );
        const selectedValue = findSelectedOption(
          menuOptions,
          allMessages,
          messageIndex
        );
        return (
          <div key={toolCallId}>
            <OptionChips
              mode={chipData.mode}
              onSelect={
                sendMessage && shouldRenderClarify && !selectedValue
                  ? (value) => {
                      sendMessage({
                        role: "user",
                        parts: [{ type: "text", text: value }],
                      });
                    }
                  : undefined
              }
              options={menuOptions}
              question={chipData.question ?? ""}
              reason={chipData.reason}
              selectedValue={selectedValue}
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

  const hasResponseContent =
    attachmentsFromMessage.length > 0 ||
    (message.parts?.some(
      (part) =>
        (part.type === "text" && part.text?.trim().length > 0) ||
        part.type === "tool-compareProducts" ||
        part.type === "tool-compareSellers" ||
        part.type === "tool-getProduct" ||
        part.type === "tool-buyProduct" ||
        part.type === "tool-clarifyIntent" ||
        part.type === "tool-getWeather" ||
        part.type === "tool-createDocument" ||
        part.type === "tool-updateDocument" ||
        part.type === "tool-requestSuggestions" ||
        consolidatedProducts.length > 0
    ) ??
      false);

  if (isAssistant) {
    return (
      <div
        className="group/message w-full flex flex-col gap-3"
        data-role="assistant"
        data-testid="message-assistant"
      >
        {/* Render thinking panel full-width at the top, without any avatar on the left */}
        {(thinkingPanel || isThinking) && (
          <div className="w-full">
            {isThinking ? (
              <MessageThinking
                durationSeconds={thinkingData?.data?.durationSeconds}
                isStreaming={true}
                steps={thinkingSteps}
              />
            ) : (
              thinkingPanel
            )}
          </div>
        )}

        {/* Render actual response, but only if there is response content */}
        {hasResponseContent && (
          <div className="flex min-w-0 flex-1 flex-col gap-2 w-full">
            {attachments}
            {parts}
            {productResults}
            {actions}
          </div>
        )}
      </div>
    );
  }

  // User message rendering
  const content = (
    <>
      {attachments}
      {parts}
    </>
  );

  return (
    <div
      className="group/message w-full animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div className="flex flex-col items-end gap-2">{content}</div>
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
        <div className="min-w-0 flex-1">
          <MessageThinking isStreaming={true} steps={[]} />
        </div>
      </div>
    </div>
  );
};
