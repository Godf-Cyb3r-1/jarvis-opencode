import { expect, test } from "bun:test"
import { Session } from "@opencode/schema/session"
import { Permission } from "../permission"
import * as JarvisAgent from "./agent"
import { isWorkerOf, MaxActiveWorkers, Plugin, recoverableQueuedInstruction } from "./control-tools"

test("Jarvis has native control, shell and editing tools", () => {
  const rules = JarvisAgent.definition().permissions
  for (const name of ["agent_list", "model_list", "session_create", "session_status", "session_list", "session_send", "session_interrupt", "session_peek", "session_switch_agent", "session_switch_model", "session_compact", "command_run"])
    expect(Permission.evaluate(name, "*", rules).effect).toBe("allow")
  for (const name of ["bash", "write", "edit", "apply_patch", "execute"])
    expect(Permission.evaluate(name, "*", rules).effect).toBe("ask")
  expect(Plugin.id).toBe("opencode.jarvis.control")
  expect(MaxActiveWorkers).toBeGreaterThanOrEqual(1)
  expect(MaxActiveWorkers).toBeLessThanOrEqual(16)
})
test("worker ownership must match the parent session and worker role", () => {
  const parentID = Session.ID.create()
  const other = Session.ID.create()
  const minimal = { parentID, metadata: { jarvis: { role: "worker" } } }
  expect(isWorkerOf(minimal as unknown as Session.Info, parentID)).toBe(true)
  expect(isWorkerOf(minimal as unknown as Session.Info, other)).toBe(false)
  expect(isWorkerOf({ ...minimal, metadata: { jarvis: { role: "brain" } } } as unknown as Session.Info, parentID)).toBe(false)
})

test("only unstarted persisted queued workers are recoverable", () => {
  const queued = {
    metadata: { jarvis: { role: "worker", queue: { status: "queued", instruction: "Build the project" } } },
    time: {},
    outcome: undefined,
  } as unknown as Session.Info
  expect(recoverableQueuedInstruction(queued)).toBe("Build the project")
  expect(recoverableQueuedInstruction({ ...queued, time: { busy: new Date() } } as unknown as Session.Info)).toBeUndefined()
  expect(recoverableQueuedInstruction({ ...queued, outcome: "succeeded" } as unknown as Session.Info)).toBeUndefined()
  expect(recoverableQueuedInstruction({
    ...queued, metadata: { jarvis: { role: "worker", queue: { status: "running", instruction: "Build the project" } } },
  } as unknown as Session.Info)).toBeUndefined()
  expect(recoverableQueuedInstruction({ ...queued, metadata: { jarvis: { role: "brain" } } } as unknown as Session.Info)).toBeUndefined()
})
