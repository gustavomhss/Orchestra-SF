import { expect, test } from "bun:test"
import { createSfImportHttp, type ImportService } from "../product/interface/import-http.ts"
import { createSfUiAuthority } from "../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../product/integration/human-authority.ts"

const origin = "https://sf.example.test"
const mount = "/sucafina"
const unreachable = async (): Promise<never> => { throw new Error("unreachable import service") }
const service: ImportService = {
  discover: unreachable,
  prepareTarget: unreachable,
  dispatch: unreachable,
  imports: {
    admit: unreachable,
    readPreviewReference: unreachable,
    detail: unreachable,
    apply: unreachable,
  },
}

function runtime(authorized: boolean) {
  const ui = createSfUiAuthority({
    authorize: async () => authorized ? {
      installationId: "installation",
      projectId: "project",
      principalRef: "person",
      policyVersion: "policy",
      accessRevision: "revision",
    } : undefined,
    commandIdentity: async () => "command",
    createId: () => crypto.randomUUID(),
    now: () => Date.now(),
    privateCommands: ["sf-human:imports.admit"],
  })
  return { ui, human: createSfHumanAuthority({ origin, ui }), service }
}

function request(body: string) {
  return new Request(`${origin}${mount}/planner?sf=import-admit`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "multipart/form-data; boundary=sf-boundary",
    },
    body,
  })
}

test("import admission rejects unavailable authority before consuming multipart bytes", async () => {
  const body = "--sf-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"payload.json\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--sf-boundary--\r\n"
  const incoming = request(body)
  const handler = createSfImportHttp({ origin, mount, runtime: () => runtime(false) })
  expect((await handler(incoming, "planner"))?.status).toBe(403)
  expect(incoming.bodyUsed).toBe(false)
})

test("authorized import admission still consumes and rejects a malformed multipart envelope", async () => {
  const incoming = request("not-a-valid-multipart-body")
  const handler = createSfImportHttp({ origin, mount, runtime: () => runtime(true) })
  expect((await handler(incoming, "planner"))?.status).toBe(400)
  expect(incoming.bodyUsed).toBe(true)
})
