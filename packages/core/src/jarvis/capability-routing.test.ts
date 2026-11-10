import { expect, test } from "bun:test"
import { definition } from "./agent"
import { permissions } from "./agent"
import { Permission } from "../permission"

test("Jarvis distinguishes brain restrictions from worker capabilities", () => {
  const persona = definition().system ?? ""
  expect(persona).toContain("Your direct-tool limitations are NOT evidence")
  expect(persona).toContain("capability_discover")
  expect(persona).toContain("agent_list")
  expect(persona).toContain("session_create")
  expect(persona).toContain("session_status")
  expect(persona).toContain("Only implement a reusable tool/adapter")
  expect(persona).toContain("never claim a message was sent without confirmation")
})

test("brain can delegate but direct execution remains isolated to workers", () => {
  for (const tool of ["capability_discover", "agent_list", "session_create", "session_status", "session_list", "session_send", "command_run"])
    expect(Permission.evaluate(tool, "*", permissions).effect).toBe("allow")
  for (const tool of ["bash", "write", "edit", "apply_patch"])
    expect(Permission.evaluate(tool, "*", permissions).effect).toBe("deny")
})
