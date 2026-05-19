export const DEFAULT_CHAT_MODEL = "openrouter/free";

export const titleModel = {
  id: "meta-llama/llama-3.2-3b-instruct:free",
  name: "Llama 3.2 3B (Title)",
  provider: "meta-llama",
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
  capabilities?: ModelCapabilities;
};

const defaultFallbacks = [
  "openrouter/free",
  "z-ai/glm-4.5-air:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

function freeModel(
  id: string,
  name: string,
  provider: string,
  description: string,
  capabilities: ModelCapabilities
): ChatModel {
  return {
    id,
    name,
    provider,
    description,
    capabilities,
    fallbacks: defaultFallbacks.filter((fallback) => fallback !== id),
  };
}

export const chatModels: ChatModel[] = [
  freeModel("openrouter/free", "Free Models Router", "openrouter", "OpenRouter router across currently available free models", { tools: true, vision: true, reasoning: true }),
  freeModel("openrouter/owl-alpha", "Owl Alpha", "openrouter", "Free long-context agent model with tool support", { tools: true, vision: false, reasoning: false }),
  freeModel("arcee-ai/trinity-large-thinking:free", "Trinity Large Thinking (free)", "arcee-ai", "Free thinking model with tool support", { tools: true, vision: false, reasoning: true }),
  freeModel("baidu/cobuddy:free", "CoBuddy (free)", "baidu", "Free coding and agent model with tool support", { tools: true, vision: false, reasoning: true }),
  freeModel("cognitivecomputations/dolphin-mistral-24b-venice-edition:free", "Venice Uncensored (free)", "cognitivecomputations", "Free general chat model", { tools: false, vision: false, reasoning: false }),
  freeModel("deepseek/deepseek-v4-flash:free", "DeepSeek V4 Flash (free)", "deepseek", "Free long-context reasoning model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("google/gemma-4-26b-a4b-it:free", "Gemma 4 26B A4B (free)", "google", "Free multimodal Gemma model with tools", { tools: true, vision: true, reasoning: true }),
  freeModel("google/gemma-4-31b-it:free", "Gemma 4 31B (free)", "google", "Free multimodal Gemma model with tools", { tools: true, vision: true, reasoning: true }),
  freeModel("google/lyria-3-clip-preview", "Lyria 3 Clip Preview", "google", "Free preview media model", { tools: false, vision: true, reasoning: false }),
  freeModel("google/lyria-3-pro-preview", "Lyria 3 Pro Preview", "google", "Free preview media model", { tools: false, vision: true, reasoning: false }),
  freeModel("liquid/lfm-2.5-1.2b-instruct:free", "LFM2.5 1.2B Instruct (free)", "liquid", "Free lightweight instruct model", { tools: false, vision: false, reasoning: false }),
  freeModel("liquid/lfm-2.5-1.2b-thinking:free", "LFM2.5 1.2B Thinking (free)", "liquid", "Free lightweight thinking model", { tools: false, vision: false, reasoning: true }),
  freeModel("meta-llama/llama-3.2-3b-instruct:free", "Llama 3.2 3B Instruct (free)", "meta-llama", "Free small Llama model", { tools: false, vision: false, reasoning: false }),
  freeModel("meta-llama/llama-3.3-70b-instruct:free", "Llama 3.3 70B Instruct (free)", "meta-llama", "Free Llama model with tool support", { tools: true, vision: false, reasoning: false }),
  freeModel("minimax/minimax-m2.5:free", "MiniMax M2.5 (free)", "minimax", "Free reasoning model with tool support", { tools: true, vision: false, reasoning: true }),
  freeModel("nousresearch/hermes-3-llama-3.1-405b:free", "Hermes 3 405B (free)", "nousresearch", "Free general chat model", { tools: false, vision: false, reasoning: false }),
  freeModel("nvidia/nemotron-3-nano-30b-a3b:free", "Nemotron 3 Nano 30B (free)", "nvidia", "Free Nemotron reasoning model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "Nemotron 3 Nano Omni (free)", "nvidia", "Free multimodal Nemotron model with tools", { tools: true, vision: true, reasoning: true }),
  freeModel("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super (free)", "nvidia", "Free large Nemotron model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("nvidia/nemotron-nano-12b-v2-vl:free", "Nemotron Nano 12B VL (free)", "nvidia", "Free vision-language Nemotron model with tools", { tools: true, vision: true, reasoning: true }),
  freeModel("nvidia/nemotron-nano-9b-v2:free", "Nemotron Nano 9B V2 (free)", "nvidia", "Free compact Nemotron reasoning model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("openai/gpt-oss-120b:free", "GPT OSS 120B (free)", "openai", "Free open-source reasoning model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("openai/gpt-oss-20b:free", "GPT OSS 20B (free)", "openai", "Free smaller open-source reasoning model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("poolside/laguna-m.1:free", "Laguna M.1 (free)", "poolside", "Free coding agent model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("poolside/laguna-xs.2:free", "Laguna XS.2 (free)", "poolside", "Free compact coding agent model with tools", { tools: true, vision: false, reasoning: true }),
  freeModel("qwen/qwen3-coder:free", "Qwen3 Coder 480B (free)", "qwen", "Free long-context coding and agent model with tools", { tools: true, vision: false, reasoning: false }),
  freeModel("qwen/qwen3-next-80b-a3b-instruct:free", "Qwen3 Next 80B Instruct (free)", "qwen", "Free Qwen instruct model with tools", { tools: true, vision: false, reasoning: false }),
  freeModel("z-ai/glm-4.5-air:free", "GLM 4.5 Air (free)", "z-ai", "Free shopping-agent capable model with tools", { tools: true, vision: false, reasoning: true }),
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      model.capabilities ?? { tools: true, vision: false, reasoning: false },
    ])
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export function getAllGatewayModels(): GatewayModelWithCapabilities[] {
  return chatModels.map((model) => ({
    ...model,
    capabilities: model.capabilities ?? {
      tools: true,
      vision: false,
      reasoning: false,
    },
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
