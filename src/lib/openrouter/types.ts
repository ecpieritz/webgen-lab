import type {
  OPENROUTER_MODEL,
  OPENROUTER_REASONING_EFFORT,
} from "./constants";
import type { ChatMessage, OpenRouterChatCompletionResponse } from "./schemas";

export interface OpenRouterChatCompletionRequest {
  model: typeof OPENROUTER_MODEL;
  messages: ChatMessage[];
  reasoning: {
    effort: typeof OPENROUTER_REASONING_EFFORT;
  };
  stream: false;
}

export interface OpenRouterChatExchange {
  request: OpenRouterChatCompletionRequest;
  response: OpenRouterChatCompletionResponse;
}

export interface OpenRouterRequestArtifact {
  body: string;
  contentType: "application/json";
  method: "POST";
  sentAt: string;
  url: string;
}

export interface OpenRouterResponseArtifact {
  body: string;
  contentType: string | null;
  isJson: boolean;
  receivedAt: string;
  status: number;
}

export interface OpenRouterAttemptArtifacts {
  request: OpenRouterRequestArtifact;
  response?: OpenRouterResponseArtifact;
}

export interface OpenRouterChatCompletionResult {
  artifacts: OpenRouterAttemptArtifacts;
  exchange: OpenRouterChatExchange;
}
