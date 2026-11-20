import { afterAll } from "bun:test"
import { flushAuthorityCopyProfile } from "../../../../runtime/audit-authority-copy-profile.ts"
import "./calculation-ancestry-composition.test.ts"

// The imported original owns its assertions, 105000ms deadline and 120000ms budget.
afterAll(() => { flushAuthorityCopyProfile() })
