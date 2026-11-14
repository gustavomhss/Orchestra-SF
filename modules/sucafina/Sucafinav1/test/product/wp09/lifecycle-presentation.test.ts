import { expect, test } from "bun:test"
import { presentRoutineLifecycle } from "../../../product/routines/lifecycle.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"

const run: RoutineResult = { documentId: "recipe", publishedVersion: "v1", principalRef: "actor", projectId: "project",
  admission: "admitted", admissionRef: "admission", admissionVersion: 1, runRef: "native-child", resultRef: "result",
  correlationId: "correlation", sourceRefs: [], pending: [] }

test("native start and result link are insufficient to announce completion", () => {
  expect(presentRoutineLifecycle({ run, execution: "running", outputAuthorized: false }).state).toBe("preparing")
  expect(presentRoutineLifecycle({ run, execution: "unknown", outputAuthorized: true }).state).toBe("blocked")
  expect(presentRoutineLifecycle({ run, execution: "completed", outputAuthorized: false }).state).toBe("blocked")
  expect(presentRoutineLifecycle({ run, execution: "completed", outputAuthorized: true }).nextAction).toBe("open-result")
  expect(presentRoutineLifecycle({ run, execution: "failed", outputAuthorized: true }).state).toBe("failed")
  expect(presentRoutineLifecycle({ run, execution: "cancelled", outputAuthorized: true }).state).toBe("cancelled")
  expect(presentRoutineLifecycle({ run: { ...run, admission: "needs-review" }, execution: "not-started", outputAuthorized: false }).state).toBe("admission-pending")
})
