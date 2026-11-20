import { afterAll } from "bun:test"
import { flushC17BoundaryProfile } from "../../../../runtime/audit-c17-boundary-profile.ts"
import "./calculation-ancestry-composition.test.ts"

// The imported original owns its assertions, 105000ms deadline and 120000ms budget.
afterAll(() => { flushC17BoundaryProfile() })
