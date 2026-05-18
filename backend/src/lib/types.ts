import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { track1ShoppingAgent } from "./agents/track1-shopping";
import type { Suggestion } from "./db/schema";

export type ArtifactKind = "text" | "code" | "image" | "sheet";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type Track1 = typeof track1ShoppingAgent.tools;

export type ChatTools = {
  // Track 1 — Shopping Agent
  searchProducts: InferUITool<Track1["searchProducts"]>;
  getProduct: InferUITool<Track1["getProduct"]>;
  compareProducts: InferUITool<Track1["compareProducts"]>;
  compareSellers: InferUITool<Track1["compareSellers"]>;
  buyProduct: InferUITool<Track1["buyProduct"]>;
  clarifyIntent: InferUITool<Track1["clarifyIntent"]>;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  thinking: {
    durationSeconds: number;
    toolTrace: {
      name: string;
      state?: string;
      inputSummary?: string;
      errorText?: string;
    }[];
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
