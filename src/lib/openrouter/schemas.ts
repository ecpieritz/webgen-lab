import { z } from "zod";

const reasoningDetailsSchema = z.array(z.record(z.string(), z.unknown()));

const userMessageSchema = z
  .object({
    role: z.literal("user"),
    content: z
      .string()
      .refine((content) => content.trim().length > 0, "Content is required."),
  })
  .strict();

const assistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: z.string(),
    reasoning: z.string().optional(),
    reasoning_content: z.string().optional(),
    reasoning_details: reasoningDetailsSchema.optional(),
  })
  .passthrough();

export const chatRouteRequestSchema = z
  .object({
    messages: z
      .array(z.union([userMessageSchema, assistantMessageSchema]))
      .min(1),
  })
  .strict();

const openRouterUsageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  })
  .passthrough();

const openRouterChoiceSchema = z
  .object({
    index: z.number().int().nonnegative(),
    finish_reason: z.string().nullable(),
    message: assistantMessageSchema,
  })
  .passthrough();

export const openRouterChatCompletionResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    object: z.literal("chat.completion"),
    created: z.number().int().nonnegative(),
    choices: z.array(openRouterChoiceSchema).min(1),
    usage: openRouterUsageSchema,
  })
  .passthrough();

export type ChatMessage =
  z.infer<typeof userMessageSchema> | z.infer<typeof assistantMessageSchema>;
export type ChatRouteRequest = z.infer<typeof chatRouteRequestSchema>;
export type OpenRouterChatCompletionResponse = z.infer<
  typeof openRouterChatCompletionResponseSchema
>;
