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
