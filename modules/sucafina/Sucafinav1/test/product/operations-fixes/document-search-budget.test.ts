import { expect, test } from "bun:test"
import { createDocumentBudgetFixture } from "./document-search-fixture.ts"

test("OPS-REV-03 inaccessible principals and scopes before B cannot consume search budget or affect result metadata", async () => {
  const fixture = await createDocumentBudgetFixture()
  try {
    const prefix: string[] = []
    const access = ["revoked", "other-principal", "other-installation", "other-project"] as const
    for (let index = 0; index < 104; index++) prefix.push(await fixture.add(`private-${index}`, "PRIVATE_ONLY NEEDLE_B", access[index % access.length]!))
    const b = await fixture.add("public-b", "Token: NEEDLE_B")
    await fixture.select([b])
    const baseline = await fixture.search("NEEDLE_B")
    expect(baseline).toMatchObject({ status: "ok", value: { matches: [{ text: "NEEDLE_B", documentRef: { target: { documentId: b } } }], limitations: ["lexical-exact-match"] } })
    await fixture.select([...prefix, b])
    expect(await fixture.search("NEEDLE_B")).toEqual(baseline)
    const hidden = await fixture.search("PRIVATE_ONLY")
    expect(hidden).toEqual({ status: "ok", value: { matches: [], limitations: ["lexical-exact-match"] } })
    expect(JSON.stringify(hidden)).not.toContain("private-")
  } finally { await fixture.dispose() }
}, 120_000)

test("OPS-REV-03 budget counts 100 authorized sources and fences the 101st metadata witness and sources without hits", async () => {
  const fixture = await createDocumentBudgetFixture()
  try {
    const ids: string[] = []
    for (let index = 0; index < 99; index++) ids.push(await fixture.add(`authorized-${index}`, "No matching token"))
    ids.push(await fixture.add("authorized-100", "Token: NEEDLE_B"))
    const overflow = await fixture.add("authorized-101", "OVERFLOW_ONLY NEEDLE_B")
    await fixture.select(ids)
    const hundred = await fixture.search("NEEDLE_B")
    expect(hundred.status).toBe("ok")
    if (hundred.status !== "ok") throw new Error("Exactly 100 source search failed")
    expect(hundred.value.matches).toHaveLength(1)
    expect(hundred.value.matches[0]).toMatchObject({ documentRef: { target: { documentId: "authorized-100" } } })
    expect(hundred.value.limitations).toEqual(["lexical-exact-match"])
    await fixture.select([...ids, overflow])
    expect(await fixture.search("NEEDLE_B")).toEqual({ status: "ok", value: { ...hundred.value, limitations: ["lexical-exact-match", "document-scan-limited"] } })
    expect(await fixture.search("OVERFLOW_ONLY")).toEqual({ status: "ok", value: { matches: [], limitations: ["lexical-exact-match", "document-scan-limited"] } })

    const lostWitness = await fixture.search("ABSENT_TOKEN", overflow)
    expect(lostWitness).toEqual({ status: "unavailable", reason: "authority-changed" })
    expect(JSON.stringify(lostWitness)).not.toContain("document-scan-limited")
    expect(await fixture.search("NEEDLE_B")).toEqual({ status: "ok", value: hundred.value })
    const lostEmptySource = await fixture.search("NEEDLE_B", ids[0]!)
    expect(lostEmptySource).toEqual({ status: "unavailable", reason: "authority-changed" })
    expect(JSON.stringify(lostEmptySource)).not.toContain("NEEDLE_B")
  } finally { await fixture.dispose() }
}, 120_000)
