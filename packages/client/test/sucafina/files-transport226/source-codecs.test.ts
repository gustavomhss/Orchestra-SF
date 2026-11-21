import { describe, expect, test } from "bun:test"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfFilesOperationBindings } from "../../../src/sucafina/files/codecs"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import {
  sfAllowedByteMime, sfFilesSourceQuery, sfIsByteOperation, sfIsUploadOperation,
  sfUploadSlot, SF_FILE_IMPORT_LIMIT, SF_FILE_ASSET_LIMIT, SF_FILE_BYTE_LIMIT,
} from "../../../src/sucafina/transport/files"

// Structural source-compatibility tests only. No fake principal, success grant,
// provider, Request, live file or claimed server acceptance is generated here.
// Decode through the same aggregate passed by owner-runtime231 to F02.
describe("226 A06/F02 source-locked file transport", () => {
  test("all 28 source file codecs are installed unchanged in the native owner binding", () => {
    const ids = Object.keys(SfFiles.operations)
    expect(ids.length).toBe(28)
    expect(new Set(ids).size).toBe(28)
    for (const id of ids) {
      expect(SfOperationRegistry[id as keyof typeof SfOperationRegistry]).toBeDefined()
      expect(SfFilesOperationBindings[id as keyof typeof SfFilesOperationBindings]).toBeDefined()
      expect(SfNativeOperationBindings[id as keyof typeof SfNativeOperationBindings]).toBeDefined()
      expect(SfNativeOperationBindings[id as keyof typeof SfNativeOperationBindings])
        .toBe(SfFilesOperationBindings[id as keyof typeof SfFilesOperationBindings])
    }
  })

  test("source byte producers have byte-only mode; no implicit URL or extra byte route", () => {
    const ids = Object.keys(SfFiles.operations).filter((id) =>
      sfIsByteOperation(id as keyof typeof SfFiles.operations))
    expect(ids.sort()).toEqual([
      "files.asset.download", "files.export.json", "files.export.members", "files.export.po", "files.export.register", "files.export.review",
      "files.export.suppliers", "files.export.xlsx",
    ])
    for (const id of ids) {
      expect(SfOperationRegistry[id as keyof typeof SfOperationRegistry].responseMode).toBe("bytes")
      expect(SfNativeOperationBindings[id as keyof typeof SfFilesOperationBindings]!.decodeOutput({})).toEqual({ status: "invalid" })
    }
    expect(sfIsByteOperation("files.asset.link")).toBe(false)
    expect(SF_FILE_BYTE_LIMIT).toBe(32 * 1024 * 1024)
  })

  test("original import nesting/false and asset zero version survive JSON metadata binding", () => {
    const admitted = SfNativeOperationBindings["files.import-admit"]!.decodeInput({
      surface: "planner", selectionRef: "selection-1",
      options: { newVersion: false, removeMissing: false, preview: {} },
      fileName: "budget.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(admitted.value).toHaveProperty("options.newVersion", false)
    expect(admitted.value).toHaveProperty("options.removeMissing", false)
    const asset = SfNativeOperationBindings["files.asset.upload"]!.decodeInput({
      surface: "dashboard", upload: "contract", record: "contract-1",
      recordVersion: 0, name: "evidence.pdf", page: "Vendor Contracts",
      mediaType: "application/pdf",
    })
    expect(asset.status).toBe("ok")
    if (asset.status !== "ok") return
    expect(asset.value).toHaveProperty("recordVersion", 0)
  })

  test("untrusted URL/path/header and duplicate ref fields cannot enter wire codec", () => {
    const codec = SfNativeOperationBindings["files.asset.link"]!
    expect(codec.decodeInput({ surface: "dashboard", assetId: "a", url: "https://evil.invalid" }))
      .toEqual({ status: "invalid" })
    expect(codec.decodeInput({ surface: "dashboard", assetId: "a", headers: { Cookie: "bad" } }))
      .toEqual({ status: "invalid" })
    expect(sfFilesSourceQuery("files.asset.link", { assetId: "" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.download", { assetId: "a", expires: 0, signature: "x" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.upload", { upload: "supplier", record: "s",
      recordVersion: -1, name: "x.pdf", page: "Suppliers" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.link", { assetId: "a" })).toEqual({ "asset-link": "a" })
    const ref = "report:" + "a".repeat(64)
    expect(sfFilesSourceQuery("files.export.review", { surface: "dashboard", artifactRef: ref })).toEqual({ artifactRef: ref })
    expect(sfFilesSourceQuery("files.export.review", { surface: "planner", artifactRef: ref })).toBeUndefined()
    // WS-7: PO exports require exactly one validated selection from CAP25;
    // no route path, URL, cross-surface alias, or empty/encoded reference passes.
    expect(sfFilesSourceQuery("files.export.po", { surface: "procurement", request: "PR-42" }))
      .toEqual({ request: "PR-42" })
    for (const input of [
      { surface: "dashboard", request: "PR-42" }, { surface: "procurement", request: "" },
      { surface: "procurement", request: "a/b" }, { surface: "procurement", request: "a%2Fb" },
      { surface: "procurement", request: "PR-42", url: "https://evil.invalid" },
    ]) {
      expect(sfFilesSourceQuery("files.export.po", input)).toBeUndefined()
      expect(SfNativeOperationBindings["files.export.po"]!.decodeInput(input))
        .toEqual({ status: "invalid" })
    }
    expect(SfNativeOperationBindings["files.export.po"]!.decodeInput({
      surface: "procurement", request: "PR-42",
    }).status).toBe("ok")
    expect(SfNativeOperationBindings["files.export.review"]!.decodeInput({ surface: "dashboard", artifactRef: ref, url: "https://evil.invalid" })).toEqual({ status: "invalid" })
    expect(SfNativeOperationBindings["files.export.review"]!.decodeInput({ surface: "dashboard", artifactRef: "report:xyz" })).toEqual({ status: "invalid" })
  })

  test("two fixed upload slots reject MIME confusion, empty/oversize and binary-path diversion", () => {
    expect(sfIsUploadOperation("files.import-admit")).toBe(true)
    expect(sfIsUploadOperation("files.asset.upload")).toBe(true)
    expect(sfIsUploadOperation("files.document-admit")).toBe(false)
    expect(sfUploadSlot("files.import-admit", { fileName: "evil.exe",
      mediaType: "application/json", bytes: new Uint8Array([1]) })).toBeUndefined()
    expect(sfUploadSlot("files.import-admit", { fileName: "file.xlsx",
      mediaType: "text/plain", bytes: new Uint8Array() })).toBeUndefined()
    expect(sfUploadSlot("files.import-admit", { fileName: "file.xlsx",
      mediaType: "application/octet-stream", bytes: new Uint8Array(SF_FILE_IMPORT_LIMIT + 1) }))
      .toBeUndefined()
    expect(sfUploadSlot("files.asset.upload", { name: "file.pdf",
      mediaType: "application/pdf", bytes: new Uint8Array(SF_FILE_ASSET_LIMIT + 1) }))
      .toBeUndefined()
    expect(sfUploadSlot("files.asset.link", { name: "file.pdf",
      mediaType: "application/pdf", bytes: new Uint8Array([1]) })).toBeUndefined()
  })

  test("bytes MIME decisions are operation-specific and reject HTML/script content", () => {
    expect(sfAllowedByteMime("files.export.json", "application/json")).toBe(true)
    expect(sfAllowedByteMime("files.export.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
    expect(sfAllowedByteMime("files.export.members",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
    expect(sfAllowedByteMime("files.export.members", "application/pdf")).toBe(false)
    expect(sfAllowedByteMime("files.export.members", "text/html")).toBe(false)
    expect(sfAllowedByteMime("files.export.review", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true)
    expect(sfAllowedByteMime("files.export.review", "application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(true)
    for (const type of ["text/html", "application/json", "application/pdf", "application/octet-stream", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])
      expect(sfAllowedByteMime("files.export.review", type)).toBe(false)
    expect(sfAllowedByteMime("files.export.suppliers", "text/csv; charset=utf-8")).toBe(true)
    expect(sfAllowedByteMime("files.asset.download", "application/pdf")).toBe(true)
    // Only source-authenticated per-PO exports may return inert downloadable HTML.
    expect(sfAllowedByteMime("files.export.po", "text/html; charset=utf-8")).toBe(true)
    expect(sfAllowedByteMime("files.export.po", "application/javascript")).toBe(false)
    expect(sfAllowedByteMime("files.export.po", "application/json")).toBe(false)
    expect(sfAllowedByteMime("files.export.json", "text/html")).toBe(false)
    expect(sfAllowedByteMime("files.asset.download", "text/html")).toBe(false)
    expect(sfAllowedByteMime("files.asset.download", "application/javascript")).toBe(false)
    expect(sfAllowedByteMime("files.import-admit", "application/pdf")).toBe(false)
  })
})
