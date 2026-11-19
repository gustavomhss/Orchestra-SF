import type { prepareC12Change } from "../../../../../modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture"
import type { observeC12 } from "../../../../../modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/consumer"

export type C12Observation = Awaited<ReturnType<typeof observeC12>>
export type C12Prepared = Awaited<ReturnType<typeof prepareC12Change>>
export type C12Traffic = { mode: string | null; body: string; key: string | null; status: number; result: Record<string, unknown> }
export type C12Configuration = { directory: string; origin: string; installationId: string; controlKey: string }
export type C12Ready = { actorId: string; caseRef: string; cookie: string; prepared: C12Prepared }
export type C12Control = { observation: C12Observation; traffic: C12Traffic[]; receiptCommits: { beforeCases: number; afterCases: number }[] }
