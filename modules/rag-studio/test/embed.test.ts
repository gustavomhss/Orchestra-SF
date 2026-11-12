import { expect, test } from "bun:test"
import { ask } from "../src/ask"
import { memoryStore, withStore } from "../src/context"
import { withEncoder } from "../src/embed"
import { admit } from "../src/admit"
import { parseSource } from "../src/parse"
import { runPass } from "../src/passes"
import { openRevision, readPipeline, setPipeline } from "../src/revision"

const path = "/location/a/note.txt"
const other = "/location/a/other.txt"

test("a named OpenRouter model stores vectors and does not touch project source", async () => {
  const store = memoryStore({
    projectRoot: "/repo",
    files: { [path]: "alpha beta", [other]: "gamma only" },
  })
  await withStore(store, async () => {
    expect(await admit({ locationId: "a", path: "/repo/src/main.ts" })).toEqual({ refused: "atlas" })
    const admitted = await admit({ locationId: "a", path })
    const neighbor = await admit({ locationId: "a", path: other })
    if (!("id" in admitted) || !("id" in neighbor)) throw new Error("admit")
    await parseSource(admitted.id)
    await parseSource(neighbor.id)
    expect(await runPass("redo_numbers", admitted.id)).toEqual({ pass: "redo_numbers", result: "not_applicable" })
    await setPipeline("a", "embedding_model", "nvidia/nemotron-3-embed-1b:free")
    expect((await readPipeline("a")).embedding).toBe(true)
    expect(await runPass("redo_numbers", admitted.id)).toEqual({ pass: "redo_numbers", result: "no_key" })
    expect(store.vectors()).toEqual([])
    await withEncoder(
      async ({ texts }) => texts.map((text) => [text.length, 1]),
      async () => {
        expect(await runPass("redo_numbers", admitted.id)).toEqual({ pass: "redo_numbers", fill: "complete" })
        expect(await runPass("redo_numbers", neighbor.id)).toEqual({ pass: "redo_numbers", fill: "complete" })
        expect(store.vector(store.chunks()[0].id, "nvidia/nemotron-3-embed-1b:free")).toEqual([10, 1])
        const revision = await openRevision("a")
        const result = await ask(revision.id, "beta")
        const neighborChunk = store.chunks().find((chunk) => chunk.sourceId === neighbor.id)
        expect(result.sense).toBe("fused")
        expect(result.hits.every((id) => store.chunks().find((chunk) => chunk.id === id)?.text.includes("beta"))).toBe(
          true,
        )
        expect(result.hits).not.toContain(neighborChunk?.id)
        expect(store.embeddingCalls).toBe(3)
      },
    )
  })
})
