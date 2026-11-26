"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createSession,
  downloadConversation,
  listSessions,
  sendMessage,
} from "@/features/chat/browser-api";
import type { ConversationSession } from "@/features/chat/types";
import type { OpenRouterChatExchange } from "@/lib/openrouter/types";

import { ConversationMessage } from "./conversation-message";

type ExchangesBySession = Record<string, OpenRouterChatExchange[]>;

export function ExperimentWorkspace() {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [exchangesBySession, setExchangesBySession] =
    useState<ExchangesBySession>({});
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [selectedSessionId, sessions],
  );
  const selectedExchanges = selectedSessionId
    ? (exchangesBySession[selectedSessionId] ?? [])
    : [];
  const latestExchange = selectedExchanges.at(-1);
  const isComplete = selectedSession?.status === "completed";
  const currentTurn = selectedSession
    ? Math.min(selectedSession.completedTurns + 1, selectedSession.turnLimit)
    : 1;

  useEffect(() => {
    let isMounted = true;

    async function loadSessions() {
      try {
        const availableSessions = await listSessions();

        if (!isMounted) return;

        setSessions(availableSessions);
        setSelectedSessionId(availableSessions[0]?.id);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [isSubmitting, selectedSession?.messages.length]);

  async function handleCreateSession() {
    if (isCreating) return;

    setError(undefined);
    setIsCreating(true);

    try {
      const session = await createSession();
      setSessions((current) => [
        session,
        ...current.filter((item) => item.id !== session.id),
      ]);
      setSelectedSessionId(session.id);
      setPrompt("");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = prompt.trim();

    if (!selectedSession || !content || isComplete || isSubmitting) return;

    setError(undefined);
    setIsSubmitting(true);

    try {
      const result = await sendMessage(selectedSession.id, content);

      setSessions((current) =>
        current.map((session) =>
          session.id === result.session.id ? result.session : session,
        ),
      );
      setExchangesBySession((current) => ({
        ...current,
        [selectedSession.id]: [
          ...(current[selectedSession.id] ?? []),
          result.exchange,
        ],
      }));
      setPrompt("");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleExport() {
    if (!selectedSession || !isComplete || isExporting) return;

    setError(undefined);
    setIsExporting(true);

    try {
      await downloadConversation(selectedSession.id);
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-grid text-zinc-100 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <header className="shrink-0 border-b border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300 font-mono text-sm font-black text-zinc-950 shadow-[0_0_28px_rgba(103,232,249,0.18)]">
              W
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                WebGen Lab
              </p>
              <p className="truncate font-mono text-xs text-zinc-500">
                Controlled experiment workspace
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-xs text-zinc-400 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            GPT-5 · Medium reasoning
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-cols-[250px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="min-w-0 border-b border-white/10 bg-zinc-950/45 p-4 lg:h-full lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                Experiments
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {sessions.length}{" "}
                {sessions.length === 1 ? "session" : "sessions"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isCreating || isSubmitting}
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-4 lg:w-full"
            >
              {isCreating ? "Creating…" : "New experiment"}
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
            {isLoading ? (
              <p className="py-5 text-sm text-zinc-500">Loading sessions…</p>
            ) : null}
            {!isLoading && sessions.length === 0 ? (
              <p className="py-5 text-sm leading-6 text-zinc-500">
                Start a new experiment to open a controlled three-turn session.
              </p>
            ) : null}
            {sessions.map((session, index) => {
              const isSelected = session.id === selectedSessionId;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setError(undefined);
                    setPrompt("");
                  }}
                  disabled={isSubmitting}
                  className={`min-w-52 rounded-xl border p-3 text-left transition lg:w-full lg:min-w-0 ${
                    isSelected
                      ? "border-cyan-300/40 bg-cyan-300/[0.08]"
                      : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-200">
                      Experiment {sessions.length - index}
                    </span>
                    <StatusBadge status={session.status} />
                  </span>
                  <span className="mt-2 block font-mono text-xs text-zinc-500">
                    {session.completedTurns} / {session.turnLimit} turns
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-zinc-600">
                    {session.id.slice(0, 8)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[680px] min-w-0 flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-zinc-500">
                  {selectedSession
                    ? `SESSION ${selectedSession.id.slice(0, 8).toUpperCase()}`
                    : "NO ACTIVE SESSION"}
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-100">
                  Experiment conversation
                </h1>
              </div>
              {selectedSession ? (
                <div className="flex items-center gap-3">
                  <TurnProgress session={selectedSession} />
                  <StatusBadge status={selectedSession.status} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
            {!selectedSession ? (
              <EmptyConversation
                isCreating={isCreating}
                onCreate={handleCreateSession}
              />
            ) : null}

            {selectedSession?.messages.length === 0 ? (
              <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
                <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] font-mono text-lg font-semibold text-cyan-200">
                  01
                </span>
                <h2 className="text-xl font-semibold text-zinc-100">
                  Ready for the first request
                </h2>
                <p className="mt-3 max-w-md text-base leading-7 text-zinc-500">
                  Submit one prompt at a time. The next turn remains locked to
                  your review process until you deliberately send it.
                </p>
              </div>
            ) : null}

            {selectedSession?.messages.map((message, index) => (
              <ConversationMessage
                key={`${selectedSession.id}-${index}`}
                message={message}
                turn={Math.floor(index / 2) + 1}
                exchange={
                  message.role === "assistant"
                    ? selectedExchanges[Math.floor(index / 2)]
                    : undefined
                }
              />
            ))}

            {isSubmitting ? <ProcessingMessage turn={currentTurn} /> : null}
            <div ref={conversationEndRef} />
          </div>

          <div className="shrink-0 border-t border-white/10 bg-zinc-950/65 p-4 backdrop-blur-xl sm:p-6">
            {error ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm leading-6 text-red-200"
              >
                <span className="font-semibold">Request failed.</span> {error}
              </div>
            ) : null}

            {selectedSession && isComplete ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-emerald-200">
                    Experiment complete
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    All three responses are preserved and ready to export.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="shrink-0 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExporting ? "Preparing…" : "Export conversation"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <label
                    htmlFor="experiment-prompt"
                    className="text-sm font-semibold text-zinc-200"
                  >
                    {selectedSession
                      ? `Request for turn ${currentTurn}`
                      : "Experiment request"}
                  </label>
                  <p className="font-mono text-xs text-zinc-600">
                    Ctrl / ⌘ + Enter to send
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2 focus-within:border-cyan-300/40 focus-within:ring-2 focus-within:ring-cyan-300/10">
                  <textarea
                    id="experiment-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    disabled={!selectedSession || isSubmitting}
                    rows={4}
                    placeholder={
                      selectedSession
                        ? "Describe the page or change you want the model to generate…"
                        : "Create an experiment to begin…"
                    }
                    className="block w-full resize-y bg-transparent px-3 py-2 text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-2 pt-2">
                    <p className="text-xs text-zinc-500">
                      Review the response before sending the next turn.
                    </p>
                    <button
                      type="submit"
                      disabled={
                        !selectedSession ||
                        !prompt.trim() ||
                        isSubmitting ||
                        isComplete
                      }
                      className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSubmitting
                        ? "Generating…"
                        : `Send turn ${currentTurn}`}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>

        <aside className="hidden border-l border-white/10 bg-zinc-950/45 p-5 xl:block xl:h-full xl:overflow-y-auto">
          <p className="font-mono text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Inspector
          </p>
          {selectedSession ? (
            <div className="mt-5 space-y-6">
              <InspectorGroup title="Configuration">
                <InspectorRow label="Model" value={selectedSession.model} />
                <InspectorRow
                  label="Reasoning"
                  value={selectedSession.reasoning.effort}
                />
                <InspectorRow
                  label="Turn limit"
                  value={String(selectedSession.turnLimit)}
                />
              </InspectorGroup>

              <InspectorGroup title="Session">
                <InspectorRow label="ID" value={selectedSession.id} />
                <InspectorRow label="Status" value={selectedSession.status} />
                <InspectorRow
                  label="Created"
                  value={formatDate(selectedSession.createdAt)}
                />
                <InspectorRow
                  label="Updated"
                  value={formatDate(selectedSession.updatedAt)}
                />
              </InspectorGroup>

              <InspectorGroup title="Latest response">
                {latestExchange ? (
                  <>
                    <InspectorRow
                      label="Response ID"
                      value={latestExchange.response.id}
                    />
                    <InspectorRow
                      label="Returned model"
                      value={latestExchange.response.model}
                    />
                    <InspectorRow
                      label="Total tokens"
                      value={String(latestExchange.response.usage.total_tokens)}
                    />
                    <InspectorRow
                      label="Finish reason"
                      value={
                        latestExchange.response.choices[0]?.finish_reason ??
                        "unknown"
                      }
                    />
                  </>
                ) : (
                  <p className="text-sm leading-6 text-zinc-600">
                    Response metadata will appear after the first completed
                    turn.
                  </p>
                )}
              </InspectorGroup>

              <button
                type="button"
                onClick={handleExport}
                disabled={!isComplete || isExporting}
                className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting ? "Preparing…" : "Export JSON"}
              </button>
              {!isComplete ? (
                <p className="text-center text-xs leading-5 text-zinc-600">
                  Export unlocks after turn {selectedSession.turnLimit}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-zinc-600">
              Select or create an experiment to inspect its configuration.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: ConversationSession["status"] }) {
  const styles = {
    active: "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200",
    processing: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
    completed: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
  }[status];

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-xs capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

function TurnProgress({ session }: { session: ConversationSession }) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${session.completedTurns} of ${session.turnLimit} turns completed`}
    >
      {Array.from({ length: session.turnLimit }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-7 rounded-full ${
            index < session.completedTurns ? "bg-cyan-300" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function ProcessingMessage({ turn }: { turn: number }) {
  return (
    <div
      className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-amber-300/10">
          <span className="size-2 animate-pulse rounded-full bg-amber-300" />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-100">
            Generating assistant response
          </p>
          <p className="font-mono text-xs text-zinc-500">Turn {turn}</p>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="processing-bar h-full w-1/3 rounded-full bg-amber-300" />
      </div>
    </div>
  );
}

function EmptyConversation({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] font-mono text-lg text-zinc-400">
        W
      </span>
      <h2 className="text-xl font-semibold text-zinc-100">
        No experiment selected
      </h2>
      <p className="mt-3 max-w-md text-base leading-7 text-zinc-500">
        Create an isolated session with GPT-5, medium reasoning, and exactly
        three human-controlled turns.
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="mt-6 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreating ? "Creating…" : "Create experiment"}
      </button>
    </div>
  );
}

function InspectorGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-b border-white/[0.07] pb-6 last:border-0">
      <h2 className="mb-3 text-sm font-semibold text-zinc-300">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="mt-1 break-words font-mono text-xs leading-5 text-zinc-400">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error interrupted the experiment.";
}
