import { parentPort } from "node:worker_threads"

if (!parentPort) throw new Error("parser-test-parent-port-missing")
setInterval(() => undefined, 1_000)
