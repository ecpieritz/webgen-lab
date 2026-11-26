import { getConversationSession } from "@/features/chat/conversation-session-service";
import { apiErrorResponse } from "@/lib/http/api-error-response";

interface SessionRouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: SessionRouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const session = getConversationSession(sessionId);

  if (!session) {
    return apiErrorResponse(404, {
      code: "SESSION_NOT_FOUND",
      message: "Conversation session not found.",
    });
  }

  return Response.json({ session });
}
