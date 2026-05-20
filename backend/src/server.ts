import "./env";
import { put } from "@vercel/blob";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  hasToolCall,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { buildAgentForChat, DEFAULT_AGENT_ID } from "@/lib/agents/registry";
import type { SearchMemo } from "@/lib/agents/track1-shopping/tools/search-products";
import {
  allowedModelIds,
  DEFAULT_CHAT_MODEL,
  getAllGatewayModels,
  getCapabilities,
} from "@/lib/ai/models";
import { buildSystemPrompt, titlePrompt } from "@/lib/ai/prompts";
import { getLanguageModel, getTitleModel } from "@/lib/ai/providers";
import {
  createUser,
  deleteAllChatsByUserId,
  deleteChatById,
  deleteDocumentsByIdAfterTimestamp,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getChatsByUserId,
  getDocumentById,
  getDocumentsById,
  getMessageById,
  getMessagesByChatId,
  getSuggestionsByDocumentId,
  getOrCreateGuestUser,
  getUser,
  getVotesByChatId,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatTitleById,
  updateChatVisibilityById,
  updateDocumentContent,
  updateMessage,
  voteMessage,
  type ArtifactKind,
  type VisibilityType,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, getTextFromMessage, generateUUID } from "@/lib/utils";
import { postRequestBodySchema } from "./chat-api/chat/schema";

type UserType = "guest" | "regular";

type SessionUser = {
  id: string;
  email?: string;
  type: UserType;
};

const PORT = Number(process.env.PORT ?? 4000);
const INTERNAL_SECRET = process.env.BACKEND_INTERNAL_SECRET;

const jsonHeaders = { "Content-Type": "application/json" };

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function getUserFromRequest(request: Request): SessionUser | null {
  if (INTERNAL_SECRET) {
    const token = request.headers.get("x-internal-token");
    if (token !== INTERNAL_SECRET) {
      return null;
    }
  }

  const id = request.headers.get("x-user-id");
  if (!id) {
    return null;
  }

  const type = request.headers.get("x-user-type") === "regular" ? "regular" : "guest";
  return {
    id,
    type,
    email: request.headers.get("x-user-email") ?? undefined,
  };
}

function requireUser(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    throw new ChatbotError("unauthorized:api");
  }
  return user;
}

async function generateTitleFromUserMessage(message: UIMessage) {
  const userText = getTextFromMessage(message);
  const fallbackTitle = generateFallbackTitle(userText);

  try {
    const { text } = await generateText({
      model: getTitleModel(),
      system: titlePrompt,
      prompt: userText,
    });
    const title = cleanTitle(text);
    return title || fallbackTitle;
  } catch (error) {
    console.warn("[backend-chat-title] model title generation failed", error);
    return fallbackTitle;
  }
}

function cleanTitle(value: string) {
  return value
    .replace(/^[#*"\s]+/, "")
    .replace(/[".]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function generateFallbackTitle(text: string) {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s$₹€£.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "New Chat";
  }

  const words = cleaned.split(" ").filter(Boolean);
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "can",
    "could",
    "find",
    "for",
    "get",
    "give",
    "help",
    "i",
    "me",
    "need",
    "please",
    "show",
    "the",
    "to",
    "want",
    "with",
  ]);
  const meaningful = words.filter((word) => !stopWords.has(word.toLowerCase()));
  const selected = (meaningful.length >= 2 ? meaningful : words).slice(0, 5);
  const title = selected
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return cleanTitle(title) || "New Chat";
}

function getToolName(type: string) {
  return type.startsWith("tool-") ? type.slice(5) : type;
}

function summarizeToolInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  if (typeof record.query === "string" && record.query.trim()) {
    return record.query;
  }
  if (typeof record.productId === "string" && record.productId.trim()) {
    return record.productId;
  }
  if (Array.isArray(record.productIds) && record.productIds.length > 0) {
    return `${record.productIds.length} products`;
  }
  return undefined;
}

function getDbMessageText(message: DBMessage | undefined) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return parts
    .map((part: unknown) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return String((part as { text?: unknown }).text);
      }
      return "";
    })
    .join(" ")
    .trim();
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, removeUndefined(entryValue)])
    ) as T;
  }
  return value;
}

