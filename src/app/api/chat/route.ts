import { createChatCompletion } from "@/lib/openrouter/client";
import {
  OpenRouterApiError,
  OpenRouterConfigurationError,
  OpenRouterNetworkError,
  OpenRouterResponseError,
} from "@/lib/openrouter/errors";
import { chatRouteRequestSchema } from "@/lib/openrouter/schemas";

interface ApiErrorBody {
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

function errorResponse(status: number, error: ApiErrorBody["error"]): Response {
  return Response.json({ error } satisfies ApiErrorBody, { status });
}

function mapOpenRouterApiError(error: OpenRouterApiError): Response {
  const { upstreamStatus } = error;

  if (upstreamStatus === 400 || upstreamStatus === 422) {
    return errorResponse(upstreamStatus, {
      code: "OPENROUTER_REQUEST_REJECTED",
      message: "OpenRouter rejected the chat completion request.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return errorResponse(502, {
      code: "OPENROUTER_AUTHENTICATION_FAILED",
      message: "OpenRouter authentication failed.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 402) {
    return errorResponse(402, {
      code: "OPENROUTER_INSUFFICIENT_CREDITS",
      message: "The OpenRouter account has insufficient credits.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 404) {
    return errorResponse(503, {
      code: "OPENROUTER_MODEL_UNAVAILABLE",
      message: "The configured OpenRouter model is unavailable.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 408 || upstreamStatus === 524) {
    return errorResponse(504, {
      code: "OPENROUTER_TIMEOUT",
      message: "The OpenRouter request timed out.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 413) {
    return errorResponse(413, {
      code: "OPENROUTER_REQUEST_TOO_LARGE",
      message: "The OpenRouter request is too large.",
      upstreamStatus,
    });
  }

  if (upstreamStatus === 429) {
    return errorResponse(429, {
      code: "OPENROUTER_RATE_LIMITED",
      message: "OpenRouter rate limit reached.",
      upstreamStatus,
    });
  }

  return errorResponse(503, {
    code: "OPENROUTER_UNAVAILABLE",
    message: "OpenRouter is currently unavailable.",
    upstreamStatus,
  });
}

export async function POST(request: Request): Promise<Response> {
  let requestPayload: unknown;

  try {
    requestPayload = await request.json();
  } catch {
    return errorResponse(400, {
      code: "INVALID_JSON",
      message: "The request body must contain valid JSON.",
    });
  }

  const parsedRequest = chatRouteRequestSchema.safeParse(requestPayload);

  if (!parsedRequest.success) {
    return errorResponse(400, {
      code: "INVALID_REQUEST",
      message: "The chat completion request is invalid.",
      issues: parsedRequest.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const exchange = await createChatCompletion(
      parsedRequest.data.messages,
      request.signal,
    );

    return Response.json(exchange);
  } catch (error) {
    if (error instanceof OpenRouterConfigurationError) {
      return errorResponse(500, {
        code: "OPENROUTER_NOT_CONFIGURED",
        message: "OpenRouter server configuration is missing or invalid.",
      });
    }

    if (error instanceof OpenRouterApiError) {
      return mapOpenRouterApiError(error);
    }

    if (error instanceof OpenRouterNetworkError) {
      return errorResponse(502, {
        code: "OPENROUTER_CONNECTION_FAILED",
        message: "Could not connect to OpenRouter.",
      });
    }

    if (error instanceof OpenRouterResponseError) {
      return errorResponse(502, {
        code: "OPENROUTER_INVALID_RESPONSE",
        message: "OpenRouter returned an invalid response.",
      });
    }

    return errorResponse(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    });
  }
}
