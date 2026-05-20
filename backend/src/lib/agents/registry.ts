import {
  buildTrack1Agent,
  track1ShoppingAgent,
  type Track1BuildContext,
} from "./track1-shopping";
import { track2CheckoutRecoveryAgent } from "./track2-checkout-recovery";
import { track3CheckoutCopilotAgent } from "./track3-checkout-copilot";
import { track4SupportAgent } from "./track4-support";
import { track5RepOptimizerAgent } from "./track5-rep-optimizer";

type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: Record<string, unknown>;
  activeToolNames: readonly string[];
};

export const agentRegistry = {
  "track1-shopping": track1ShoppingAgent,
  "track2-checkout-recovery": track2CheckoutRecoveryAgent,
  "track3-checkout-copilot": track3CheckoutCopilotAgent,
  "track4-support": track4SupportAgent,
  "track5-rep-optimizer": track5RepOptimizerAgent,
} satisfies Record<string, AgentDefinition>;

export type AgentId = keyof typeof agentRegistry;

export const DEFAULT_AGENT_ID: AgentId = "track1-shopping";

export function getAgent(id: string | undefined | null) {
  if (id && id in agentRegistry) {
    return agentRegistry[id as AgentId];
  }
  return agentRegistry[DEFAULT_AGENT_ID];
}

/**
 * Per-chat agent build. Always returns a fresh tool set bound to the chatId
 * so per-chat memos (last query, last result IDs) and the deterministic seed
 * stay isolated across concurrent chats.
 */
export function buildAgentForChat(args: {
  agentId: string | undefined | null;
  chatId: string;
  initialSearchMemo?: Track1BuildContext["initialMemo"];
}): AgentDefinition {
  const id = args.agentId && args.agentId in agentRegistry ? args.agentId : DEFAULT_AGENT_ID;
  if (id === "track1-shopping") {
    const built = buildTrack1Agent({
      chatId: args.chatId,
      initialMemo: args.initialSearchMemo,
    });
    return {
      id: "track1-shopping",
      name: track1ShoppingAgent.name,
      description: track1ShoppingAgent.description,
      systemPrompt: built.systemPrompt,
      tools: built.tools,
      activeToolNames: built.activeToolNames,
    };
  }
  return agentRegistry[id as AgentId];
}

export const agentList = Object.values(agentRegistry);
