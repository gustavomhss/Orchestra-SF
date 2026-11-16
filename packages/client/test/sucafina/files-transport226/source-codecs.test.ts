import { describe, expect, test } from "bun:test"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfFilesOperationBindings } from "../../../src/sucafina/files/codecs"
import {
  sfAllowedByteMime, sfFilesSourceQuery, sfIsByteOperation, sfIsUploadOperation,
  sfUploadSlot, SF_FILE_IMPORT_LIMIT, SF_FILE_ASSET_LIMIT, SF_FILE_BYTE_LIMIT,
} from "../../../src/sucafina/transport/files"

// Structural source-compatibility tests only. No fake principal, success grant,
// provider, Request, live file or claimed server acceptance is generated here.
describe("226 A06/F02 source-locked file transport", () => {
  test("26 source schemas each have exactly one frozen route and codec", () => {
    const ids = Object.keys(SfFiles.operations)
    expect(ids.length).toBe(26)
    expect(new Set(ids).size).toBe(26)
    for (const id of ids) {
      expect(SfOperationRegistry[id as keyof typeof SfOperationRegistry]).toBeDefined()
      expect(SfFilesOperationBindings[id as keyof typeof SfFilesOperationBindings]).toBeDefined()
    }
  })

  test("source byte producers have byte-only mode; no implicit URL or extra byte route", () => {
    const ids = Object.keys(SfFiles.operations).filter((id) =>
      sfIsByteOperation(id as keyof typeof SfFiles.operations))
    expect(ids.sort()).toEqual([
      "files.asset.download", "files.export.json", "files.export.members", "files.export.register",
      "files.export.suppliers", "files.export.xlsx",
    ])
    for (const id of ids) {
      expect(SfOperationRegistry[id as keyof typeof SfOperationRegistry].responseMode).toBe("bytes")
      expect(SfFilesOperationBindings[id as keyof typeof SfFilesOperationBindings]!.decodeOutput({})).toEqual({ status: "invalid" })
    }
    expect(sfIsByteOperation("files.asset.link")).toBe(false)
    expect(SF_FILE_BYTE_LIMIT).toBe(32 * 1024 * 1024)
  })

  test("original import nesting/false and asset zero version survive JSON metadata binding", () => {
    const admitted = SfFilesOperationBindings["files.import-admit"]!.decodeInput({
      surface: "planner", selectionRef: "selection-1",
      options: { newVersion: false, removeMissing: false, preview: {} },
      fileName: "budget.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(admitted.value).toHaveProperty("options.newVersion", false)
    expect(admitted.value).toHaveProperty("options.removeMissing", false)
    const asset = SfFilesOperationBindings["files.asset.upload"]!.decodeInput({
      surface: "dashboard", upload: "contract", record: "contract-1",
      recordVersion: 0, name: "evidence.pdf", page: "Vendor Contracts",
      mediaType: "application/pdf",
    })
    expect(asset.status).toBe("ok")
    if (asset.status !== "ok") return
    expect(asset.value).toHaveProperty("recordVersion", 0)
  })

  test("untrusted URL/path/header and duplicate ref fields cannot enter wire codec", () => {
    const codec = SfFilesOperationBindings["files.asset.link"]!
    expect(codec.decodeInput({ surface: "dashboard", assetId: "a", url: "https://evil.invalid" }))
      .toEqual({ status: "invalid" })
    expect(codec.decodeInput({ surface: "dashboard", assetId: "a", headers: { Cookie: "bad" } }))
      .toEqual({ status: "invalid" })
    expect(sfFilesSourceQuery("files.asset.link", { assetId: "" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.download", { assetId: "a", expires: 0, signature: "x" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.upload", { upload: "supplier", record: "s",
      recordVersion: -1, name: "x.pdf", page: "Suppliers" })).toBeUndefined()
    expect(sfFilesSourceQuery("files.asset.link", { assetId: "a" })).toEqual({ "asset-link": "a" })
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
    expect(sfAllowedByteMime("files.export.suppliers", "text/csv; charset=utf-8")).toBe(true)
    expect(sfAllowedByteMime("files.asset.download", "application/pdf")).toBe(true)
    expect(sfAllowedByteMime("files.export.json", "text/html")).toBe(false)
    expect(sfAllowedByteMime("files.asset.download", "text/html")).toBe(false)
    expect(sfAllowedByteMime("files.asset.download", "application/javascript")).toBe(false)
    expect(sfAllowedByteMime("files.import-admit", "application/pdf")).toBe(false)
  })
})
