import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { Database } from "@orchestra/core/database/database"
import { Location } from "@orchestra/core/location"
import { RagSourceTable } from "@orchestra/core/rag-studio/sql"
import { admit, listSources, placed } from "@orchestra/rag-studio"
import { extract } from "@orchestra/rag-studio/extract"
import { Context, Effect, Layer } from "effect"
import { session } from "../src/handlers/rag-studio-session"

test("opening the folder as a symlink and as its real path is one corpus", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "rag-loc-")))
  const linkParent = await mkdtemp(join(tmpdir(), "rag-loc-link-"))
  const link = join(linkParent, "open")
  await symlink(root, link)
  const project = join(root, "project")
  const corpus = join(root, "corpus")
  await mkdir(project)
  await mkdir(corpus)
  const file = join(corpus, "note.txt")
  await writeFile(file, "The harbor light is blue.")
  try {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const database = Context.get(
            yield* Layer.build(Database.layerFromPath(join(root, "orchestra.sqlite"))),
            Database.Service,
          )
          const opened = (directory: string) =>
            Location.Service.of({
              directory,
              project: { directory: project, id: "prj" },
            } as unknown as Location.Interface)
          yield* database.db
            .insert(RagSourceTable)
            .values({
              id: "src_old",
              location_id: link,
              path: placed(file),
              content_hash: "old",
              status: "read",
            })
            .run()
          const admitted = yield* session(database.db, async (store, locationId) => {
            const read = await extract(file)
            const path = placed(file)
            if ("text" in read) store.writeFile(path, read.text)
            return { locationId, source: await admit({ locationId, path }) }
          }).pipe(Effect.provideService(Location.Service, opened(link)))
          const listed = yield* session(database.db, async (_store, locationId) => {
            return { locationId, sources: await listSources(locationId) }
          }).pipe(Effect.provideService(Location.Service, opened(root)))
          const stored = yield* database.db.select().from(RagSourceTable).all()
          return { admitted, listed, stored }
        }),
      ),
    )
    expect(result.admitted.locationId).toBe(placed(link))
    expect(result.listed.locationId).toBe(result.admitted.locationId)
    expect("id" in result.admitted.source).toBe(true)
    if (!("id" in result.admitted.source)) return
    expect(result.admitted.source.id).toBe("src_old")
    expect(result.listed.sources.map((row) => row.id)).toEqual(["src_old"])
    expect(result.stored.map((row) => row.location_id)).toEqual([placed(link)])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(linkParent, { recursive: true, force: true })
  }
})
