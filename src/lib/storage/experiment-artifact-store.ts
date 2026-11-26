import "server-only";

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { ExperimentArtifactStorageError } from "./errors";
import type { OpenRouterAttemptArtifacts } from "@/lib/openrouter/types";

const ATTEMPT_FILE_PATTERN = /^attempt-(\d+)\.json$/;
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPERIMENTS_DIRECTORY = resolve(process.cwd(), "experiments");

function serializeMetadata(metadata: Record<string, unknown>): string {
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

async function getNextAttemptNumber(
  requestsDirectory: string,
): Promise<number> {
  const entries = await readdir(requestsDirectory, { withFileTypes: true });
  let highestAttemptNumber = 0;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = ATTEMPT_FILE_PATTERN.exec(entry.name);

    if (!match) {
      continue;
    }

    const attemptNumber = Number.parseInt(match[1], 10);

    if (attemptNumber > highestAttemptNumber) {
      highestAttemptNumber = attemptNumber;
    }
  }

  return highestAttemptNumber + 1;
}

function getSessionDirectory(sessionId: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("The conversation session identifier is invalid.");
  }

  const sessionDirectory = resolve(EXPERIMENTS_DIRECTORY, sessionId);

  if (!sessionDirectory.startsWith(`${EXPERIMENTS_DIRECTORY}${sep}`)) {
    throw new Error("The experiment directory is outside the storage root.");
  }

  return sessionDirectory;
}

export async function persistOpenRouterAttempt(
  sessionId: string,
  artifacts: OpenRouterAttemptArtifacts,
): Promise<void> {
  try {
    const sessionDirectory = getSessionDirectory(sessionId);
    const requestsDirectory = resolve(sessionDirectory, "requests");
    const responsesDirectory = resolve(sessionDirectory, "responses");

    await Promise.all([
      mkdir(requestsDirectory, { recursive: true }),
      mkdir(responsesDirectory, { recursive: true }),
    ]);

    const attemptNumber = await getNextAttemptNumber(requestsDirectory);
    const attemptName = `attempt-${String(attemptNumber).padStart(3, "0")}`;
    const requestBodyPath = resolve(requestsDirectory, `${attemptName}.json`);
    const requestMetadataPath = resolve(
      requestsDirectory,
      `${attemptName}.metadata.json`,
    );

    await writeFile(requestBodyPath, artifacts.request.body, {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(
      requestMetadataPath,
      serializeMetadata({
        attemptNumber,
        contentType: artifacts.request.contentType,
        method: artifacts.request.method,
        sentAt: artifacts.request.sentAt,
        url: artifacts.request.url,
      }),
      { encoding: "utf8", flag: "wx" },
    );

    if (!artifacts.response) {
      return;
    }

    const responseExtension = artifacts.response.isJson ? "json" : "txt";
    const responseBodyFile = `${attemptName}.${responseExtension}`;
    const responseBodyPath = resolve(responsesDirectory, responseBodyFile);
    const responseMetadataPath = resolve(
      responsesDirectory,
      `${attemptName}.metadata.json`,
    );

    await writeFile(responseBodyPath, artifacts.response.body, {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(
      responseMetadataPath,
      serializeMetadata({
        attemptNumber,
        bodyFile: responseBodyFile,
        contentType: artifacts.response.contentType,
        receivedAt: artifacts.response.receivedAt,
        status: artifacts.response.status,
      }),
      { encoding: "utf8", flag: "wx" },
    );
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
    const sessionDirectory = getSessionDirectory(sessionId);
    const conversationPath = resolve(sessionDirectory, "conversation.json");

    await mkdir(sessionDirectory, { recursive: true });

    try {
      await writeFile(conversationPath, content, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error;
      }

      const existingContent = await readFile(conversationPath, "utf8");

      if (existingContent !== content) {
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
