import "server-only";

import { z } from "zod";

import { OPENROUTER_MODEL, OPENROUTER_REASONING_EFFORT } from "./constants";
import { OpenRouterConfigurationError } from "./errors";

const openRouterEnvironmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.literal(OPENROUTER_MODEL).default(OPENROUTER_MODEL),
  OPENROUTER_REASONING_EFFORT: z
    .literal(OPENROUTER_REASONING_EFFORT)
    .default(OPENROUTER_REASONING_EFFORT),
});

export interface OpenRouterConfiguration {
  apiKey: string;
  model: typeof OPENROUTER_MODEL;
  reasoningEffort: typeof OPENROUTER_REASONING_EFFORT;
}

export function getOpenRouterConfiguration(): OpenRouterConfiguration {
  const result = openRouterEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new OpenRouterConfigurationError(
      "OpenRouter server environment variables are missing or invalid.",
    );
  }

  return {
    apiKey: result.data.OPENROUTER_API_KEY,
    model: result.data.OPENROUTER_MODEL,
    reasoningEffort: result.data.OPENROUTER_REASONING_EFFORT,
  };
}
