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
  ) {
    super(`OpenRouter request failed with status ${upstreamStatus}.`);
    this.name = "OpenRouterApiError";
  }
}

export class OpenRouterNetworkError extends Error {
  constructor(public readonly cause: unknown) {
    super("The OpenRouter request could not be completed.");
    this.name = "OpenRouterNetworkError";
  }
}

export class OpenRouterResponseError extends Error {
  constructor(
    message: string,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "OpenRouterResponseError";
  }
}
