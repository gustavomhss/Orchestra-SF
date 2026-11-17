import { parentPort, workerData } from "node:worker_threads"

const port = parentPort
if (!port) throw new Error("parser-test-parent-port-missing")
const boot: unknown = workerData
if (!boot || typeof boot !== "object" || !("kind" in boot) || (boot.kind !== "pdf" && boot.kind !== "docx") || !("received" in boot) || !(boot.received instanceof SharedArrayBuffer))
  throw new Error("parser-test-ready-hang-input-missing")
const received = new Int32Array(boot.received)
port.postMessage({ status: "ready" })
port.on("message", () => {
  Atomics.store(received, 0, 1)
  Atomics.notify(received, 0)
  // Deliberately retain the parent-port listener and never answer. The host must
  // cancel, terminate and release both the worker and its input-byte reservation.
})
