/** In-memory side-channel conversation, independent of active worker transcripts.
 * Bounded to avoid replaying the entire main OpenCode session into every quick reply.
 */
export class JarvisSideHistory {
  private readonly turns = new Map<string, Array<{ user: string; assistant: string }>>()
  constructor(readonly maxTurns = 6) {
    if (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 12) throw new Error("Invalid side history limit")
  }

  prompt(sessionID: string, instructions: string, question: string): string {
    const previous = this.turns.get(sessionID) ?? []
    const context = previous.map((turn, i) =>
      "Side conversation " + (i + 1) + "\nUser: " + turn.user + "\nJarvis: " + turn.assistant,
    ).join("\n\n")
    return [
      instructions,
      context ? "Previous independent Jarvis side conversation (context only):\n" + context : "",
      "User's latest message:\n" + question,
    ].filter(Boolean).join("\n\n")
  }

  remember(sessionID: string, user: string, assistant: string): void {
    const history = this.turns.get(sessionID) ?? []
    history.push({ user: user.slice(0, 1000), assistant: assistant.slice(0, 1500) })
    if (history.length > this.maxTurns) history.splice(0, history.length - this.maxTurns)
    this.turns.set(sessionID, history)
  }

  count(sessionID: string): number { return this.turns.get(sessionID)?.length ?? 0 }
}
