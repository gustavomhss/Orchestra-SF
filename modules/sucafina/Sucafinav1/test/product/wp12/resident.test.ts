import { expect, test } from "bun:test"
import path from "node:path"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import type { ResidentProfile, SkillManifest } from "../../../product/contracts/resident-ai.ts"

const root = path.resolve(import.meta.dir, "../../../product/ai")

test("resident manifests load distributed sources and pin digests", async () => {
  const probe = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/native-probe.json") })
  expect(probe.profiles.map((profile) => profile.id)).toEqual(["sf_finance"])
  expect(probe.skills.map((skill) => skill.id)).toEqual(["sf-explicar-forecast"])
  const full = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  expect(full.profiles).toHaveLength(5)
  expect(full.skills).toHaveLength(18)
  expect(full.source.type).toBe("directory")
  expect(full.manifestDigest).toMatch(/^[a-f0-9]{64}$/)
})

test("a modified distributed skill cannot be admitted under an old digest", async () => {
  const { mkdtemp, cp, appendFile, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-"))
  try {
    await cp(root, directory, { recursive: true })
    await appendFile(path.join(directory, "skills/sf-explicar-forecast/SKILL.md"), "\nAlterado.\n")
    await expect(createResidentAiBundle({ root: directory, manifestPath: path.join(directory, "manifests/native-probe.json") })).rejects.toThrow("Skill digest mismatch")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("manifest cannot add a skill grant even with unchanged source bytes", async () => {
  const { mkdtemp, cp, writeFile, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-"))
  try {
    await cp(root, directory, { recursive: true })
    const file = path.join(directory, "manifests/native-probe.json")
    const manifest = await Bun.file(file).json()
    manifest.skills[0].allowedOperations.push("sf_change_prepare")
    await writeFile(file, JSON.stringify(manifest))
    await expect(createResidentAiBundle({ root: directory, manifestPath: file })).rejects.toThrow("Skill policy mismatch")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("an unknown input schema is rejected", async () => {
  const { mkdtemp, cp, writeFile, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-"))
  try {
    await cp(root, directory, { recursive: true })
    const file = path.join(directory, "manifests/native-probe.json")
    const manifest = await Bun.file(file).json()
    manifest.skills[0].inputSchemaRef = "UnknownSkillInput"
    await writeFile(file, JSON.stringify(manifest))
    await expect(createResidentAiBundle({ root: directory, manifestPath: file })).rejects.toThrow("Skill policy mismatch")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a valid digest does not permit manifest or source paths outside the distributed root", async () => {
  const { mkdtemp, cp, rename, symlink, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-boundary-"))
  try {
    const source = path.join(directory, "resident")
    await cp(root, source, { recursive: true })
    const manifest = path.join(source, "manifests/native-probe.json")
    const externalManifest = path.join(directory, "native-probe.json")
    await cp(manifest, externalManifest)
    await expect(createResidentAiBundle({ root: source, manifestPath: externalManifest })).rejects.toThrow("Manifest outside resident root")

    const file = path.join(source, "skills/sf-explicar-forecast/SKILL.md")
    const externalSkill = path.join(directory, "SKILL.md")
    await rename(file, externalSkill)
    await symlink(externalSkill, file)
    await expect(createResidentAiBundle({ root: source, manifestPath: manifest })).rejects.toThrow("Resident source outside root")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("duplicate, unknown and incomplete resident catalogs fail before registration", async () => {
  const { mkdtemp, cp, writeFile, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const directory = await mkdtemp(path.join(tmpdir(), "sf-resident-catalog-"))
  try {
    await cp(root, directory, { recursive: true })
    const file = path.join(directory, "manifests/resident.json")
    const manifest: { profiles: ResidentProfile[]; skills: SkillManifest[] } = await Bun.file(file).json()
    const cases = [
      { manifest: { ...manifest, profiles: [manifest.profiles[0], ...manifest.profiles.slice(0, -1)] }, reason: "Empty or duplicate resident entries" },
      { manifest: { ...manifest, skills: [manifest.skills[0], ...manifest.skills.slice(0, -1)] }, reason: "Empty or duplicate resident entries" },
      { manifest: { ...manifest, profiles: [...manifest.profiles.slice(0, -1), { ...manifest.profiles.at(-1), id: "sf_unknown" }] }, reason: "Invalid resident profile" },
      { manifest: { ...manifest, skills: manifest.skills.slice(0, -1) }, reason: "Incomplete resident manifest" },
    ]
    for (const sample of cases) {
      await writeFile(file, JSON.stringify(sample.manifest))
      await expect(createResidentAiBundle({ root: directory, manifestPath: file })).rejects.toThrow(sample.reason)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
