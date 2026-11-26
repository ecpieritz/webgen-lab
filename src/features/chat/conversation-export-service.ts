import "server-only";

import { getConversationSession } from "./conversation-session-service";
import {
  ConversationExportNotReadyError,
  ConversationIntegrityError,
  ConversationSessionNotFoundError,
} from "./errors";
import type { ChatMessage } from "@/lib/openrouter/schemas";
import { persistConversationExport } from "@/lib/storage/experiment-artifact-store";

export interface ConversationExport {
  model: "openai/gpt-5";
  reasoning: {
    effort: "medium";
  };
  messages: ChatMessage[];
}

function hasValidMessageOrder(messages: ChatMessage[]): boolean {
  return messages.every((message, index) => {
    const expectedRole = index % 2 === 0 ? "user" : "assistant";

    return message.role === expectedRole;
  });
}

export async function exportConversation(sessionId: string): Promise<string> {
  const session = await getConversationSession(sessionId);

  if (!session) {
    throw new ConversationSessionNotFoundError(sessionId);
  }

  if (
    session.status !== "completed" ||
    session.completedTurns !== session.turnLimit
  ) {
    throw new ConversationExportNotReadyError(sessionId);
  }

  if (
    session.messages.length !== session.turnLimit * 2 ||
    !hasValidMessageOrder(session.messages)
  ) {
    throw new ConversationIntegrityError(sessionId);
  }

  const conversation: ConversationExport = {
    model: session.model,
    reasoning: session.reasoning,
    messages: session.messages,
  };
  const content = `${JSON.stringify(conversation, null, 2)}\n`;

  await persistConversationExport(sessionId, content);

  return content;
}