function withThinkingPart(
  parts: ChatMessage["parts"],
  durationSeconds: number
): ChatMessage["parts"] {
  const toolTrace = parts
    .filter((part) => part.type.startsWith("tool-"))
    .map((part) => {
      const toolPart = part as {
        type: string;
        state?: string;
        input?: unknown;
        errorText?: string;
      };
      return removeUndefined({
        name: getToolName(toolPart.type),
        state: toolPart.state,
        inputSummary: summarizeToolInput(toolPart.input),
        errorText: toolPart.errorText,
      });
    });

  const withoutPreviousThinking = parts.filter(
    (part) => part.type !== "data-thinking"
  );

  return [
    ...withoutPreviousThinking,
    {
      type: "data-thinking",
      data: {
        durationSeconds,
        toolTrace,
      },
    } as ChatMessage["parts"][number],
  ];
}

function withoutThinkingData(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type !== "data-thinking"),
  }));
}

function hydrateSearchMemo(messages: ChatMessage[]): SearchMemo {
  const memo: SearchMemo = { lastProductIds: [] };

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (
        part.type !== "tool-searchProducts" &&
        part.type !== "tool-refineSearch" &&
        part.type !== "tool-showMore" &&
        part.type !== "tool-displayProducts"
      ) {
        continue;
      }

      const output = (part as { output?: unknown }).output as
        | {
            appliedFilters?: SearchMemo["lastFilters"];
            currentGenOnly?: boolean;
            products?: (NonNullable<SearchMemo["lastProducts"]>[number] & {
              id?: unknown;
            })[];
            query?: unknown;
          }
        | undefined;

      if (!output || typeof output.query !== "string" || output.query.trim().length < 2) {
        continue;
      }

      memo.lastQuery = output.query.trim();
      memo.lastFilters = output.appliedFilters ?? memo.lastFilters;
      memo.lastProductIds = Array.isArray(output.products)
        ? output.products
            .map((product) => product.id)
            .filter((id): id is string => typeof id === "string")
        : [];
      memo.lastProducts = Array.isArray(output.products)
        ? output.products.filter(
            (product): product is NonNullable<SearchMemo["lastProducts"]>[number] =>
              Boolean(product && typeof product.id === "string")
          )
        : memo.lastProducts;
    }
  }

  if (memo.lastQuery) {
    return memo;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const hasClarification = message.parts?.some(
      (part) => part.type === "tool-clarifyIntent"
    );
    if (!hasClarification) {
      continue;
    }

    for (let j = i - 1; j >= 0; j--) {
      const previous = messages[j];
      if (previous.role !== "user") {
        continue;
      }
      const text = getTextFromMessage(previous).trim();
      if (text.length >= 2) {
        return { lastProductIds: [], lastQuery: text };
      }
    }
  }

  return memo;
}

