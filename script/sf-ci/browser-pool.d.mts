export type PoolFile = { path: string; blob: string; sha256: string }
export type PoolInventory = {
  schemaVersion: number
  manifest: PoolFile
  entry: PoolFile
  sources: PoolFile[]
  support: PoolFile[]
  sha256: string
}
export type PoolExecution = {
  command: string[]
  cwd: string
  execPath: string
  platform: string
  pid: number
  bunVersion: string | undefined
}
export type PoolAdmission = {
  schemaVersion: number
  gate: string
  metadata: {
    checkoutSha: string
    treeSha: string
    runId: string
    attempt: string
    runnerOS: string
    runnerArch: string
    omniNonceSha256: string
  }
  inventory: PoolInventory
}
export type PoolRegistry = {
  register(source: string, register: (test: typeof import("bun:test").test) => void,
    nativeTest: typeof import("bun:test").test, describe: typeof import("bun:test").describe): void
  seal(): void
  assertStartup(): void
  observations(): {
    sourceCount: number; declaredCases: number; bodiesStarted: number; bodiesFinished: number
    bodiesReturned: number; bodiesThrew: number; activeCase: string | null; forcedFinalization: boolean
  }
  complete(): { sourceCount: number; caseCount: number }
}
export const POOL_DIRECTORY: string
export const POOL_ENTRY: string
export const POOL_STARTUP: string
export const POOL_FINALIZER: string
export function loadPoolInventory(repoRoot: string, manifestPath?: string): PoolInventory
export function admitPoolCommand(command: string[], input: {
  cwd: string; execPath: string; platform: string; repoRoot: string
}): { command: string[]; timeout: number | null; report: string | null }
export function createPoolRegistry(sources: string[], emit: (event: Record<string, unknown>) => void): PoolRegistry
export function openPoolJournal(output: string, inventory: PoolInventory, execution: PoolExecution): (event: Record<string, unknown>) => void
export function readPoolAdmission(output: string, inventory: PoolInventory): PoolAdmission
