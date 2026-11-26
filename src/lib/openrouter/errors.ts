import type { OpenRouterAttemptArtifacts } from "./types";

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigurationError";
  }
}

export class OpenRouterApiError extends Error {
  constructor(
    public readonly upstreamStatus: number,
    public readonly payload: unknown,
    public readonly artifacts: OpenRouterAttemptArtifacts,
  ) {
    super(`OpenRouter request failed with status ${upstreamStatus}.`);
    this.name = "OpenRouterApiError";
  }
}

export class OpenRouterNetworkError extends Error {
  constructor(
    public readonly cause: unknown,
    public readonly artifacts: OpenRouterAttemptArtifacts,
  ) {
    super("The OpenRouter request could not be completed.");
    this.name = "OpenRouterNetworkError";
  }
}

export class OpenRouterResponseError extends Error {
  constructor(
    message: string,
    public readonly payload: unknown,
    public readonly artifacts: OpenRouterAttemptArtifacts,
  ) {
    super(message);
    this.name = "OpenRouterResponseError";
  }
}

export function getOpenRouterAttemptArtifacts(
  error: unknown,
): OpenRouterAttemptArtifacts | undefined {
  if (
    error instanceof OpenRouterApiError ||
    error instanceof OpenRouterNetworkError ||
    error instanceof OpenRouterResponseError
  ) {
    return error.artifacts;
  }

  return undefined;
}
