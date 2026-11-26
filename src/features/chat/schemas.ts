import { z } from "zod";

export const conversationMessageRequestSchema = z
  .object({
    content: z
      .string()
      .refine((content) => content.trim().length > 0, "Content is required."),
  })
  .strict();
