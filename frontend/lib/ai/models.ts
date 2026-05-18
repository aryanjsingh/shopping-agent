export const DEFAULT_CHAT_MODEL = "z-ai/glm-4.5-air:free";

export const titleModel = {
  id: "meta-llama/llama-3.2-3b-instruct:free",
  name: "Llama 3.2 3B (Title)",
  provider: "openrouter",
  description: "Tiny fast model for chat titles",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  fallbacks?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air (free)",
    provider: "z-ai",
    description: "Primary shopping agent model with tool calls",
    fallbacks: [
      "openai/gpt-oss-120b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT OSS 120B (free)",
    provider: "openai",
    description: "Open-source reasoning model with tool calls",
    fallbacks: [
      "z-ai/glm-4.5-air:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (free)",
    provider: "meta-llama",
    description: "Fallback for tool-calling shopping flows",
    fallbacks: ["z-ai/glm-4.5-air:free", "openai/gpt-oss-120b:free"],
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      { tools: true, vision: false, reasoning: false },
    ])
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export function getAllGatewayModels(): GatewayModelWithCapabilities[] {
  return chatModels.map((m) => ({
    ...m,
    capabilities: { tools: true, vision: false, reasoning: false },
  }));
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
