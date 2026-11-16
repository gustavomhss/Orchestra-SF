import { expect, test } from "bun:test"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { downloadTalentMembers } from "../../src/orchestra/chapters/sucafina/people/talent/download"

test("talent download writes the original producer bytes through the platform", async () => {
  const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3])
  const seen: string[] = []
  const transport = { execute: async (operation: { operationId: string }) => {
    seen.push(operation.operationId)
    return { kind: "response", status: 200, body: bytes, headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename*=UTF-8''headcount_export_2026-11-11.xlsx",
    } }
  } } as unknown as SfTransport
  let saved = new Uint8Array()
  let filename = ""
  await downloadTalentMembers({ transport, signal: new AbortController().signal, current: () => true,
    downloadResponse: async (response, name) => {
      filename = name
      saved = new Uint8Array(await response.arrayBuffer())
    },
  })
  expect(seen).toEqual(["files.export.members"])
  expect(filename).toBe("headcount_export_2026-11-11.xlsx")
  expect(saved).toEqual(bytes)
})

test("talent download does not open the platform after owner revocation", async () => {
  let current = true
  let opened = false
  const transport = { execute: async () => {
    current = false
    return { kind: "response", status: 200, body: new Uint8Array([80, 75]), headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } }
  } } as unknown as SfTransport
  await downloadTalentMembers({ transport, signal: new AbortController().signal, current: () => current,
    downloadResponse: async () => { opened = true },
  })
  expect(opened).toBe(false)
})

test("talent platform stream stops between chunks when the owner changes", async () => {
  let current = true
  const transport = { execute: async () => ({ kind: "response", status: 200,
    body: new Uint8Array(128 * 1024), headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } }) } as unknown as SfTransport
  await expect(downloadTalentMembers({ transport, signal: new AbortController().signal, current: () => current,
    downloadResponse: async (response) => {
      const reader = response.body!.getReader()
      expect((await reader.read()).value?.byteLength).toBe(64 * 1024)
      current = false
      await reader.read()
    },
  })).rejects.toThrow()
})
