// Diagnostic snapshot only. Never promote this module or its instrumentation.
type SfImportProfileFacts = Readonly<Record<string, string | number | boolean | undefined>>
const requests = new WeakMap<Request, { sequence: number; started: number }>()
const contexts = new WeakMap<object, Request>()
let sequence = 0

/** Correlate original Requests without emitting URLs, cookies, identity or payloads. */
export function sfImportProfile(request: Request | undefined, stage: string, facts: SfImportProfileFacts = {}) {
  if (!request) return
  let observed = requests.get(request)
  if (!observed) {
    if (request.method !== "GET" || new URL(request.url).searchParams.get("sf") !== "import-reference") return
    observed = { sequence: ++sequence, started: performance.now() }
    requests.set(request, observed)
  }
  console.info("SF_IMPORT_PROFILE", JSON.stringify({
    schema: "sf-import-profile-v1", qualification: false,
    source: "97c921ab0054bd5154227593adcbcca56b0538c3", sourceTree: "3f04bc2f32be61ea4596b2d8c008c3f944e5841b",
    request: observed.sequence, stage, at: new Date().toISOString(),
    elapsedMs: Math.round((performance.now() - observed.started) * 1000) / 1000,
    aborted: request.signal.aborted, ...facts,
  }))
}

export function rememberSfImportProfile(context: object, request: Request) {
  if (requests.has(request)) contexts.set(context, request)
}

export function sfImportContextProfile(context: object, stage: string, facts: SfImportProfileFacts = {}) {
  sfImportProfile(contexts.get(context), stage, facts)
}
