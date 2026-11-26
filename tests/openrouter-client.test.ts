import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChatCompletion } from "@/lib/openrouter/client";
import { OpenRouterConfigurationError } from "@/lib/openrouter/errors";
import type { OpenRouterChatCompletionResponse } from "@/lib/openrouter/schemas";

const TEST_API_KEY = "test-openrouter-key";

describe("OpenRouter chat completion client", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", TEST_API_KEY);
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-5");
    vi.stubEnv("OPENROUTER_REASONING_EFFORT", "medium");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the exact model, reasoning configuration, and message history", async () => {
    const upstreamResponse = createUpstreamResponse();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(upstreamResponse, {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const messages = [
      { role: "user" as const, content: "Create the initial website." },
      {
        role: "assistant" as const,
        content: "Initial implementation.",
        reasoning_details: [{ type: "summary", text: "Initial reasoning" }],
      },
      { role: "user" as const, content: "Improve the same website." },
    ];

    vi.stubGlobal("fetch", fetchMock);

    const result = await createChatCompletion(messages);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    const requestBody = String(init?.body);

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Metadata": "enabled",
        "X-OpenRouter-Title": "WebGen Lab",
      },
    });
    expect(JSON.parse(requestBody)).toEqual({
      model: "openai/gpt-5",
      messages,
      reasoning: { effort: "medium" },
      stream: false,
    });
    expect(requestBody).not.toContain(TEST_API_KEY);
    expect(result.exchange.request.messages).toEqual(messages);
    expect(result.exchange.response).toEqual(upstreamResponse);
    expect(result.artifacts.request.body).toBe(requestBody);
  });

  it("rejects missing credentials before attempting a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createChatCompletion([{ role: "user", content: "Test request" }]),
    ).rejects.toBeInstanceOf(OpenRouterConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createUpstreamResponse(): OpenRouterChatCompletionResponse {
  return {
    id: "generation-test",
    model: "openai/gpt-5",
    object: "chat.completion",
    created: 1_700_000_000,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: "Improved implementation.",
          reasoning_details: [
            { type: "summary", text: "Improvement reasoning" },
          ],
        },
      },
    ],
    usage: {
      prompt_tokens: 30,
      completion_tokens: 20,
      total_tokens: 50,
    },
  };
}
