import { parentPort, workerData } from "node:worker_threads"

if (!parentPort) throw new Error("parser-test-parent-port-missing")
const boot: unknown = workerData
if (!boot || typeof boot !== "object" || !("kind" in boot) || (boot.kind !== "pdf" && boot.kind !== "docx"))
  throw new Error("parser-test-kind-missing")
const kind = boot.kind
parentPort.postMessage({ status: "ready" })
parentPort.once("message", (message: unknown) => {
  if (!message || typeof message !== "object" || !("bytes" in message) || !(message.bytes instanceof Uint8Array)) {
    parentPort.postMessage({ status: "failed", reason: "parser-test-bytes-missing" })
    return
  }
  parentPort.postMessage({ status: "ok", value: `${kind}:${message.bytes.byteLength}` })
})
