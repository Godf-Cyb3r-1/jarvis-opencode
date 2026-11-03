import { expect, test } from "bun:test"
import { Session } from "@opencode/schema/session"
import { Agent } from "@opencode/schema/agent"
import { Permission } from "../permission"
import * as JarvisAgent from "./agent"
import { isWorkerOf, MaxActiveWorkers, Plugin } from "./control-tools"

test("Jarvis has explicit native control tools but cannot edit or run a shell", () => {
  const rules = JarvisAgent.definition().permissions
  for (const name of ["session_create", "session_status", "session_send", "session_interrupt"])
    expect(Permission.evaluate(name, "*", rules).effect).toBe("allow")
  for (const name of ["bash", "write", "edit", "apply_patch", "execute"])
    expect(Permission.evaluate(name, "*", rules).effect).toBe("deny")
  expect(Plugin.id).toBe("opencode.jarvis.control")
  expect(MaxActiveWorkers).toBe(4)
})
test("worker ownership must match the parent session and worker role", () => {
  const parentID = Session.ID.create()
  const other = Session.ID.create()
  const minimal = { parentID, metadata: { jarvis: { role: "worker" } } }
  expect(isWorkerOf(minimal as unknown as Session.Info, parentID)).toBe(true)
  expect(isWorkerOf(minimal as unknown as Session.Info, other)).toBe(false)
  expect(isWorkerOf({ ...minimal, metadata: { jarvis: { role: "brain" } } } as unknown as Session.Info, parentID)).toBe(false)
})
