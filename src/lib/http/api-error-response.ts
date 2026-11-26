import {
  OpenRouterApiError,
  OpenRouterConfigurationError,
  OpenRouterNetworkError,
  OpenRouterResponseError,
} from "@/lib/openrouter/errors";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    upstreamStatus?: number;
    issues?: Array<{
      path: string;
      message: string;
    }>;
  };
}

export function apiErrorResponse(
  status: number,
  error: ApiErrorBody["error"],
): Response {
  return Response.json({ error } satisfies ApiErrorBody, { status });
}

function openRouterApiErrorResponse(error: OpenRouterApiError): Response {
  const { upstreamStatus } = error;

  if (upstreamStatus === 400 || upstreamStatus === 422) {
    return apiErrorResponse(upstreamStatus, {
      code: "OPENROUTER_REQUEST_REJECTED",
      message: "OpenRouter rejected the chat completion request.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return apiErrorResponse(502, {
      code: "OPENROUTER_AUTHENTICATION_FAILED",
      message: "OpenRouter authentication failed.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 402) {
    return apiErrorResponse(402, {
      code: "OPENROUTER_INSUFFICIENT_CREDITS",
      message: "The OpenRouter account has insufficient credits.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 404) {
    return apiErrorResponse(503, {
      code: "OPENROUTER_MODEL_UNAVAILABLE",
      message: "The configured OpenRouter model is unavailable.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 408 || upstreamStatus === 524) {
    return apiErrorResponse(504, {
      code: "OPENROUTER_TIMEOUT",
      message: "The OpenRouter request timed out.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 413) {
    return apiErrorResponse(413, {
      code: "OPENROUTER_REQUEST_TOO_LARGE",
      message: "The OpenRouter request is too large.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 429) {
    return apiErrorResponse(429, {
      code: "OPENROUTER_RATE_LIMITED",
      message: "OpenRouter rate limit reached.",
      upstreamStatus,
    });
  }

  return apiErrorResponse(503, {
    code: "OPENROUTER_UNAVAILABLE",
    message: "OpenRouter is currently unavailable.",
    upstreamStatus,
  });
}

export function createOpenRouterErrorResponse(
  error: unknown,
): Response | undefined {
  if (error instanceof OpenRouterConfigurationError) {
    return apiErrorResponse(500, {
      code: "OPENROUTER_NOT_CONFIGURED",
      message: "OpenRouter server configuration is missing or invalid.",
    });
  }

  if (error instanceof OpenRouterApiError) {
    return openRouterApiErrorResponse(error);
  }

  if (error instanceof OpenRouterNetworkError) {
    return apiErrorResponse(502, {
      code: "OPENROUTER_CONNECTION_FAILED",
      message: "Could not connect to OpenRouter.",
    });
  }

  if (error instanceof OpenRouterResponseError) {
    return apiErrorResponse(502, {
      code: "OPENROUTER_INVALID_RESPONSE",
      message: "OpenRouter returned an invalid response.",
    });
  }

  return undefined;
}
