import {
  createConversationSession,
  listConversationSessions,
} from "@/features/chat/conversation-session-service";

export function GET(): Response {
  return Response.json({ sessions: listConversationSessions() });
}

export function POST(): Response {
  const session = createConversationSession();

  return Response.json(
    { session },
    {
      status: 201,
      headers: {
        Location: `/api/sessions/${session.id}`,
      },
    },
  );
}
