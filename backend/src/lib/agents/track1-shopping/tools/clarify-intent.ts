import { tool } from "ai";
import { z } from "zod";

export const clarifyIntent = tool({
  description:
    "Show the shopper a small guided menu before catalog search when their request is broad or missing a key buying preference. Use this to act like a shopping agent: ask for the primary use case, budget tier, style, or must-have feature, then search Shopify Catalog MCP with the selected constraint. Prefer this for broad category requests like 'shoes', 'headphones', 'backpack', 'laptop', or 'gift'. Do not ask more than one menu in a row.",
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
      .enum(["use_case", "budget", "style", "feature", "recipient"])
      .optional()
      .describe("The type of decision the menu is helping the shopper make"),
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
