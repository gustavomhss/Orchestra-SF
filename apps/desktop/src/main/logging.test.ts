import { expect, test } from "bun:test"
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js"
import { EventEmitter } from "node:events"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { mockElectron } from "./electron-mock.fixture"

test("desktop file logs redact scoped, structured and renderer messages before debug export", async () => {
  const root = await mkdtemp(join(tmpdir(), "desktop-logs-"))
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true,
    isReady: () => true,
    getPath: (name: string) => name === "crashDumps" ? join(root, "crashpad") : root,
    getVersion: () => "0.0.0",
    getName: () => "Orchestra test",
  })
  const contents = Object.assign(new EventEmitter(), { mainFrame: {} })
  mockElectron({
    app,
    ipcMain: new EventEmitter(),
    BrowserWindow: { fromWebContents: () => ({ webContents: contents }) },
    netLog: { currentlyLogging: false },
    shell: { showItemInFolder: () => {} },
  })

  try {
    const { initLogging, write, exportDebugLogs } = await import("./logging")
    const logger = initLogging()
    logger.warn("main http://operator:fixture-password@example.invalid/path")
    write("window", "diagnostic", {
      headers: { authorization: "Bearer fixture-header", password: "fixture 'quoted' password" },
      error: new Error("failed at /event?auth_token=fixture-error&keep=yes"),
    }, "error")
    app.emit("web-contents-created", {}, contents)
    contents.emit("console-message", {
      frame: contents.mainFrame,
      level: "warning",
      message: "renderer /x?auth_token=fixture-renderer&keep=yes",
    })

    const run = dirname(logger.transports.file.getFile().path)
    const main = await readFile(join(run, "main.log"), "utf8")
    const window = await readFile(join(run, "window.log"), "utf8")
    const renderer = await readFile(join(run, "renderer.log"), "utf8")
    expect(main).toContain("[warn] main http://[redacted]@example.invalid/path")
    expect(window).toContain("[error] (window) diagnostic")
    expect(window).toContain("auth_token=[redacted]&keep=yes")
    expect(window).toMatch(/authorization: (['"])\[redacted\]\1/)
    expect(window).toMatch(/password: (['"])\[redacted\]\1/)
    expect(renderer).toContain("renderer /x?auth_token=[redacted]&keep=yes")
    for (const secret of ["fixture-password", "fixture-header", "fixture 'quoted' password", "fixture-error", "fixture-renderer"])
      expect(main + window + renderer).not.toContain(secret)

    await writeFile(join(run, "legacy.log"), "GET /event?auth_token=fixture-legacy&keep=yes")
    const zip = new ZipReader(new BlobReader(Bun.file(await exportDebugLogs())))
    try {
      const entries = await zip.getEntries()
      const legacy = entries.find((entry) => entry.filename.endsWith("/legacy.log"))
      if (!legacy || legacy.directory) throw new Error("Missing legacy log")
      expect(await legacy.getData(new TextWriter())).toBe("GET /event?auth_token=[redacted]&keep=yes")
    } finally {
      await zip.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
