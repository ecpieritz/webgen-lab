import "server-only";

import { randomUUID } from "node:crypto";

import { ASSESSMENT_TURN_LIMIT } from "./constants";
import {
  ConversationInvalidAssistantResponseError,
  ConversationSessionBusyError,
  ConversationSessionNotFoundError,
  ConversationTurnLimitReachedError,
} from "./errors";
import {
  OPENROUTER_MODEL,
  OPENROUTER_REASONING_EFFORT,
} from "@/lib/openrouter/constants";
import { createChatCompletion } from "@/lib/openrouter/client";
import { getOpenRouterAttemptArtifacts } from "@/lib/openrouter/errors";
import type { ChatMessage } from "@/lib/openrouter/schemas";
import type { OpenRouterChatExchange } from "@/lib/openrouter/types";
import { persistOpenRouterAttempt } from "@/lib/storage/experiment-artifact-store";

export type ConversationSessionStatus = "active" | "processing" | "completed";

export interface ConversationSession {
  id: string;
  model: typeof OPENROUTER_MODEL;
  reasoning: {
    effort: typeof OPENROUTER_REASONING_EFFORT;
  };
  status: ConversationSessionStatus;
  turnLimit: typeof ASSESSMENT_TURN_LIMIT;
  completedTurns: number;
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
    turnLimit: ASSESSMENT_TURN_LIMIT,
    completedTurns: 0,
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

  if (
    session.status === "completed" ||
    session.completedTurns >= session.turnLimit
  ) {
    throw new ConversationTurnLimitReachedError(sessionId);
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
    const completion = await createChatCompletion(requestMessages, signal);
    await persistOpenRouterAttempt(sessionId, completion.artifacts);

    const { exchange } = completion;
    const choice = exchange.response.choices[0];
    const assistantMessage = choice.message;

    if (
      choice.finish_reason !== "stop" ||
      assistantMessage.content.trim().length === 0
    ) {
      throw new ConversationInvalidAssistantResponseError(
        sessionId,
        choice.finish_reason,
      );
    }

    const completedTurns = session.completedTurns + 1;
    const updatedSession: ConversationSession = {
      ...session,
      status: completedTurns >= session.turnLimit ? "completed" : "active",
      completedTurns,
      messages: [...requestMessages, assistantMessage],
      updatedAt: new Date().toISOString(),
    };

    conversationSessionStore.set(sessionId, updatedSession);

    return {
      session: cloneSession(updatedSession),
      exchange,
    };
  } catch (error) {
    let errorToThrow: unknown = error;
    const artifacts = getOpenRouterAttemptArtifacts(error);

    if (artifacts) {
      try {
        await persistOpenRouterAttempt(sessionId, artifacts);
      } catch (storageError) {
        errorToThrow = storageError;
      }
    }

    conversationSessionStore.set(sessionId, {
      ...session,
      status: session.status,
      updatedAt: new Date().toISOString(),
    });

    throw errorToThrow;
  } finally {
    processingConversationSessionIds.delete(sessionId);
  }
}