async function handleChatPost(request: Request) {
  const responseStartedAt = Date.now();
  const user = requireUser(request);
  const requestBody = postRequestBodySchema.parse(await request.json());

  const {
    id,
    message,
    messages,
    selectedChatModel,
    selectedVisibilityType,
    selectedAgentId,
  } = requestBody;

  const chatModel = allowedModelIds.has(selectedChatModel)
    ? selectedChatModel
    : DEFAULT_CHAT_MODEL;

  const isToolApprovalFlow = Boolean(messages);
  const chat = await getChatById({ id });
  let messagesFromDb: DBMessage[] = [];
  let titlePromise: Promise<string> | null = null;
  let provisionalTitle: string | null = null;

  if (chat) {
    if (chat.userId !== user.id) {
      throw new ChatbotError("forbidden:chat");
    }
    messagesFromDb = await getMessagesByChatId({ id });
  } else if (message?.role === "user") {
    provisionalTitle = generateFallbackTitle(getTextFromMessage(message));
    await saveChat({
      id,
      userId: user.id,
      title: provisionalTitle,
      visibility: selectedVisibilityType,
    });
    titlePromise = generateTitleFromUserMessage(message);
  }

  let uiMessages: ChatMessage[];

  if (isToolApprovalFlow && messages) {
    const dbMessages = convertToUIMessages(messagesFromDb);
    const approvalStates = new Map(
      messages.flatMap(
        (m) =>
          m.parts
            ?.filter(
              (p: Record<string, unknown>) =>
                p.state === "approval-responded" || p.state === "output-denied"
            )
            .map((p: Record<string, unknown>) => [
              String(p.toolCallId ?? ""),
              p,
            ]) ?? []
      )
    );
    uiMessages = dbMessages.map((msg) => ({
      ...msg,
      parts: msg.parts.map((part) => {
        if ("toolCallId" in part && approvalStates.has(String(part.toolCallId))) {
          return { ...part, ...approvalStates.get(String(part.toolCallId)) };
        }
        return part;
      }),
    })) as ChatMessage[];
  } else {
    uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];
  }

  if (message?.role === "user") {
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });
  }

  const agent = buildAgentForChat({
    agentId: selectedAgentId ?? DEFAULT_AGENT_ID,
    chatId: id,
    initialSearchMemo: hydrateSearchMemo(uiMessages),
  });
  const modelMessages = await convertToModelMessages(withoutThinkingData(uiMessages));
  const modelCapabilities = getCapabilities()[chatModel] ?? {
    reasoning: false,
    tools: true,
    vision: false,
  };

  const stream = createUIMessageStream({
    originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    execute: async ({ writer: dataStream }) => {
      if (provisionalTitle) {
        dataStream.write({
          type: "data-chat-title",
          data: provisionalTitle,
          transient: true,
        });
      }

      const result = streamText({
        model: getLanguageModel(chatModel),
        system: buildSystemPrompt({
          agentPrompt: agent.systemPrompt,
          requestHints: {
            latitude: request.headers.get("x-vercel-ip-latitude") ?? undefined,
            longitude: request.headers.get("x-vercel-ip-longitude") ?? undefined,
            city: request.headers.get("x-vercel-ip-city") ?? undefined,
            country: request.headers.get("x-vercel-ip-country") ?? undefined,
          },
        }),
        messages: modelMessages,
        stopWhen: [stepCountIs(10), hasToolCall("clarifyIntent")],
        activeTools: modelCapabilities.tools
          ? ([...agent.activeToolNames] as string[])
          : [],
        tools: modelCapabilities.tools
          ? (agent.tools as Parameters<typeof streamText>[0]["tools"])
          : undefined,
        experimental_transform: smoothStream({
          chunking: "word",
          delayInMs: 20,
        }),
        experimental_telemetry: {
          isEnabled: false,
          functionId: "backend-stream-text",
        },
      });

      dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

      if (titlePromise) {
        try {
          const title = await titlePromise;
          if (title !== provisionalTitle) {
            dataStream.write({
              type: "data-chat-title",
              data: title,
              transient: true,
            });
          }
          await updateChatTitleById({ chatId: id, title });
        } catch (error) {
          console.warn("[backend-chat-title] failed to persist title", error);
        }
      }
    },
    generateId: generateUUID,
    onFinish: async ({ messages: finishedMessages }) => {
      const durationSeconds = Math.max(
        1,
        Math.ceil((Date.now() - responseStartedAt) / 1000)
      );
      try {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const parts =
              finishedMsg.role === "assistant"
                ? withThinkingPart(finishedMsg.parts, durationSeconds)
                : finishedMsg.parts;
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => {
              const parts =
                currentMessage.role === "assistant"
                  ? withThinkingPart(currentMessage.parts, durationSeconds)
                  : currentMessage.parts;
              return {
                id: currentMessage.id,
                role: currentMessage.role,
                parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              };
            }),
          });
        }
      } catch (error) {
        console.error("[backend-chat-persist] failed to save finished messages", error);
      }
    },
    onError: (error) => {
      console.error("[backend-chat-stream] error", error);
      return "Something went wrong while talking to the model. Try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function handleChatDelete(request: Request) {
  const user = requireUser(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    throw new ChatbotError("bad_request:api");
  }
  const chat = await getChatById({ id });
  if (chat?.userId !== user.id) {
    throw new ChatbotError("forbidden:chat");
  }
  return json(await deleteChatById({ id }));
}

async function handleChatPatch(request: Request) {
  const user = requireUser(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    throw new ChatbotError("bad_request:api");
  }
  const chat = await getChatById({ id });
  if (chat?.userId !== user.id) {
    throw new ChatbotError("forbidden:chat");
  }

  const parsed = z
    .object({
      title: z.string().trim().min(1).max(80),
    })
    .parse(await request.json());
  await updateChatTitleById({ chatId: id, title: parsed.title });
  return json({ ok: true, id, title: parsed.title });
}

