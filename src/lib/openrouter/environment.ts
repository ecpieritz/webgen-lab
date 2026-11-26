import "server-only";

import { z } from "zod";

import { OpenRouterConfigurationError } from "./errors";

const openRouterEnvironmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.literal("openai/gpt-5").default("openai/gpt-5"),
  OPENROUTER_REASONING_EFFORT: z.literal("medium").default("medium"),
});

export interface OpenRouterConfiguration {
  apiKey: string;
  model: "openai/gpt-5";
  reasoningEffort: "medium";
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
