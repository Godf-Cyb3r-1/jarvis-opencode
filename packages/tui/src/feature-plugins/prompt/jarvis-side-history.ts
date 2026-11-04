/** In-memory side-channel conversation, independent of active worker transcripts.
 * Bounded to avoid replaying the entire main OpenCode session into every quick reply.
 */
export const JARVIS_SIDE_PERSONA_VERSION = "JARVIS_SIDE_PERSONA_20261104"

/** Never replay presentation timestamps, unsupported stage directions or stale
 * corporate filler as examples for the next language-model turn. The original
 * UI messages remain untouched; this only sanitizes the side-context copy.
 */
export function cleanSideContext(text: string): string {
  return text
    .replace(/(^|\n)\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/gi, "$1")
    .replace(/ *\u2014 */g, ", ")
    .replace(/sharp and ready(?: to help)?/gi, "doing well")
    .replace(/take something off your plate/gi, "help out")
    .trim()
}

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
      JARVIS_SIDE_PERSONA_VERSION,
      instructions,
      context ? "Previous independent Jarvis side conversation (context only):\n" + context : "",
      "User's latest message:\n" + question,
    ].filter(Boolean).join("\n\n")
  }

  remember(sessionID: string, user: string, assistant: string): void {
    const history = this.turns.get(sessionID) ?? []
    history.push({ user: cleanSideContext(user).slice(0, 1000), assistant: cleanSideContext(assistant).slice(0, 1500) })
    if (history.length > this.maxTurns) history.splice(0, history.length - this.maxTurns)
    this.turns.set(sessionID, history)
  }

  count(sessionID: string): number { return this.turns.get(sessionID)?.length ?? 0 }
}