async function handleHistory(request: Request) {
  const user = requireUser(request);
  if (request.method === "DELETE") {
    return json(await deleteAllChatsByUserId({ userId: user.id }));
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1), 50);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  if (startingAfter && endingBefore) {
    throw new ChatbotError("bad_request:api", "Only one cursor can be provided.");
  }
  return json(
    await getChatsByUserId({
      id: user.id,
      limit,
      startingAfter,
      endingBefore,
    })
  );
}

async function handleMessages(request: Request) {
  const user = getUserFromRequest(request);
  const chatId = new URL(request.url).searchParams.get("chatId");
  if (!chatId) {
    return json({ error: "chatId required" }, { status: 400 });
  }

  const [chat, messages] = await Promise.all([
    getChatById({ id: chatId }),
    getMessagesByChatId({ id: chatId }),
  ]);

  if (!chat) {
    return json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
    });
  }

  if (chat.visibility === "private" && (!user || user.id !== chat.userId)) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  return json({
    messages: convertToUIMessages(messages),
    visibility: chat.visibility,
    userId: chat.userId,
    isReadonly: !user || user.id !== chat.userId,
  });
}

async function handleVote(request: Request) {
  const user = requireUser(request);
  if (request.method === "GET") {
    const chatId = new URL(request.url).searchParams.get("chatId");
    if (!chatId) {
      throw new ChatbotError("bad_request:api", "Parameter chatId is required.");
    }
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      throw new ChatbotError("not_found:chat");
    }
    if (chat.userId !== user.id) {
      throw new ChatbotError("forbidden:vote");
    }
    return json(await getVotesByChatId({ id: chatId }));
  }

  const parsed = z
    .object({
      chatId: z.string(),
      messageId: z.string(),
      type: z.enum(["up", "down"]),
    })
    .parse(await request.json());
  const chat = await getChatById({ id: parsed.chatId });
  if (!chat) {
    throw new ChatbotError("not_found:vote");
  }
  if (chat.userId !== user.id) {
    throw new ChatbotError("forbidden:vote");
  }
  await voteMessage(parsed);
  return json({ ok: true });
}

async function handleDocument(request: Request) {
  const user = requireUser(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    throw new ChatbotError("bad_request:api", "Parameter id is required.");
  }

  if (request.method === "GET") {
    const documents = await getDocumentsById({ id });
    const [document] = documents;
    if (!document) {
      throw new ChatbotError("not_found:document");
    }
    if (document.userId !== user.id) {
      throw new ChatbotError("forbidden:document");
    }
    return json(documents);
  }

  if (request.method === "DELETE") {
    const timestamp = searchParams.get("timestamp");
    if (!timestamp) {
      throw new ChatbotError("bad_request:api", "Parameter timestamp is required.");
    }
    const [document] = await getDocumentsById({ id });
    if (!document) {
      throw new ChatbotError("not_found:document");
    }
    if (document.userId !== user.id) {
      throw new ChatbotError("forbidden:document");
    }
    return json(
      await deleteDocumentsByIdAfterTimestamp({
        id,
        timestamp: new Date(timestamp),
      })
    );
  }

  const parsed = z
    .object({
      content: z.string(),
      title: z.string(),
      kind: z.enum(["text", "code", "image", "sheet"]),
      isManualEdit: z.boolean().optional(),
    })
    .parse(await request.json());

  const documents = await getDocumentsById({ id });
  if (documents[0] && documents[0].userId !== user.id) {
    throw new ChatbotError("forbidden:document");
  }
  if (parsed.isManualEdit && documents.length > 0) {
    return json(await updateDocumentContent({ id, content: parsed.content }));
  }
  return json(
    await saveDocument({
      id,
      content: parsed.content,
      title: parsed.title,
      kind: parsed.kind as ArtifactKind,
      userId: user.id,
    })
  );
}

async function handleSuggestions(request: Request) {
  const user = requireUser(request);
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) {
    throw new ChatbotError("bad_request:api", "Parameter documentId is required.");
  }
  const suggestions = await getSuggestionsByDocumentId({ documentId });
  if (suggestions[0] && suggestions[0].userId !== user.id) {
    throw new ChatbotError("forbidden:api");
  }
  return json(suggestions);
}

