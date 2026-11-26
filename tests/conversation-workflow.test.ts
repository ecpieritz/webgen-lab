import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as exportConversationRoute } from "@/app/api/sessions/[sessionId]/export/route";
import { exportConversation } from "@/features/chat/conversation-export-service";
import {
  createConversationSession,
  sendConversationMessage,
} from "@/features/chat/conversation-session-service";
import {
  ConversationExportNotReadyError,
  ConversationTurnLimitReachedError,
} from "@/features/chat/errors";
import type { ConversationSession } from "@/features/chat/types";
import { createChatCompletion } from "@/lib/openrouter/client";
import type { ChatMessage } from "@/lib/openrouter/schemas";
import type { OpenRouterChatCompletionResult } from "@/lib/openrouter/types";
import {
  persistConversationExport,
  persistOpenRouterAttempt,
} from "@/lib/storage/experiment-artifact-store";

const inMemorySessions = vi.hoisted(
  () => new Map<string, ConversationSession>(),
);

vi.mock("@/features/chat/conversation-session-store", () => ({
  insertConversationSession: vi.fn(async (session: ConversationSession) => {
    inMemorySessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }),
  findConversationSession: vi.fn(async (sessionId: string) => {
    const session = inMemorySessions.get(sessionId);
    return session ? structuredClone(session) : undefined;
  }),
  findConversationSessions: vi.fn(async () =>
    Array.from(inMemorySessions.values(), (session) =>
      structuredClone(session),
    ),
  ),
  acquireConversationSession: vi.fn(async (sessionId: string) => {
    const session = inMemorySessions.get(sessionId);

    if (!session || session.status !== "active") return undefined;

    const processingSession: ConversationSession = {
      ...session,
      status: "processing",
    };
    inMemorySessions.set(sessionId, processingSession);
    return structuredClone(processingSession);
  }),
  completeConversationTurn: vi.fn(async (session: ConversationSession) => {
    inMemorySessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }),
  releaseConversationSession: vi.fn(async (sessionId: string) => {
    const session = inMemorySessions.get(sessionId);

    if (session?.status === "processing") {
      inMemorySessions.set(sessionId, { ...session, status: "active" });
    }
  }),
}));

vi.mock("@/lib/openrouter/client", () => ({
  createChatCompletion: vi.fn(),
}));

vi.mock("@/lib/storage/experiment-artifact-store", () => ({
  persistConversationExport: vi.fn(),
  persistOpenRouterAttempt: vi.fn(),
}));

const createChatCompletionMock = vi.mocked(createChatCompletion);
const persistConversationExportMock = vi.mocked(persistConversationExport);
const persistOpenRouterAttemptMock = vi.mocked(persistOpenRouterAttempt);

