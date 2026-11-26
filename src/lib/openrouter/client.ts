import { getOpenRouterConfiguration } from "./environment";
import {
  OpenRouterApiError,
  OpenRouterNetworkError,
  OpenRouterResponseError,
} from "./errors";
import { openRouterChatCompletionResponseSchema } from "./schemas";
import type {
  OpenRouterAttemptArtifacts,
  OpenRouterChatCompletionRequest,
  OpenRouterChatCompletionResult,
} from "./types";
import type { ChatMessage } from "./schemas";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export async function createChatCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<OpenRouterChatCompletionResult> {
  const configuration = getOpenRouterConfiguration();
  const payload: OpenRouterChatCompletionRequest = {
    model: configuration.model,
    messages,
    reasoning: {
      effort: configuration.reasoningEffort,
    },
    stream: false,
  };
  const requestBody = JSON.stringify(payload);
  const requestArtifacts: OpenRouterAttemptArtifacts = {
    request: {
      body: requestBody,
      contentType: "application/json",
      method: "POST",
      sentAt: new Date().toISOString(),
      url: OPENROUTER_CHAT_COMPLETIONS_URL,
    },
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
      body: requestBody,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    throw new OpenRouterNetworkError(error, requestArtifacts);
  }

  let responseText: string;

  try {
    responseText = await upstreamResponse.text();
  } catch (error) {
    throw new OpenRouterNetworkError(error, requestArtifacts);
  }

  let responsePayload: unknown;
  let isJson = true;

  try {
    responsePayload = JSON.parse(responseText) as unknown;
  } catch {
    responsePayload = responseText;
    isJson = false;
  }

  const artifacts: OpenRouterAttemptArtifacts = {
    ...requestArtifacts,
    response: {
      body: responseText,
      contentType: upstreamResponse.headers.get("content-type"),
      isJson,
      receivedAt: new Date().toISOString(),
      status: upstreamResponse.status,
    },
  };

  if (!isJson) {
    throw new OpenRouterResponseError(
      "OpenRouter returned a non-JSON response.",
      responsePayload,
      artifacts,
    );
  }

  if (!upstreamResponse.ok) {
    throw new OpenRouterApiError(
      upstreamResponse.status,
      responsePayload,
      artifacts,
    );
  }

  const parsedResponse =
    openRouterChatCompletionResponseSchema.safeParse(responsePayload);

  if (!parsedResponse.success) {
    throw new OpenRouterResponseError(
      "OpenRouter returned an invalid chat completion response.",
      responsePayload,
      artifacts,
    );
  }

  return {
    artifacts,
    exchange: {
      request: payload,
      response: parsedResponse.data,
    },
  };
}
