export class ConversationSessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Conversation session ${sessionId} was not found.`);
    this.name = "ConversationSessionNotFoundError";
  }
}

export class ConversationSessionBusyError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Conversation session ${sessionId} is already processing a message.`);
    this.name = "ConversationSessionBusyError";
  }
}

export class ConversationTurnLimitReachedError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Conversation session ${sessionId} has reached its turn limit.`);
    this.name = "ConversationTurnLimitReachedError";
  }
}

export class ConversationInvalidAssistantResponseError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly finishReason: string | null,
  ) {
    super(`Conversation session ${sessionId} received an incomplete response.`);
    this.name = "ConversationInvalidAssistantResponseError";
  }
}

export class ConversationExportNotReadyError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Conversation session ${sessionId} is not ready for export.`);
    this.name = "ConversationExportNotReadyError";
  }
}

export class ConversationIntegrityError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Conversation session ${sessionId} has an invalid message history.`);
    this.name = "ConversationIntegrityError";
  }
}
