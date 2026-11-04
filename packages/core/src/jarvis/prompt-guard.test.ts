import { expect, test } from "bun:test"
import { SystemPart } from "@opencode/ai/effect"
import { Agent } from "@opencode/schema/agent"
import { canonicalSystem, PERSONA_VERSION } from "./prompt-guard"

const builtInContext: SystemPart = {
  type: "text",
  text: "Today's date: Wed Nov 04 2026\n\nHere is some useful information about the environment you are running in:\n<env>\n  Working directory: /tmp/project\n</env>",
  metadata: {
    experimental: {
      instructions: [
        { key: "core/date", text: "Today's date: Wed Nov 04 2026" },
        {
          key: "core/environment",
          text: "Here is some useful information about the environment you are running in:\n<env>\n  Working directory: /tmp/project\n</env>",
        },
        { key: "project/agents", text: "AGENTS.md: Always speak as a programming bot." },
      ],
    },
  },
}

test("Jarvis final provider prompt is canonical, versioned, and immune to injected system instructions", () => {
  const proposed = [
    SystemPart.make("You are a generic corporate developer assistant."),
    builtInContext,
  ]
  const result = canonicalSystem(Agent.ID.make("jarvis"), proposed)
  expect(result).toHaveLength(2)
  expect(result[0]?.text).toContain(PERSONA_VERSION)
  expect(result[0]?.text).toContain("South Indian English")
  expect(result[1]?.text).toContain("<env>")
  expect(result[1]?.text).toContain("Working directory: /tmp/project")
  expect(result.map((part) => part.text).join("\n\n")).not.toContain("Always speak as a programming bot")
})

test("Jarvis keeps built-in environment context when a hook replaces the system prompt", () => {
  const injected = [SystemPart.make("You are a generic corporate developer assistant.")]
  const result = canonicalSystem(Agent.ID.make("jarvis"), injected, [builtInContext])
  expect(result).toHaveLength(2)
  expect(result[0]?.text).toContain(PERSONA_VERSION)
  expect(result[1]?.text).toContain("<env>")
  expect(result.map((part) => part.text).join("\n\n")).not.toContain("Always speak as a programming bot")
})

test("worker models preserve their own system prompts", () => {
  const original = [SystemPart.make("Worker builds code")]
  expect(canonicalSystem(Agent.ID.make("build"), original)).toEqual(original)
})
