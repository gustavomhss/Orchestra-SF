import { expect, test } from "bun:test"
import type { SfContext, SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { createSfTransport, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { createSfOwnerServerFetch } from "../../src/orchestra/chapters/sucafina/host/server-fetch"

// Contract probes through the actual native transport; no installed actor grants.
const installation: SfInstallationDescriptor = {
  installationId: "installation-test", projectId: "project-test", hostId: "host-test",
  publicOrigin: "http://localhost:4110", mount: "/sucafina",
  authMode: "local-operator", contractRevision: "sf-native-ui/1",
}
const context: SfContext = {
  stamp: { installationId: installation.installationId, projectId: installation.projectId,
    hostId: installation.hostId, principalRef: "actor-test", policyVersion: "policy-test", accessRevision: "access-test" },
  contractRevision: "sf-native-ui/1", authMode: "local-operator", destinations: [], availability: [],
}
const selection = {
  installationId: installation.installationId, projectId: installation.projectId, hostId: installation.hostId,
}

test("F01 authenticates the producer's exact localhost context through the selected server", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { location: { origin: installation.publicOrigin } },
  })
  const calls: { input: RequestInfo | URL; init: RequestInit | undefined }[] = []
  const signal = new AbortController().signal
  try {
    const fetcher = createSfOwnerServerFetch({
      url: installation.publicOrigin, username: "orchestra", password: "unit-server-credential",
    }, async (input, init) => {
      calls.push({ input, init })
      return Response.json({ status: "ok", value: context }, {
        headers: { "Cache-Control": "no-store" },
      })
    })
    const transport = createSfTransport({
      binding: installation, generation: 1, currentGeneration: () => 1,
      operations: SfNativeOperationBindings, fetch: fetcher,
    })
    const result = await createSfContextClient(transport)["ctx.context"](selection, { signal })
    expect(result).toMatchObject({ kind: "response", status: 200, body: { status: "ok", value: context } })
    expect(calls).toHaveLength(1)
    const call = calls[0]
    if (!call) throw new Error("Native context request was not sent")
    const url = new URL(String(call.input))
    expect(url.origin).toBe(installation.publicOrigin)
    expect(url.pathname).toBe("/sucafina/api/ui/context")
    expect(Object.fromEntries(url.searchParams)).toEqual(selection)
    expect(call.init?.method).toBe("GET")
    expect(call.init?.credentials).toBe("same-origin")
    expect(call.init?.cache).toBe("no-store")
    expect(call.init?.redirect).toBe("error")
    expect(call.init?.signal).toBe(signal)
    const headers = new Headers(call.init?.headers)
    expect(headers.get("Accept")).toBe("application/json")
    expect(headers.get("Authorization")).toBe("Basic " + btoa("orchestra:unit-server-credential"))
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("F01 server credentials never cross origins or URL userinfo and redirects remain blocked", async () => {
  let sent = 0
  const receivedCalls: (RequestInit | undefined)[] = []
  const fetcher = createSfOwnerServerFetch({
    url: installation.publicOrigin, password: "unit-server-credential",
  }, async (_input, init) => {
    sent += 1
    receivedCalls.push(init)
    return new Response(null, { status: 204 })
  })
  for (const url of [
    "http://127.0.0.1:4110/sucafina/api/ui/context",
    "http://localhost:4111/sucafina/api/ui/context",
    "https://localhost:4110/sucafina/api/ui/context",
    "http://app.localhost:4110/sucafina/api/ui/context",
    "http://user:pass@localhost:4110/sucafina/api/ui/context",
  ]) {
    await expect(fetcher(url)).rejects.toThrow("SF_NATIVE_SERVER_ORIGIN_MISMATCH")
  }
  expect(sent).toBe(0)
  const signal = new AbortController().signal
  await fetcher(new Request(installation.publicOrigin + "/sucafina/auth/logout", {
    headers: { Accept: "application/json" },
  }), {
    method: "POST", body: "retained", credentials: "same-origin", redirect: "follow", signal,
    headers: { "Idempotency-Key": "unit-key" },
  })
  expect(sent).toBe(1)
  const received = receivedCalls[0]
  if (!received) throw new Error("Selected server request was not sent")
  expect(received.redirect).toBe("error")
  expect(received?.credentials).toBe("same-origin")
  expect(received?.method).toBe("POST")
  expect(received?.body).toBe("retained")
  expect(received?.signal).toBe(signal)
  expect(new Headers(received?.headers).get("Accept")).toBe("application/json")
  expect(new Headers(received?.headers).get("Idempotency-Key")).toBe("unit-key")
  expect(new Headers(received?.headers).get("Authorization")).toBe("Basic " + btoa("orchestra:unit-server-credential"))
})

test("F02 still rejects noncanonical local operator hosts before any network request", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  let sent = 0
  const fetcher: SfTransportFetch = async () => {
    sent += 1
    throw new Error("Unadmitted origin reached the network")
  }
  try {
    for (const publicOrigin of ["http://app.localhost:4110", "http://localhost.example.test:4110", "http://192.0.2.1:4110"]) {
      Object.defineProperty(globalThis, "window", {
        configurable: true, value: { location: { origin: publicOrigin } },
      })
      const transport = createSfTransport({
        binding: { ...installation, publicOrigin }, generation: 1, currentGeneration: () => 1,
        operations: SfNativeOperationBindings, fetch: fetcher,
      })
      expect(await createSfContextClient(transport)["ctx.context"](selection, {
        signal: new AbortController().signal,
      })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    }
    expect(sent).toBe(0)
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
