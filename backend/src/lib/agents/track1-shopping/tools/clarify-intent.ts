import { tool } from "ai";
import { z } from "zod";

export const clarifyIntent = tool({
  description:
    "Create a small guided options UI when the shopper's request is underspecified or a missing choice would materially change the product set. Use this before catalog search and again for follow-up clarification when useful. Ask one useful question at a time. Choose the options freely; do not assume a fixed taxonomy.",
  inputSchema: z.object({
    question: z
      .string()
      .min(3)
      .describe("Short, friendly question shown above the menu"),
    reason: z
      .string()
      .min(3)
      .optional()
      .describe(
        "One short sentence explaining why this choice improves catalog results"
      ),
    mode: z
      .string()
      .min(1)
      .max(32)
      .optional()
      .describe(
        "Optional short UI hint for presentation only. Choose any short string or omit it."
      ),
    options: z
      .array(
        z.object({
          label: z.string().describe("Menu option label (max ~32 chars)"),
          description: z
            .string()
            .max(96)
            .optional()
            .describe("Tiny helper text that explains the tradeoff"),
          value: z
            .string()
            .describe(
              "Natural-language reply sent back as the user's selection"
            ),
          searchHint: z
            .string()
            .optional()
            .describe(
              "Concise catalog query phrase to use after this option is selected"
            ),
        })
      )
      .min(2)
      .max(4),
  }),
  execute: async (input) => input,
});
