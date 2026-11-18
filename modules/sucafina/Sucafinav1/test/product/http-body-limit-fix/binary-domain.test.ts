import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import { binaryFixture } from "./binary-fixture.ts"
import { streamedBody } from "./workbench-fixture.ts"

test("Authorized binary domain upload preserves exact bytes, CAS and SQLite with a fail-closed component scanner", async () => {
  const f = await binaryFixture("http://localhost:43174")
  const upload = (bytes: Uint8Array, version = 3, cookie = f.cookie) => {
    const input = streamedBody(bytes, 1021)
    const request = new Request(`${f.origin}${f.uploadPath(version)}`, {
      method: "POST", body: input.stream, headers: { cookie, origin: f.origin, "content-type": "image/bmp" }, duplex: "half",
    })
    return { input, response: f.handler(request) }
  }
  try {
    expect(f.accepted.byteLength).toBeGreaterThan(65536)
    const initial = await f.state()
    const altered = new Uint8Array(f.accepted)
    altered[altered.length - 1] = altered[altered.length - 1]! ^ 1
    const rejected = upload(altered)
    expect((await rejected.response)?.status).toBe(422)
    expect(f.scans).toHaveLength(1)
    expect(f.scans[0]?.accepted).toBe(false)
    expect(await f.state()).toEqual(initial)

    const valid = upload(f.accepted)
    const response = await valid.response
    expect(response?.status).toBe(200)
    expect(await response!.json()).toMatchObject({ ok: true })
    expect(valid.input.observed.bytes).toBe(f.accepted.byteLength)
    expect(valid.input.observed.ended).toBe(true)
    expect(f.scans).toHaveLength(2)
    expect(f.scans[1]).toEqual({ digest: f.acceptedDigest, type: "image/bmp", bytes: f.accepted.byteLength, accepted: true })
    const committed = await f.state()
    expect(committed.files).toHaveLength(1)
    expect(committed.files[0]?.bytes).toEqual(f.accepted)
    expect(rows(committed.snapshot.data.contracts)[0]?.vendor).toBe("Binary fixture vendor")
    expect(committed.snapshot.versions["contracts:binary-c1"]?.version).toBe(4)
    expect(committed.snapshot.versions.dataset?.version).toBe(8)
    expect(committed.snapshot.audit).toHaveLength(1)

    const conflict = upload(f.accepted)
    expect((await conflict.response)?.status).toBe(409)
    expect(await f.state()).toEqual(committed)
    expect((await f.logout())?.status).toBe(204)
    const scansBefore = f.scans.length
    const denied = upload(f.accepted, 4)
    expect((await denied.response)?.status).toBe(403)
    expect(denied.input.observed.pulls).toBe(0)
    expect(f.scans).toHaveLength(scansBefore)
    expect(await f.state()).toEqual(committed)
  } finally { await f.close() }
})
