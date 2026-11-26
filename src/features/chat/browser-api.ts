import type { ConversationMessageResult, ConversationSession } from "./types";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    issues?: Array<{
      message?: string;
      path?: string;
    }>;
  };
}

export class BrowserApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new BrowserApiError(
      "The server returned an unreadable response.",
      response.status,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiError(payload: unknown, status: number): BrowserApiError {
  const errorPayload: ApiErrorPayload = isRecord(payload)
    ? (payload as ApiErrorPayload)
    : {};
  const issue = errorPayload.error?.issues?.[0];
  const issuePrefix = issue?.path ? `${issue.path}: ` : "";
  const message =
    errorPayload.error?.message ?? `The request failed with status ${status}.`;
  const detail = issue?.message ? ` ${issuePrefix}${issue.message}` : "";

  return new BrowserApiError(
    `${message}${detail}`,
    status,
    errorPayload.error?.code,
  );
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw getApiError(payload, response.status);
  }

  if (!isRecord(payload)) {
    throw new BrowserApiError("The server returned invalid data.", 502);
  }

  return payload as T;
}

export async function listSessions(): Promise<ConversationSession[]> {
  const payload = await requestJson<{ sessions: ConversationSession[] }>(
    "/api/sessions",
  );

  return payload.sessions;
}

export async function createSession(): Promise<ConversationSession> {
  const payload = await requestJson<{ session: ConversationSession }>(
    "/api/sessions",
    { method: "POST" },
  );

  return payload.session;
}

export async function sendMessage(
  sessionId: string,
  content: string,
): Promise<ConversationMessageResult> {
  return requestJson<ConversationMessageResult>("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, content }),
  });
}

export async function downloadConversation(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}/export`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw getApiError(payload, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "conversation.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
