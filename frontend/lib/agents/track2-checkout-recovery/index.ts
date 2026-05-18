export const track2CheckoutRecoveryAgent = {
  id: "track2-checkout-recovery" as const,
  name: "AI Checkout Recovery (stub)",
  description:
    "Detects checkout abandonment, asks the right follow-up, recovers the sale",
  systemPrompt:
    "Track 2 not yet implemented. Tell the shopper this agent is coming soon and fall back to general shopping help.",
  tools: {},
  activeToolNames: [] as const,
};
