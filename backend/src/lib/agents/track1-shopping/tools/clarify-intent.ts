import { tool } from "ai";
import { z } from "zod";

export const clarifyIntent = tool({
  description:
    "Show the shopper a small set of one-tap quick-reply chips when their intent is ambiguous. Use sparingly — only when you genuinely cannot search without more info, or when narrowing down (e.g. budget tier, primary use case). Never ask more than 3 options at once.",
  inputSchema: z.object({
    question: z
      .string()
      .min(3)
      .describe("Short, friendly clarifying question shown above the chips"),
    options: z
      .array(
        z.object({
          label: z.string().describe("Chip label (max ~30 chars)"),
          value: z
            .string()
            .describe("Value that will be sent back as the user's reply"),
        })
      )
      .min(2)
      .max(4),
  }),
  execute: async (input) => input,
});
