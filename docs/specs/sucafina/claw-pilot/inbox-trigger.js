const read = await exec({ command: "/ABSOLUTE/PATH/TO/read-pending.mjs" })
const fingerprint = (read.aggregated ?? read.stdout ?? "").trim()
if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Snapshot do SF indisponível")

const changed = trigger.state?.fingerprint !== undefined && trigger.state.fingerprint !== fingerprint
json({
  fire: changed,
  ...(changed ? { message: "As pendências mudaram. Leia o snapshot atual do SF e investigue a mudança." } : {}),
  state: { fingerprint },
})
