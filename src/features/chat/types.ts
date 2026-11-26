import type {
  OPENROUTER_MODEL,
  OPENROUTER_REASONING_EFFORT,
} from "@/lib/openrouter/constants";
import type { ChatMessage } from "@/lib/openrouter/schemas";
import type { OpenRouterChatExchange } from "@/lib/openrouter/types";

import type { ASSESSMENT_TURN_LIMIT } from "./constants";

export type ConversationSessionStatus = "active" | "processing" | "completed";

export interface ConversationSession {
  id: string;
  model: typeof OPENROUTER_MODEL;
  reasoning: {
    effort: typeof OPENROUTER_REASONING_EFFORT;
  };
  status: ConversationSessionStatus;
  turnLimit: typeof ASSESSMENT_TURN_LIMIT;
  completedTurns: number;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageResult {
  session: ConversationSession;
  exchange: OpenRouterChatExchange;
}
