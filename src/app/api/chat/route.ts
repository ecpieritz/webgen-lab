import {
  apiErrorResponse,
  createOpenRouterErrorResponse,
} from "@/lib/http/api-error-response";
import { createChatCompletion } from "@/lib/openrouter/client";
import { chatRouteRequestSchema } from "@/lib/openrouter/schemas";

export async function POST(request: Request): Promise<Response> {
  let requestPayload: unknown;

  try {
    requestPayload = await request.json();
  } catch {
    return apiErrorResponse(400, {
      code: "INVALID_JSON",
      message: "The request body must contain valid JSON.",
    });
  }

  const parsedRequest = chatRouteRequestSchema.safeParse(requestPayload);

  if (!parsedRequest.success) {
    return apiErrorResponse(400, {
      code: "INVALID_REQUEST",
      message: "The chat completion request is invalid.",
      issues: parsedRequest.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const exchange = await createChatCompletion(
      parsedRequest.data.messages,
      request.signal,
    );

    return Response.json(exchange);
  } catch (error) {
    const openRouterErrorResponse = createOpenRouterErrorResponse(error);

    if (openRouterErrorResponse) {
      return openRouterErrorResponse;
    }

    return apiErrorResponse(500, {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    });
  }
}
