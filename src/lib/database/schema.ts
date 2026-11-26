import "server-only";

import { getDatabase } from "./client";

interface DatabaseSchemaGlobalState {
  webgenDatabaseSchemaPromise?: Promise<void>;
}

const globalState = globalThis as typeof globalThis & DatabaseSchemaGlobalState;

export function ensureDatabaseSchema(): Promise<void> {
  if (!globalState.webgenDatabaseSchemaPromise) {
    globalState.webgenDatabaseSchemaPromise = initializeDatabaseSchema().catch(
      (error: unknown) => {
        globalState.webgenDatabaseSchemaPromise = undefined;
        throw error;
      },
    );
  }

  return globalState.webgenDatabaseSchemaPromise;
}

async function initializeDatabaseSchema(): Promise<void> {
  const sql = getDatabase();

  await sql.transaction([
    sql`
      CREATE TABLE IF NOT EXISTS webgen_conversation_sessions (
        id UUID PRIMARY KEY,
        model TEXT NOT NULL,
        reasoning_effort TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'processing', 'completed')),
        turn_limit SMALLINT NOT NULL CHECK (turn_limit > 0),
        completed_turns SMALLINT NOT NULL DEFAULT 0 CHECK (completed_turns >= 0),
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
    sql`
      CREATE INDEX IF NOT EXISTS webgen_conversation_sessions_created_at_idx
      ON webgen_conversation_sessions (created_at DESC)
    `,
    sql`
      CREATE TABLE IF NOT EXISTS webgen_experiment_attempts (
        session_id UUID NOT NULL REFERENCES webgen_conversation_sessions(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
        request_artifact JSONB NOT NULL,
        response_artifact JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (session_id, attempt_number)
      )
    `,
    sql`
      CREATE TABLE IF NOT EXISTS webgen_conversation_exports (
        session_id UUID PRIMARY KEY REFERENCES webgen_conversation_sessions(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  ]);
}
