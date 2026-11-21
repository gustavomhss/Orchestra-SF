#!/usr/bin/env node

import { readFile } from "node:fs/promises"

try {
  const connection = JSON.parse(await readFile(new URL("./pending-connection.local.json", import.meta.url), "utf8"))
  const url = new URL(connection.url)
  if (typeof connection.url !== "string" || url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || !url.pathname.endsWith("/api/claw/mcp") || typeof connection.token !== "string" ||
      !/^[0-9a-f]{64}$/.test(connection.token)) throw new Error("Invalid private connection")
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${connection.token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: "sf_pendencias", arguments: {} },
    }),
  })
  if (!response.ok) throw new Error("Snapshot do SF indisponível")
  const { result } = await response.json()
  const text = result?.content?.find((entry) => entry.type === "text")?.text
  if (result?.isError || typeof text !== "string") throw new Error("Snapshot do SF indisponível")
  const snapshot = JSON.parse(text)
  if (snapshot.status !== "ok" || !/^[a-f0-9]{64}$/.test(snapshot.fingerprint)) {
    throw new Error("Resposta de snapshot do SF inválida")
  }
  console.log(snapshot.fingerprint)
} catch {
  console.error("Snapshot do SF indisponível")
  process.exitCode = 1
}
