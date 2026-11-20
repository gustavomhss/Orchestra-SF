/** Read-only Node source for the owned Chromium child. This never launches,
 * warms, signals or waits on a process, and never reads arguments, env or maps. */
export const browserLaunchObservationSource = String.raw`
const launchCounter = (value) => typeof value === "string" && /^[0-9]{1,24}$/.test(value) ? value : undefined
const launchName = (path, limit) => readFileSync(path, "utf8").trim().slice(0, limit).replace(/[^a-zA-Z0-9_.-]/g, "?")
const launchIoPressure = () => {
  if (process.platform !== "linux") return { state: "unsupported" }
  try {
    const text = readFileSync("/proc/pressure/io", "utf8")
    return Object.fromEntries(["some", "full"].map((name) => [
      name, launchCounter(new RegExp("^" + name + " .*total=([0-9]+)$", "m").exec(text)?.[1]),
    ]))
  } catch { return { state: "unavailable" } }
}
const launchChildObservation = (id, parent) => {
  const started = performance.now()
  try {
    const raw = readFileSync("/proc/" + id + "/stat", "utf8")
    const end = raw.lastIndexOf(")")
    if (end < 0) return { state: "invalid-stat" }
    const stat = raw.slice(end + 2).trim().split(/\s+/)
    if (Number(stat[1]) !== parent) return { state: "parent-changed" }
    const io = readFileSync("/proc/" + id + "/io", "utf8")
    const tids = readdirSync("/proc/" + id + "/task").filter((value) => /^[1-9][0-9]{0,9}$/.test(value)).sort((a, b) => Number(a) - Number(b))
    const tasks = tids.slice(0, 16).map((tid) => {
      try {
        return { tid: Number(tid), name: launchName("/proc/" + id + "/task/" + tid + "/comm", 32),
          wait: launchName("/proc/" + id + "/task/" + tid + "/wchan", 64) }
      } catch { return { tid: Number(tid), state: "exited-during-observation" } }
    })
    return {
      state: "observed", stat: { minflt: launchCounter(stat[7]), majflt: launchCounter(stat[9]),
        utimeTicks: launchCounter(stat[11]), stimeTicks: launchCounter(stat[12]), starttimeTicks: launchCounter(stat[19]) },
      io: Object.fromEntries(["rchar", "read_bytes", "syscr"].map((name) => [
        name, launchCounter(new RegExp("^" + name + ":\\s+([0-9]+)$", "m").exec(io)?.[1]),
      ])),
      threadCount: tids.length, tasks, observationMs: Math.round((performance.now() - started) * 1000) / 1000,
    }
  } catch { return { state: "unavailable", observationMs: Math.round((performance.now() - started) * 1000) / 1000 } }
}
const launchChildren = (detailed) => {
  const children = []
  let sampled = false
  if (process.platform !== "linux") return children
  try {
    const ids = readFileSync("/proc/" + process.pid + "/task/" + process.pid + "/children", "utf8").trim().split(/\s+/).filter(Boolean).slice(0, 8)
    for (const id of ids) {
      try {
        const status = readFileSync("/proc/" + id + "/status", "utf8")
        const parent = Number(/^PPid:\s+(\d+)/m.exec(status)?.[1])
        if (parent !== process.pid) continue
        const name = readFileSync("/proc/" + id + "/comm", "utf8").trim()
        const observation = detailed && !sampled && name === "chrome" ? launchChildObservation(id, parent) : undefined
        if (observation) sampled = true
        children.push({ pid: Number(id), parent, name, state: /^State:\s+([^\n]+)/m.exec(status)?.[1],
          wait: readFileSync("/proc/" + id + "/wchan", "utf8").trim(), ...(observation ? { observation } : {}) })
      } catch { children.push({ pid: Number(id), state: "exited-during-observation" }) }
    }
  } catch { children.push({ state: "process-observation-unavailable" }) }
  return children
}
`
