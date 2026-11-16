import { expect, test } from "bun:test"
import { createSfDesktopEnrollmentBridge } from "../../src/main/sucafina/bootstrap"

const baseUrl = "http://127.0.0.1:41231"
const launchId = "00000000-0000-4000-8000-000000000001"
const requestId = "00000000-0000-4000-8000-000000000002"
const candidate = () => ({
  serverKey: baseUrl, baseUrl,
  credentials: { kind: "basic" as const, username: "local", password: "unit-only" },
})
const request = { serverKey: baseUrl, projectId: "project-1", installationId: "installed-1", requestId }
const ready = { kind: "sf-native-local-ready", launchId, projectId: "project-1", installationId: "installed-1" }
const enrollment = {
  kind: "sf-native-local-enrollment", launchId, requestId,
  projectId: "project-1", installationId: "installed-1", publicOrigin: baseUrl,
  mount: "/sucafina", url: baseUrl + "/sucafina/auth/local?code=" + "a".repeat(64),
  expiresAt: Date.now() + 120_000,
}

test("real bridge correlates the per-launch Dock producer and never hands an enrollment to IPC", async () => {
  const sent: unknown[] = []
  const bridge = createSfDesktopEnrollmentBridge(candidate)
  try {
    expect(bridge.handleMessage(ready, (message) => sent.push(message))).toBe(true)
    expect(bridge.handleMessage({ type: "dock.rpc", op: "read" }, () => undefined)).toBe(false)
    const result = bridge.requestLocalEnrollment(request)
    expect(sent).toEqual([{
      kind: "sf-native-local-enrollment-request",
      launchId, requestId, installationId: request.installationId,
    }])
    expect(bridge.handleMessage({ ...enrollment, launchId: "00000000-0000-4000-8000-000000000099" },
      () => undefined)).toBe(true)
    bridge.handleMessage(enrollment, () => undefined)
    expect(await result).toEqual(enrollment)
  } finally { bridge.dispose() }
})

test("untrusted owner and malformed ready cannot enroll or invent a launch", async () => {
  const bridge = createSfDesktopEnrollmentBridge(candidate)
  try {
    await expect(bridge.requestLocalEnrollment(request)).rejects.toThrow("PRODUCER_UNAVAILABLE")
    await expect(bridge.requestLocalEnrollment({ ...request, serverKey: "http://127.0.0.1:54321" }))
      .rejects.toThrow("OWNER_UNAVAILABLE")
    expect(bridge.handleMessage({ ...ready, injected: true }, () => undefined)).toBe(true)
    await expect(bridge.requestLocalEnrollment(request)).rejects.toThrow("PRODUCER_UNAVAILABLE")
    expect(bridge.handleMessage({ ...ready, launchId: "not-a-uuid" }, () => undefined)).toBe(true)
    await expect(bridge.requestLocalEnrollment(request)).rejects.toThrow("PRODUCER_UNAVAILABLE")
  } finally { bridge.dispose() }
})

test("wrong installation, foreign project and duplicate pending request fail without a grant", async () => {
  const sent: unknown[] = []
  const bridge = createSfDesktopEnrollmentBridge(candidate)
  try {
    bridge.handleMessage(ready, (message) => sent.push(message))
    const first = bridge.requestLocalEnrollment(request)
    await expect(bridge.requestLocalEnrollment({ ...request, requestId: "00000000-0000-4000-8000-000000000003" }))
      .rejects.toThrow("PRODUCER_UNAVAILABLE")
    bridge.handleMessage({ ...enrollment, projectId: "project-2" }, () => undefined)
    bridge.handleMessage({ ...enrollment, installationId: "installed-2" }, () => undefined)
    bridge.disconnect()
    await expect(first).rejects.toThrow("TRANSPORT_CLOSED")
    bridge.handleMessage(enrollment, () => undefined)
    await expect(bridge.requestLocalEnrollment(request)).rejects.toThrow("PRODUCER_UNAVAILABLE")
  } finally { bridge.dispose() }
})

test("changed enrollment launch fences the old in-flight request and clears consent-free reuse", async () => {
  const bridge = createSfDesktopEnrollmentBridge(candidate)
  try {
    bridge.handleMessage(ready, () => undefined)
    const first = bridge.requestLocalEnrollment(request)
    bridge.handleMessage({ ...ready, launchId: "00000000-0000-4000-8000-000000000004" }, () => undefined)
    await expect(first).rejects.toThrow("LAUNCH_CHANGED")
    bridge.handleMessage(enrollment, () => undefined)
    const second = bridge.requestLocalEnrollment({
      ...request, requestId: "00000000-0000-4000-8000-000000000005",
    })
    bridge.dispose()
    await expect(second).rejects.toThrow("TRANSPORT_CLOSED")
  } finally { bridge.dispose() }
})
