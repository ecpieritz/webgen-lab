export class ExperimentArtifactStorageError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly cause: unknown,
  ) {
    super(`Could not persist artifacts for conversation session ${sessionId}.`);
    this.name = "ExperimentArtifactStorageError";
  }
}