describe("conversation and export workflows", () => {
  beforeEach(() => {
    inMemorySessions.clear();
    createChatCompletionMock.mockReset();
    persistConversationExportMock.mockReset();
    persistOpenRouterAttemptMock.mockReset();
    persistConversationExportMock.mockResolvedValue();
    persistOpenRouterAttemptMock.mockResolvedValue();
  });

  it("completes exactly three controlled turns and rejects a fourth", async () => {
    const session = await createConversationSession();
    const requests = [
      "Build the initial landing page.",
      "Improve the responsive navigation.",
      "Polish the final visual details.",
    ];

    requests.forEach((_, index) => {
      createChatCompletionMock.mockResolvedValueOnce(
        createCompletion(index + 1),
      );
    });

    for (const [index, request] of requests.entries()) {
      const result = await sendConversationMessage(session.id, request);

      expect(result.session.completedTurns).toBe(index + 1);
      expect(result.session.messages).toHaveLength((index + 1) * 2);
      expect(result.session.status).toBe(index === 2 ? "completed" : "active");
      expect(result.exchange.response.choices[0].message.content).toBe(
        `Assistant response ${index + 1}`,
      );
    }

    expect(createChatCompletionMock).toHaveBeenCalledTimes(3);
    expect(persistOpenRouterAttemptMock).toHaveBeenCalledTimes(3);
    expect(getRequestMessages(1)).toHaveLength(1);
    expect(getRequestMessages(2)).toHaveLength(3);
    expect(getRequestMessages(3)).toHaveLength(5);
    expect(getRequestMessages(3).map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);

    await expect(
      sendConversationMessage(session.id, "Try an unauthorized fourth turn."),
    ).rejects.toBeInstanceOf(ConversationTurnLimitReachedError);
    expect(createChatCompletionMock).toHaveBeenCalledTimes(3);
  });

  it("keeps export locked until all three turns are complete", async () => {
    const session = await createConversationSession();

    await expect(exportConversation(session.id)).rejects.toBeInstanceOf(
      ConversationExportNotReadyError,
    );

    const response = await exportConversationRoute(new Request("http://test"), {
      params: Promise.resolve({ sessionId: session.id }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SESSION_NOT_COMPLETED",
        message: "The conversation session is not ready for export.",
      },
    });
    expect(persistConversationExportMock).not.toHaveBeenCalled();
  });

  it("exports the completed conversation with the required schema and headers", async () => {
    const { messages, sessionId } = await completeConversation();

    const response = await exportConversationRoute(new Request("http://test"), {
      params: Promise.resolve({ sessionId }),
    });
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="conversation.json"',
    );
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(JSON.parse(content)).toEqual({
      model: "openai/gpt-5",
      reasoning: { effort: "medium" },
      messages,
    });
    expect(content.endsWith("\n")).toBe(true);
    expect(persistConversationExportMock).toHaveBeenCalledOnce();
    expect(persistConversationExportMock).toHaveBeenCalledWith(
      sessionId,
      content,
    );
  });
});

function getRequestMessages(callNumber: number): ChatMessage[] {
  const call = createChatCompletionMock.mock.calls[callNumber - 1];

  if (!call) {
    throw new Error(`Missing OpenRouter call ${callNumber}.`);
  }

  return call[0];
}

async function completeConversation(): Promise<{
  messages: ChatMessage[];
  sessionId: string;
}> {
  const session = await createConversationSession();

  for (let turn = 1; turn <= session.turnLimit; turn += 1) {
    createChatCompletionMock.mockResolvedValueOnce(createCompletion(turn));
    await sendConversationMessage(session.id, `User request ${turn}`);
  }

  const finalMessages = getRequestMessages(3).concat({
    role: "assistant",
    content: "Assistant response 3",
    reasoning_details: [{ type: "summary", text: "Reasoning 3" }],
  });

  return {
    messages: finalMessages,
    sessionId: session.id,
  };
}

function createCompletion(turn: number): OpenRouterChatCompletionResult {
  const assistantMessage = {
    role: "assistant" as const,
    content: `Assistant response ${turn}`,
    reasoning_details: [{ type: "summary", text: `Reasoning ${turn}` }],
  };
  const response = {
    id: `generation-${turn}`,
    model: "openai/gpt-5",
    object: "chat.completion" as const,
    created: 1_700_000_000 + turn,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: assistantMessage,
      },
    ],
    usage: {
      prompt_tokens: turn * 10,
      completion_tokens: turn * 20,
      total_tokens: turn * 30,
    },
  };

  return {
    artifacts: {
      request: {
        body: JSON.stringify({ turn }),
        contentType: "application/json",
        method: "POST",
        sentAt: `2026-01-01T00:00:0${turn}.000Z`,
        url: "https://openrouter.ai/api/v1/chat/completions",
      },
      response: {
        body: JSON.stringify(response),
        contentType: "application/json",
        isJson: true,
        receivedAt: `2026-01-01T00:00:0${turn}.500Z`,
        status: 200,
      },
    },
    exchange: {
      request: {
        model: "openai/gpt-5",
        messages: [],
        reasoning: { effort: "medium" },
        stream: false,
      },
      response,
    },
  };
}
