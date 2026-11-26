import "server-only";

import { z } from "zod";

import { ASSESSMENT_TURN_LIMIT } from "./constants";
import type { ConversationSession } from "./types";
import {
  OPENROUTER_MODEL,
  OPENROUTER_REASONING_EFFORT,
} from "@/lib/openrouter/constants";
import { chatMessageSchema } from "@/lib/openrouter/schemas";
import { getDatabase } from "@/lib/database/client";
import { ensureDatabaseSchema } from "@/lib/database/schema";

const databaseSessionRowSchema = z.object({
  id: z.string().uuid(),
  model: z.literal(OPENROUTER_MODEL),
  reasoning_effort: z.literal(OPENROUTER_REASONING_EFFORT),
  status: z.enum(["active", "processing", "completed"]),
  turn_limit: z.literal(ASSESSMENT_TURN_LIMIT),
  completed_turns: z.number().int().min(0).max(ASSESSMENT_TURN_LIMIT),
  messages: z.array(chatMessageSchema),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export async function insertConversationSession(
  session: ConversationSession,
): Promise<ConversationSession> {
  await ensureDatabaseSchema();
  const sql = getDatabase();
  const rows = await sql`
    INSERT INTO webgen_conversation_sessions (
      id,
      model,
      reasoning_effort,
      status,
      turn_limit,
      completed_turns,
      messages,
      created_at,
      updated_at
    ) VALUES (
      ${session.id},
      ${session.model},
      ${session.reasoning.effort},
      ${session.status},
      ${session.turnLimit},
      ${session.completedTurns},
      ${JSON.stringify(session.messages)}::jsonb,
      ${session.createdAt},
      ${session.updatedAt}
    )
    RETURNING *
  `;

  return parseSessionRow(rows[0]);
}

export async function findConversationSession(
  sessionId: string,
): Promise<ConversationSession | undefined> {
  await ensureDatabaseSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT *
    FROM webgen_conversation_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  return rows[0] ? parseSessionRow(rows[0]) : undefined;
}

export async function findConversationSessions(): Promise<
  ConversationSession[]
> {
  await ensureDatabaseSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT *
    FROM webgen_conversation_sessions
    ORDER BY created_at DESC
  `;

  return rows.map(parseSessionRow);
}

export async function acquireConversationSession(
  sessionId: string,
): Promise<ConversationSession | undefined> {
  await ensureDatabaseSchema();
  const sql = getDatabase();
  const timestamp = new Date().toISOString();
  const rows = await sql`
    UPDATE webgen_conversation_sessions
    SET
      status = 'processing',
      updated_at = ${timestamp}
    WHERE id = ${sessionId}
      AND status = 'active'
      AND completed_turns < turn_limit
    RETURNING *
  `;

  return rows[0] ? parseSessionRow(rows[0]) : undefined;
}

export async function completeConversationTurn(
  session: ConversationSession,
): Promise<ConversationSession> {
  await ensureDatabaseSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE webgen_conversation_sessions
    SET
      status = ${session.status},
      completed_turns = ${session.completedTurns},
      messages = ${JSON.stringify(session.messages)}::jsonb,
      updated_at = ${session.updatedAt}
    WHERE id = ${session.id}
      AND status = 'processing'
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error(
      "The processing conversation session could not be updated.",
    );
  }

  return parseSessionRow(rows[0]);
}

export async function releaseConversationSession(
  sessionId: string,
): Promise<void> {
  await ensureDatabaseSchema();
  const sql = getDatabase();

  await sql`
    UPDATE webgen_conversation_sessions
    SET
      status = 'active',
      updated_at = ${new Date().toISOString()}
    WHERE id = ${sessionId}
      AND status = 'processing'
  `;
}

function parseSessionRow(row: unknown): ConversationSession {
  const parsedRow = databaseSessionRowSchema.parse(row);

  return {
    id: parsedRow.id,
    model: parsedRow.model,
    reasoning: {
      effort: parsedRow.reasoning_effort,
    },
    status: parsedRow.status,
    turnLimit: parsedRow.turn_limit,
    completedTurns: parsedRow.completed_turns,
    messages: parsedRow.messages,
    createdAt: parsedRow.created_at.toISOString(),
    updatedAt: parsedRow.updated_at.toISOString(),
  };
}
