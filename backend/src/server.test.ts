import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://blob.test/${pathname}`,
    pathname,
    contentType: "image/png",
  })),
}));

vi.mock("@/lib/db/queries", () => ({
  createUser: vi.fn(async (email: string) => [{ id: "user-new", email }]),
  deleteAllChatsByUserId: vi.fn(async () => [{ id: "chat-1" }]),
  deleteChatById: vi.fn(async () => [{ id: "chat-1" }]),
  deleteDocumentsByIdAfterTimestamp: vi.fn(async () => [{ id: "doc-1" }]),
  deleteMessagesByChatIdAfterTimestamp: vi.fn(async () => undefined),
  getChatById: vi.fn(),
  getChatsByUserId: vi.fn(async () => [{ id: "chat-1" }]),
  getDocumentById: vi.fn(),
  getDocumentsById: vi.fn(),
  getMessageById: vi.fn(),
  getMessagesByChatId: vi.fn(),
  getOrCreateGuestUser: vi.fn(async () => [
    { id: "guest-1", email: "guest@kasparro.local" },
  ]),
  getSuggestionsByDocumentId: vi.fn(),
  getUser: vi.fn(async () => [{ id: "u1", email: "a@example.com" }]),
  getVotesByChatId: vi.fn(async () => [{ messageId: "msg-1", isUpvoted: true }]),
  saveChat: vi.fn(),
  saveDocument: vi.fn(async (document) => [document]),
  saveMessages: vi.fn(),
  updateChatTitleById: vi.fn(),
  updateChatVisibilityById: vi.fn(async () => undefined),
  updateDocumentContent: vi.fn(async () => [{ id: "doc-1", content: "updated" }]),
  updateMessage: vi.fn(),
  voteMessage: vi.fn(async () => undefined),
}));

import { appFetch, shouldOfferDiscoveryOptions } from "./server";
import * as queries from "@/lib/db/queries";

const userHeaders = {
  "x-user-id": "user-1",
  "x-user-type": "regular",
};

function authedRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://backend${path}`, {
    ...init,
    headers: {
      ...userHeaders,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

describe("backend app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queries.getChatById).mockResolvedValue(null);
    vi.mocked(queries.getDocumentsById).mockResolvedValue([]);
    vi.mocked(queries.getMessageById).mockResolvedValue([]);
    vi.mocked(queries.getMessagesByChatId).mockResolvedValue([]);
    vi.mocked(queries.getSuggestionsByDocumentId).mockResolvedValue([]);
  });

  it("serves health checks", async () => {
    const response = await appFetch(new Request("http://backend/health"));
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not force discovery options for exact-model compatibility questions", () => {
    expect(
      shouldOfferDiscoveryOptions(
        "Sony WH-1000XM5 would be good for apple ecosystem or not",
        []
      )
    ).toBe(false);
  });

  it("does not force discovery options for named-product suitability questions", () => {
    expect(
      shouldOfferDiscoveryOptions(
        "Swift Sole Running Shoes For Flat Feet Women can I use it as man",
        []
      )
    ).toBe(false);
  });

  it("still offers discovery options for broad category shopping", () => {
    expect(shouldOfferDiscoveryOptions("good headphones for commute", [])).toBe(
      true
    );
  });

  it("serves model metadata", async () => {
    const response = await appFetch(new Request("http://backend/api/models"));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeTruthy();
  });

  it("protects user-scoped APIs", async () => {
    const response = await appFetch(new Request("http://backend/api/history"));
    expect(response.status).toBe(401);
  });

  it("checks auth before parsing chat requests", async () => {
    const response = await appFetch(
      new Request("http://backend/api/chat", {
        method: "POST",
        body: "not-json",
      })
    );
    expect(response.status).toBe(401);
  });

  it("serves internal user endpoints", async () => {
    const lookup = await appFetch(
      new Request("http://backend/internal/users/by-email?email=a@example.com")
    );
    expect(lookup.status).toBe(200);
    await expect(lookup.json()).resolves.toEqual([
      { id: "u1", email: "a@example.com" },
    ]);

    const guest = await appFetch(new Request("http://backend/internal/users/guest"));
    expect(guest.status).toBe(200);
    await expect(guest.json()).resolves.toEqual([
      { id: "guest-1", email: "guest@kasparro.local" },
    ]);

    const created = await appFetch(
      new Request("http://backend/internal/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", password: "secret1" }),
      })
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toEqual([
      { id: "user-new", email: "new@example.com" },
    ]);
  });

  it("handles history list and delete", async () => {
    const list = await appFetch(authedRequest("/api/history?limit=5"));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual([{ id: "chat-1" }]);

    const deleted = await appFetch(authedRequest("/api/history", { method: "DELETE" }));
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual([{ id: "chat-1" }]);
  });

  it("handles message lookup states", async () => {
    const missingParam = await appFetch(authedRequest("/api/messages"));
    expect(missingParam.status).toBe(400);

    const empty = await appFetch(authedRequest("/api/messages?chatId=missing"));
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({ messages: [] });

    vi.mocked(queries.getChatById).mockResolvedValue({
      id: "chat-1",
      userId: "other-user",
      title: "Private",
      visibility: "private",
      createdAt: new Date(),
    });
    const forbidden = await appFetch(authedRequest("/api/messages?chatId=chat-1"));
    expect(forbidden.status).toBe(403);

    vi.mocked(queries.getChatById).mockResolvedValue({
      id: "chat-1",
      userId: "user-1",
      title: "Mine",
      visibility: "private",
      createdAt: new Date(),
    });
    const ok = await appFetch(authedRequest("/api/messages?chatId=chat-1"));
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ isReadonly: false });
  });

  it("handles votes", async () => {
    vi.mocked(queries.getChatById).mockResolvedValue({
      id: "chat-1",
      userId: "user-1",
      title: "Mine",
      visibility: "private",
      createdAt: new Date(),
    });

    const list = await appFetch(authedRequest("/api/vote?chatId=chat-1"));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual([
      { messageId: "msg-1", isUpvoted: true },
    ]);

    const patched = await appFetch(
      authedRequest("/api/vote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: "chat-1", messageId: "msg-1", type: "up" }),
      })
    );
    expect(patched.status).toBe(200);
    await expect(patched.json()).resolves.toEqual({ ok: true });
  });

  it("handles documents and suggestions", async () => {
    vi.mocked(queries.getDocumentsById).mockResolvedValue([
      {
        id: "doc-1",
        userId: "user-1",
        title: "Doc",
        content: "hello",
        kind: "text",
        createdAt: new Date(),
      },
    ]);

    const document = await appFetch(authedRequest("/api/document?id=doc-1"));
    expect(document.status).toBe(200);
    expect(await document.json()).toHaveLength(1);

    const saved = await appFetch(
      authedRequest("/api/document?id=doc-2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Doc", content: "hello", kind: "text" }),
      })
    );
    expect(saved.status).toBe(200);

    const deleted = await appFetch(
      authedRequest("/api/document?id=doc-1&timestamp=2026-01-01T00:00:00.000Z", {
        method: "DELETE",
      })
    );
    expect(deleted.status).toBe(200);

    vi.mocked(queries.getSuggestionsByDocumentId).mockResolvedValue([
      {
        id: "s1",
        documentId: "doc-1",
        documentCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
        userId: "user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        originalText: "hello",
        suggestedText: "hello there",
        description: null,
        isResolved: false,
      },
    ]);
    const suggestions = await appFetch(
      authedRequest("/api/suggestions?documentId=doc-1")
    );
    expect(suggestions.status).toBe(200);
    await expect(suggestions.json()).resolves.toEqual([
      {
        id: "s1",
        documentId: "doc-1",
        documentCreatedAt: "2026-01-01T00:00:00.000Z",
        userId: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        originalText: "hello",
        suggestedText: "hello there",
        description: null,
        isResolved: false,
      },
    ]);
  });

  it("handles uploads", async () => {
    const noFile = await appFetch(authedRequest("/api/files/upload", { method: "POST" }));
    expect(noFile.status).toBe(400);

    const formData = new FormData();
    formData.set("file", new File(["image"], "demo.png", { type: "image/png" }));
    const uploaded = await appFetch(
      authedRequest("/api/files/upload", {
        method: "POST",
        body: formData,
      })
    );
    expect(uploaded.status).toBe(200);
    await expect(uploaded.json()).resolves.toMatchObject({
      url: "https://blob.test/demo.png",
      pathname: "demo.png",
    });
  });

  it("handles server actions", async () => {
    vi.mocked(queries.getMessageById).mockResolvedValue([
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        parts: [],
        attachments: [],
        createdAt: new Date(),
      },
    ]);
    vi.mocked(queries.getChatById).mockResolvedValue({
      id: "chat-1",
      userId: "user-1",
      title: "Mine",
      visibility: "private",
      createdAt: new Date(),
    });

    const deleteTrailing = await appFetch(
      authedRequest("/actions/delete-trailing-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "msg-1" }),
      })
    );
    expect(deleteTrailing.status).toBe(200);
    await expect(deleteTrailing.json()).resolves.toEqual({ ok: true });

    const visibility = await appFetch(
      authedRequest("/actions/update-chat-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: "chat-1", visibility: "public" }),
      })
    );
    expect(visibility.status).toBe(200);
    await expect(visibility.json()).resolves.toEqual({ ok: true });
  });
});
