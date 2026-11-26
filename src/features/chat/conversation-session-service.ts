import "server-only";

import { randomUUID } from "node:crypto";

import {
  ConversationSessionBusyError,
  ConversationSessionNotFoundError,
} from "./errors";
import {
  OPENROUTER_MODEL,
  OPENROUTER_REASONING_EFFORT,
} from "@/lib/openrouter/constants";
import {
  createChatCompletion,
  type OpenRouterChatExchange,
} from "@/lib/openrouter/client";
import type { ChatMessage } from "@/lib/openrouter/schemas";

export type ConversationSessionStatus = "active" | "processing";

export interface ConversationSession {
  id: string;
  model: typeof OPENROUTER_MODEL;
  reasoning: {
    effort: typeof OPENROUTER_REASONING_EFFORT;
  };
  status: ConversationSessionStatus;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageResult {
  session: ConversationSession;
  exchange: OpenRouterChatExchange;
}

interface ConversationSessionGlobalState {
  conversationSessionStore?: Map<string, ConversationSession>;
  processingConversationSessionIds?: Set<string>;
}

const globalState = globalThis as typeof globalThis &
  ConversationSessionGlobalState;

const conversationSessionStore =
  globalState.conversationSessionStore ??
  new Map<string, ConversationSession>();
const processingConversationSessionIds =
  globalState.processingConversationSessionIds ?? new Set<string>();

globalState.conversationSessionStore = conversationSessionStore;
globalState.processingConversationSessionIds = processingConversationSessionIds;

function cloneSession(session: ConversationSession): ConversationSession {
  return structuredClone(session);
}

export function createConversationSession(): ConversationSession {
  const timestamp = new Date().toISOString();
  const session: ConversationSession = {
    id: randomUUID(),
    model: OPENROUTER_MODEL,
    reasoning: {
      effort: OPENROUTER_REASONING_EFFORT,
    },
    status: "active",
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  conversationSessionStore.set(session.id, session);

  return cloneSession(session);
}

export function getConversationSession(
  sessionId: string,
): ConversationSession | undefined {
  const session = conversationSessionStore.get(sessionId);

  return session ? cloneSession(session) : undefined;
}

export function listConversationSessions(): ConversationSession[] {
  return Array.from(conversationSessionStore.values(), cloneSession).sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

export async function sendConversationMessage(
  sessionId: string,
  content: string,
  signal?: AbortSignal,
): Promise<ConversationMessageResult> {
  const session = conversationSessionStore.get(sessionId);

  if (!session) {
    throw new ConversationSessionNotFoundError(sessionId);
  }

  if (processingConversationSessionIds.has(sessionId)) {
    throw new ConversationSessionBusyError(sessionId);
  }

  processingConversationSessionIds.add(sessionId);
  conversationSessionStore.set(sessionId, {
    ...session,
    status: "processing",
    updatedAt: new Date().toISOString(),
  });

  const userMessage = {
    role: "user",
    content,
  } satisfies ChatMessage;
  const requestMessages = [...session.messages, userMessage];

  try {
    const exchange = await createChatCompletion(requestMessages, signal);
    const assistantMessage = exchange.response.choices[0].message;
    const updatedSession: ConversationSession = {
      ...session,
      status: "active",
      messages: [...requestMessages, assistantMessage],
      updatedAt: new Date().toISOString(),
    };

    conversationSessionStore.set(sessionId, updatedSession);

    return {
      session: cloneSession(updatedSession),
      exchange,
    };
  } catch (error) {
    conversationSessionStore.set(sessionId, {
      ...session,
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    throw error;
  } finally {
    processingConversationSessionIds.delete(sessionId);
  }
}
