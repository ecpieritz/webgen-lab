import { exportConversation } from "@/features/chat/conversation-export-service";
import {
  ConversationExportNotReadyError,
  ConversationIntegrityError,
  ConversationSessionNotFoundError,
} from "@/features/chat/errors";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { ExperimentArtifactStorageError } from "@/lib/storage/errors";

interface SessionExportRouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: SessionExportRouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;

  try {
    const content = await exportConversation(sessionId);

    return new Response(content, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="conversation.json"',
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof ConversationSessionNotFoundError) {
      return apiErrorResponse(404, {
        code: "SESSION_NOT_FOUND",
        message: "Conversation session not found.",
      });
    }

    if (error instanceof ConversationExportNotReadyError) {
      return apiErrorResponse(409, {
        code: "SESSION_NOT_COMPLETED",
        message: "The conversation session is not ready for export.",
      });
    }

    if (error instanceof ConversationIntegrityError) {
      return apiErrorResponse(500, {
        code: "CONVERSATION_INTEGRITY_ERROR",
        message: "The conversation history failed its integrity checks.",
      });
    }

    if (error instanceof ExperimentArtifactStorageError) {
      return apiErrorResponse(500, {
        code: "EXPERIMENT_STORAGE_FAILED",
        message: "Could not persist the conversation export.",
      });
    }

    return apiErrorResponse(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    });
  }
}