async function handleUpload(request: Request) {
  requireUser(request);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return json({ error: "File size should be less than 5MB" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    return json({ error: "File type should be JPEG or PNG" }, { status: 400 });
  }

  const name = "name" in file ? String(file.name) : "upload";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return json(await put(safeName, await file.arrayBuffer(), { access: "public" }));
}

async function handleInternalUsers(request: Request, pathname: string) {
  if (INTERNAL_SECRET && request.headers.get("x-internal-token") !== INTERNAL_SECRET) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  if (pathname === "/internal/users/by-email") {
    const email = new URL(request.url).searchParams.get("email");
    if (!email) {
      return json({ error: "email required" }, { status: 400 });
    }
    return json(await getUser(email));
  }

  if (pathname === "/internal/users/guest") {
    return json(await getOrCreateGuestUser(), { status: 200 });
  }

  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(6) })
    .parse(await request.json());
  return json(await createUser(email, password), { status: 201 });
}

async function handleAction(request: Request, pathname: string) {
  const user = requireUser(request);
  if (pathname === "/actions/delete-trailing-messages") {
    const { id } = z.object({ id: z.string() }).parse(await request.json());
    const [message] = await getMessageById({ id });
    if (!message) {
      throw new ChatbotError("not_found:api", "Message not found");
    }
    const chat = await getChatById({ id: message.chatId });
    if (!chat || chat.userId !== user.id) {
      throw new ChatbotError("forbidden:api");
    }
    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });
    return json({ ok: true });
  }

  if (pathname === "/actions/update-chat-visibility") {
    const { chatId, visibility } = z
      .object({
        chatId: z.string(),
        visibility: z.enum(["public", "private"]),
      })
      .parse(await request.json());
    const chat = await getChatById({ id: chatId });
    if (!chat || chat.userId !== user.id) {
      throw new ChatbotError("forbidden:api");
    }
    await updateChatVisibilityById({ chatId, visibility: visibility as VisibilityType });
    return json({ ok: true });
  }

  return new Response("Not found", { status: 404 });
}

export async function appFetch(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  try {
    if (pathname.startsWith("/internal/users")) {
      return await handleInternalUsers(request, pathname);
    }
    if (pathname === "/api/models") {
      const headers = { "Cache-Control": "public, max-age=3600, s-maxage=3600" };
      const curatedCapabilities = getCapabilities();
      const models = getAllGatewayModels();
      const capabilities = Object.fromEntries(
        models.map((model) => [
          model.id,
          curatedCapabilities[model.id] ?? model.capabilities,
        ])
      );
      return json({ capabilities, models }, { headers });
    }
    if (pathname === "/api/chat" && request.method === "POST") {
      return await handleChatPost(request);
    }
    if (pathname === "/api/chat" && request.method === "DELETE") {
      return await handleChatDelete(request);
    }
    if (pathname === "/api/chat" && request.method === "PATCH") {
      return await handleChatPatch(request);
    }
    if (pathname === "/api/history") {
      return await handleHistory(request);
    }
    if (pathname === "/api/messages") {
      return await handleMessages(request);
    }
    if (pathname === "/api/vote") {
      return await handleVote(request);
    }
    if (pathname === "/api/document") {
      return await handleDocument(request);
    }
    if (pathname === "/api/suggestions") {
      return await handleSuggestions(request);
    }
    if (pathname === "/api/files/upload" && request.method === "POST") {
      return await handleUpload(request);
    }
    if (pathname.startsWith("/actions/")) {
      return await handleAction(request, pathname);
    }
    if (pathname === "/health") {
      return json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    if (error instanceof z.ZodError) {
      return new ChatbotError("bad_request:api", error.message).toResponse();
    }
    console.error("[backend] unhandled error", error);
    return new ChatbotError("offline:api").toResponse();
  }
}

if (!process.env.VITEST && !process.env.NODE_ENV?.includes("test")) {
  const { createServer } = await import("node:http");
  createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body,
      duplex: "half",
    } as RequestInit);
    const response = await appFetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        res.write(Buffer.from(value));
      }
    }
    res.end();
  }).listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}
