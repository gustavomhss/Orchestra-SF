import type { LocalIdentity, LocalSecrets } from "./local-contract.ts"

export type LocalOperator = { installationId: string; uid: number; name: string; buyer?: boolean }
export type OperatorIdentity = LocalIdentity & { enroll: () => Promise<string>; scope: (request: Request) => Promise<string | undefined> }
export type OperatorOptions = {
  origin: string
  mount: string
  operator: LocalOperator
  key: Uint8Array
  secrets: LocalSecrets
  now?: () => Date
}
