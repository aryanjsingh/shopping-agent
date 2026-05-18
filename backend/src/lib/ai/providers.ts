import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

let testProvider: ReturnType<typeof loadTestProvider> | null = null;
let openrouter: ReturnType<typeof createOpenRouter> | null = null;

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

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel(modelId);
  }
  return getOpenRouter().chat(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel("title-model");
  }
  return getOpenRouter().chat(titleModel.id);
}
