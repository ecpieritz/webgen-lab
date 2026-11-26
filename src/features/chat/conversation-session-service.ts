import "server-only";

import { randomUUID } from "node:crypto";

import { ASSESSMENT_TURN_LIMIT } from "./constants";
import {
  acquireConversationSession,
  completeConversationTurn,
  findConversationSession,
  findConversationSessions,
  insertConversationSession,
  releaseConversationSession,
} from "./conversation-session-store";
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
import { persistOpenRouterAttempt } from "@/lib/storage/experiment-artifact-store";
import type { ConversationMessageResult, ConversationSession } from "./types";

export type {
  ConversationMessageResult,
  ConversationSession,
  ConversationSessionStatus,
} from "./types";

export async function createConversationSession(): Promise<ConversationSession> {
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

  return insertConversationSession(session);
}

export async function getConversationSession(
  sessionId: string,
): Promise<ConversationSession | undefined> {
  return findConversationSession(sessionId);
}

export async function listConversationSessions(): Promise<
  ConversationSession[]
> {
  return findConversationSessions();
}

export async function sendConversationMessage(
  sessionId: string,
  content: string,
  signal?: AbortSignal,
): Promise<ConversationMessageResult> {
  const session = await acquireConversationSession(sessionId);

  if (!session) {
    const currentSession = await findConversationSession(sessionId);

    if (!currentSession) {
      throw new ConversationSessionNotFoundError(sessionId);
    }

    if (currentSession.status === "processing") {
      throw new ConversationSessionBusyError(sessionId);
    }

    throw new ConversationTurnLimitReachedError(sessionId);
  }

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
    const nextSession: ConversationSession = {
      ...session,
      status: completedTurns >= session.turnLimit ? "completed" : "active",
      completedTurns,
      messages: [...requestMessages, assistantMessage],
      updatedAt: new Date().toISOString(),
    };
    const updatedSession = await completeConversationTurn(nextSession);

    return {
      session: updatedSession,
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

    try {
      await releaseConversationSession(sessionId);
    } catch (releaseError) {
      errorToThrow = releaseError;
    }

    throw errorToThrow;
  }
}
