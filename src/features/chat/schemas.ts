import { z } from "zod";

const conversationContentSchema = z
  .string()
  .refine((content) => content.trim().length > 0, "Content is required.");

export const conversationMessageRequestSchema = z
  .object({
    content: conversationContentSchema,
  })
  .strict();

export const conversationChatRequestSchema = z
  .object({
    sessionId: z.uuid(),
    content: conversationContentSchema,
  })
  .strict();
