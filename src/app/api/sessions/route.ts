import {
  createConversationSession,
  listConversationSessions,
} from "@/features/chat/conversation-session-service";

export async function GET(): Promise<Response> {
  const sessions = await listConversationSessions();

  return Response.json({ sessions });
}

export async function POST(): Promise<Response> {
  const session = await createConversationSession();

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
