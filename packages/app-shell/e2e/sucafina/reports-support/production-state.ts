import path from "node:path"
import { loadLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { reportsCorpus } from "./corpus.ts"

// Invoked under Bun by the owned setup process, only before the real CLI starts.
// The installed source lifecycle, domain projections and authorization are not replaced.
const [operation, file, today] = process.argv.slice(2)
if (operation !== "seed" || !file || !today) throw new Error("Expected seed <private configuration> <UTC date>")
const loaded = await loadLocalConfiguration(file)
if (loaded.config.authentication !== "local-operator" || !loaded.config.localOperator)
  throw new Error("An enrolled production local operator is required")
const principal = `macos:${loaded.config.localOperator.installationId}:${loaded.config.localOperator.uid}`
const store = await openLocalStore(path.join(loaded.directory, "business-local"))
try {
  const corpus = reportsCorpus(today)
  await store.transaction("dashboard", async (snapshot) => {
    if (Object.keys(snapshot.data).length || Object.keys(snapshot.versions).length || snapshot.audit.length || snapshot.sfSources)
      throw new Error("Reports seed refuses to overwrite an existing installation")
    snapshot.data = { ...corpus.data, access: { [principal]: { assigned: [], domains: [] } } }
    snapshot.versions = Object.fromEntries([
      "dataset", "opexOwners:reports-opex",
      ...corpus.data.opexEntries.map((entry) => `opexEntries:${entry.id}`),
      ...corpus.projects.map((project) => `projects:${project.id}`),
    ].map((key) => [key, { version: 1, by: principal }]))
    return { commit: true, value: undefined }
  })
  process.stdout.write(JSON.stringify({ seeded: true, projects: corpus.projects.length, year: corpus.year, sourceForecast: corpus.before }))
} finally {
  await store.dispose()
}
