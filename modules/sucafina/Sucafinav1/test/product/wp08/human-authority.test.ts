import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("real UI admission binds thread creation to its human action and exact payload", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-human-admission-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const identity = { installationId: "install", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" }
    const ui = createSfUiAuthority({ authorize: async () => identity, commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z"), privateCommands: ["sf-human:collaboration.thread.create"] })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "person", policyVersion: "policy", accessRevision: "access" }) })
    const ids = { value: 0 }
    const threads = createThreadPort({ mutationFence: createCollaborationMutationFence({ persistence: store }), state, human, creationTarget: { ref: "workspace", incarnation: "inc" }, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }, authorize: async () => true, createId: () => `id-${++ids.value}`, now: () => "2026-11-13T00:00:00Z" })
    const source = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "line", recordId: "line", incarnation: "inc", version: 1, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, projectionDigest: "b".repeat(64) } } as const
    const draft = { kind: "comment", sourceRef: "source", sourceIncarnation: "inc", observedVersion: 1, period: { start: "2027-01-01", end: "2027-01-31" }, body: "Original", evidenceRefs: [source] } as const
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "create" }
    const request = new Request("https://example.test/action", { method: "POST", headers: { origin: "https://example.test" } })
    const admitted = await human.admit(request, "collaboration.thread.create", { draft, mutation })
    if (admitted.status !== "ok") throw new Error("human admission failed")
    expect((await threads.create({ ...draft, sourceIncarnation: "replacement" }, mutation, admitted.value)).status).toBe("needs-input")
    expect((await threads.create({ ...draft, observedVersion: 2 }, mutation, admitted.value)).status).toBe("needs-input")
    expect((await threads.create({ ...draft, body: "Altered" }, mutation, admitted.value)).status).toBe("denied")
    expect((await threads.create(draft, mutation, admitted.value)).status).toBe("ok")
    human.finish(admitted.value)
    expect((await threads.create(draft, mutation, admitted.value)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

