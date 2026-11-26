import "server-only";

import { ExperimentArtifactStorageError } from "./errors";
import { getDatabase } from "@/lib/database/client";
import { ensureDatabaseSchema } from "@/lib/database/schema";
import type { OpenRouterAttemptArtifacts } from "@/lib/openrouter/types";

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("The conversation session identifier is invalid.");
  }
}

export async function persistOpenRouterAttempt(
  sessionId: string,
  artifacts: OpenRouterAttemptArtifacts,
): Promise<void> {
  try {
    assertValidSessionId(sessionId);
    await ensureDatabaseSchema();
    const sql = getDatabase();
    const rows = await sql`
      INSERT INTO webgen_experiment_attempts (
        session_id,
        attempt_number,
        request_artifact,
        response_artifact
      )
      SELECT
        ${sessionId},
        COALESCE(MAX(attempt_number), 0) + 1,
        ${JSON.stringify(artifacts.request)}::jsonb,
        ${artifacts.response ? JSON.stringify(artifacts.response) : null}::jsonb
      FROM webgen_experiment_attempts
      WHERE session_id = ${sessionId}
      HAVING EXISTS (
        SELECT 1
        FROM webgen_conversation_sessions
        WHERE id = ${sessionId}
      )
      RETURNING attempt_number
    `;

    if (!rows[0]) {
      throw new Error("The conversation session does not exist.");
    }
  } catch (error) {
    if (error instanceof ExperimentArtifactStorageError) {
      throw error;
    }

    throw new ExperimentArtifactStorageError(sessionId, error);
  }
}

export async function persistConversationExport(
  sessionId: string,
  content: string,
): Promise<void> {
  try {
    assertValidSessionId(sessionId);
    await ensureDatabaseSchema();
    const sql = getDatabase();
    const insertedRows = await sql`
      INSERT INTO webgen_conversation_exports (session_id, content)
      VALUES (${sessionId}, ${content})
      ON CONFLICT (session_id) DO NOTHING
      RETURNING session_id
    `;

    if (!insertedRows[0]) {
      const existingRows = await sql`
        SELECT content
        FROM webgen_conversation_exports
        WHERE session_id = ${sessionId}
        LIMIT 1
      `;

      if (existingRows[0]?.content !== content) {
        throw new Error(
          "The existing conversation export does not match the current session.",
        );
      }
    }
  } catch (error) {
    if (error instanceof ExperimentArtifactStorageError) {
      throw error;
    }

    throw new ExperimentArtifactStorageError(sessionId, error);
  }
}
