import { handleConversationMessage } from "@/features/chat/conversation-message-handler";
import { conversationMessageRequestSchema } from "@/features/chat/schemas";
import { apiErrorResponse } from "@/lib/http/api-error-response";

export const maxDuration = 300;

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

  return handleConversationMessage(
    sessionId,
    parsedRequest.data.content,
    request.signal,
  );
}
