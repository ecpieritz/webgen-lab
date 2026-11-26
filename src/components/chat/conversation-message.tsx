import type { ChatMessage } from "@/lib/openrouter/schemas";
import type { OpenRouterChatExchange } from "@/lib/openrouter/types";

interface ConversationMessageProps {
  exchange?: OpenRouterChatExchange;
  message: ChatMessage;
  turn: number;
}

export function ConversationMessage({
  exchange,
  message,
  turn,
}: ConversationMessageProps) {
  const isUser = message.role === "user";
  const choice = exchange?.response.choices[0];
  const reasoningDetails =
    message.role === "assistant" ? message.reasoning_details : undefined;

  return (
    <article
      className={`rounded-2xl border p-5 sm:p-6 ${
        isUser
          ? "border-cyan-400/20 bg-cyan-400/[0.06]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-8 items-center justify-center rounded-lg font-mono text-sm font-semibold ${
              isUser ? "bg-cyan-300 text-zinc-950" : "bg-white/10 text-zinc-100"
            }`}
            aria-hidden="true"
          >
            {isUser ? "U" : "A"}
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {isUser ? "User request" : "Assistant response"}
            </p>
            <p className="font-mono text-xs text-zinc-500">Turn {turn}</p>
          </div>
        </div>

        {!isUser && choice ? (
          <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-zinc-400">
            {choice.finish_reason ?? "unknown finish"}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-7 text-zinc-200">
        {message.content}
      </div>

      {!isUser && (reasoningDetails || exchange) ? (
        <details className="mt-5 border-t border-white/10 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200">
            Response metadata
          </summary>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {exchange ? (
              <>
                <MetadataItem
                  label="Response ID"
                  value={exchange.response.id}
                />
                <MetadataItem
                  label="Returned model"
                  value={exchange.response.model}
                />
                <MetadataItem
                  label="Prompt tokens"
                  value={String(exchange.response.usage.prompt_tokens)}
                />
                <MetadataItem
                  label="Completion tokens"
                  value={String(exchange.response.usage.completion_tokens)}
                />
                <MetadataItem
                  label="Total tokens"
                  value={String(exchange.response.usage.total_tokens)}
                />
                <MetadataItem
                  label="Finish reason"
                  value={choice?.finish_reason ?? "Unknown"}
                />
              </>
            ) : null}
          </div>

          {reasoningDetails ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Reasoning details
              </p>
              <pre className="max-h-64 overflow-auto rounded-xl bg-black/30 p-4 text-xs leading-6 text-zinc-400">
                {JSON.stringify(reasoningDetails, null, 2)}
              </pre>
            </div>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className="mt-1 truncate font-mono text-xs text-zinc-300"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
