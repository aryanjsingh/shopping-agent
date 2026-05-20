import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isTestEnvironment } from "../constants";
import { DEEPSEEK_DIRECT_MODEL_ID, titleModel } from "./models";

let testProvider: ReturnType<typeof loadTestProvider> | null = null;
let openrouter: ReturnType<typeof createOpenRouter> | null = null;
let deepseek: ReturnType<typeof createOpenAI> | null = null;

function loadTestProvider() {
  const { customProvider } = require("ai");
  const { chatModel, titleModel: testTitle } = require("./models.mock");
  return customProvider({
    languageModels: {
      "chat-model": chatModel,
      "title-model": testTitle,
    },
  });
}

if (isTestEnvironment) {
  testProvider = loadTestProvider();
}

function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  openrouter ??= createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_REFERRER ?? "http://localhost:3000",
      "X-Title": "Shopping Agent",
    },
  });

  return openrouter;
}

function getDeepSeek() {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }

  deepseek ??= createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    fetch: async (input, init) => {
      if (typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          init.body = JSON.stringify({
            ...body,
            thinking: { type: "disabled" },
          });
        } catch {
          // Keep original request body if it is not JSON.
        }
      }
      return fetch(input, init);
    },
    name: "deepseek",
  });

  return deepseek;
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel(modelId);
  }
  if (modelId === DEEPSEEK_DIRECT_MODEL_ID) {
    return getDeepSeek().chat(DEEPSEEK_DIRECT_MODEL_ID);
  }
  return getOpenRouter().chat(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel("title-model");
  }
  return getOpenRouter().chat(titleModel.id);
}
