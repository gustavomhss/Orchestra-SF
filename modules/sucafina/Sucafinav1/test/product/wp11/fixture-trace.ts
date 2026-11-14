import { Buffer } from "node:buffer"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"

/** Hosted-test diagnostics only. The wall-clock guard preserves the original test budget. */
export function createWp11FixtureTrace(label: string, budgetMs = 180000) {
  const started = Date.now()
  const counts: Record<string, { calls: number; elapsedMs: number; maximumMs: number }> = {}
  const progress = { phase: "start", reported: false }
  const guard = () => {
    if (Date.now() - started <= budgetMs) return
    if (!progress.reported) {
      progress.reported = true
      console.error("[wp11-fixture-trace]", JSON.stringify({ label, phase: progress.phase, elapsedMs: Date.now() - started, budgetMs, status: "deadline-exceeded", counts }))
    }
    throw new Error(`WP11_FIXTURE_DEADLINE_EXCEEDED:${label}:${progress.phase}:${budgetMs}`)
  }
  const measure = async <T>(operation: string, work: () => Promise<T>): Promise<T> => {
    guard()
    const counter = counts[operation] ??= { calls: 0, elapsedMs: 0, maximumMs: 0 }
    counter.calls++
    const before = Date.now()
    try {
      const value = await work()
      guard()
      return value
    } finally {
      const elapsed = Date.now() - before
      counter.elapsedMs += elapsed
      counter.maximumMs = Math.max(counter.maximumMs, elapsed)
    }
  }
  const state = (port: SfProductStatePort): SfProductStatePort => ({
    read: (request, namespace, read) => measure(`c08.read.${namespace}`, () => port.read(request, namespace, read)),
    transaction: (request, command, work) => measure(`c08.transaction.${command.namespace}`, () => port.transaction(request, command, work)),
  })
  const checkpoint = async (phase: string, port?: SfProductStatePort, request?: Request) => {
    guard()
    progress.phase = phase
    const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value ?? {}))
    const observed = port && request ? await port.read(request, "cases", (value) => ({
      stateBytes: bytes(value), transactionsBytes: bytes(value.transactions), casesBytes: bytes(value.cases), resultBytes: bytes(value.decisionResults),
      transactions: Object.keys(value.transactions).length, cases: Object.keys(value.cases).length, results: Object.keys(value.decisionResults ?? {}).length,
    })) : undefined
    console.info("[wp11-fixture-trace]", JSON.stringify({ label, phase, elapsedMs: Date.now() - started, budgetMs, counts, ...(observed?.status === "ok" ? observed.value : observed ? { stateStatus: observed.status } : {}) }))
    guard()
  }
  return { guard, measure, state, checkpoint }
}
