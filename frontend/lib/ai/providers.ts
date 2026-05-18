import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

const openrouter = process.env.OPENROUTER_API_KEY
  ? createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer":
          process.env.OPENROUTER_REFERRER ?? "http://localhost:3000",
        "X-Title": "Shopping Agent",
      },
    })
  : null;

let testProvider: ReturnType<typeof loadTestProvider> | null = null;

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

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel(modelId);
  }
  if (!openrouter) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return openrouter.chat(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && testProvider) {
    return testProvider.languageModel("title-model");
  }
  if (!openrouter) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return openrouter.chat(titleModel.id);
}
