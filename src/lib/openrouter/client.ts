import { OPENROUTER_MODEL, OPENROUTER_REASONING_EFFORT } from "./constants";
import { getOpenRouterConfiguration } from "./environment";
import {
  OpenRouterApiError,
  OpenRouterNetworkError,
  OpenRouterResponseError,
} from "./errors";
import {
  openRouterChatCompletionResponseSchema,
  type ChatMessage,
  type OpenRouterChatCompletionResponse,
} from "./schemas";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

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

export async function createChatCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<OpenRouterChatExchange> {
  const configuration = getOpenRouterConfiguration();
  const payload: OpenRouterChatCompletionRequest = {
    model: configuration.model,
    messages,
    reasoning: {
      effort: configuration.reasoningEffort,
    },
    stream: false,
  };

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Metadata": "enabled",
        "X-OpenRouter-Title": "WebGen Lab",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    throw new OpenRouterNetworkError(error);
  }

  const responseText = await upstreamResponse.text();
  let responsePayload: unknown;

  try {
    responsePayload = JSON.parse(responseText) as unknown;
  } catch {
    throw new OpenRouterResponseError(
      "OpenRouter returned a non-JSON response.",
      responseText,
    );
  }

  if (!upstreamResponse.ok) {
    throw new OpenRouterApiError(upstreamResponse.status, responsePayload);
  }

  const parsedResponse =
    openRouterChatCompletionResponseSchema.safeParse(responsePayload);

  if (!parsedResponse.success) {
    throw new OpenRouterResponseError(
      "OpenRouter returned an invalid chat completion response.",
      responsePayload,
    );
  }

  return {
    request: payload,
    response: parsedResponse.data,
  };
}
