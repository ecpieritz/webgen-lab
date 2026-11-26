import { sendConversationMessage } from "@/features/chat/conversation-session-service";
import {
  ConversationSessionBusyError,
  ConversationSessionNotFoundError,
} from "@/features/chat/errors";
import { conversationMessageRequestSchema } from "@/features/chat/schemas";
import {
  apiErrorResponse,
  createOpenRouterErrorResponse,
} from "@/lib/http/api-error-response";

interface SessionMessageRouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function POST(
  request: Request,
  context: SessionMessageRouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  let requestPayload: unknown;

  try {
    requestPayload = await request.json();
  } catch {
    return apiErrorResponse(400, {
      code: "INVALID_JSON",
      message: "The request body must contain valid JSON.",
    });
  }

  const parsedRequest =
    conversationMessageRequestSchema.safeParse(requestPayload);

  if (!parsedRequest.success) {
    return apiErrorResponse(400, {
      code: "INVALID_REQUEST",
      message: "The conversation message request is invalid.",
      issues: parsedRequest.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const result = await sendConversationMessage(
      sessionId,
      parsedRequest.data.content,
      request.signal,
    );

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
