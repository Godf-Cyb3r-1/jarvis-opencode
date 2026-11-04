import { expect, test } from "bun:test"
import { derive } from "./worker-state"

test("a running worker with null or invalid outcome never causes output schema errors", () => {
  expect(derive({ scheduled: "running", active: true, outcome: null })).toEqual({ status: "running" })
  expect(derive({ scheduled: "running", active: true, outcome: "running" })).toEqual({ status: "running" })
  expect(derive({ scheduled: "running", active: true, outcome: undefined })).toEqual({ status: "running" })
})

test("terminal outcomes reflect actual OpenCode execution, not scheduler completion", () => {
  expect(derive({ scheduled: "completed", active: false, outcome: "failed" })).toEqual({ status: "failed", outcome: "failed" })
  expect(derive({ scheduled: "completed", active: false, outcome: "interrupted" })).toEqual({ status: "cancelled", outcome: "interrupted" })
  expect(derive({ scheduled: "completed", active: false, outcome: "succeeded" })).toEqual({ status: "completed", outcome: "succeeded" })
  expect(derive({ scheduled: "completed", active: false, outcome: null })).toEqual({ status: "idle" })
})
test("fifth task and follow-ups use the correct state precedence", () => {
  expect(derive({ scheduled: "queued", active: false, outcome: null })).toEqual({ status: "queued" })
  expect(derive({ scheduled: "completed", active: true, outcome: "succeeded" })).toEqual({ status: "running" })
  expect(derive({ scheduled: "cancelled", active: false, outcome: null })).toEqual({ status: "cancelled" })
  expect(derive({ scheduled: "failed", active: false, outcome: null })).toEqual({ status: "failed" })
})
