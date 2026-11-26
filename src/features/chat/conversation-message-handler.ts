import "server-only";

import { sendConversationMessage } from "./conversation-session-service";
import {
  ConversationInvalidAssistantResponseError,
  ConversationSessionBusyError,
  ConversationSessionNotFoundError,
  ConversationTurnLimitReachedError,
} from "./errors";
import {
  apiErrorResponse,
  createOpenRouterErrorResponse,
} from "@/lib/http/api-error-response";
import { ExperimentArtifactStorageError } from "@/lib/storage/errors";

export async function handleConversationMessage(
  sessionId: string,
  content: string,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    const result = await sendConversationMessage(sessionId, content, signal);

    return Response.json(result);
  } catch (error) {
    if (error instanceof ConversationSessionNotFoundError) {
      return apiErrorResponse(404, {
        code: "SESSION_NOT_FOUND",
        message: "Conversation session not found.",
      });
    }

    if (error instanceof ConversationSessionBusyError) {
      return apiErrorResponse(409, {
        code: "SESSION_BUSY",
        message: "The conversation session is already processing a message.",
      });
    }

    if (error instanceof ConversationTurnLimitReachedError) {
      return apiErrorResponse(409, {
        code: "TURN_LIMIT_REACHED",
        message: "The conversation session has reached its turn limit.",
      });
    }

    if (error instanceof ConversationInvalidAssistantResponseError) {
      return apiErrorResponse(502, {
        code: "OPENROUTER_INCOMPLETE_RESPONSE",
        message: "OpenRouter returned an incomplete assistant response.",
      });
    }

    if (error instanceof ExperimentArtifactStorageError) {
      return apiErrorResponse(500, {
        code: "EXPERIMENT_STORAGE_FAILED",
        message: "Could not persist the experiment artifacts.",
      });
    }

    const openRouterErrorResponse = createOpenRouterErrorResponse(error);

    if (openRouterErrorResponse) {
      return openRouterErrorResponse;
    }

    return apiErrorResponse(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    });
  }
}
