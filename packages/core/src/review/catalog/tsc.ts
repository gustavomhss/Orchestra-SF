// Build-lane typecheck (plan 5.1). The host invokes the project's own tsc. No pin: nothing is fetched.
// Deep-only, and deep.built stays false, so a governed review lists this pack not examined (R3).
export const tsc = {
  pack: {
    id: "tsc",
    tool: "tsc",
    version: "project",
    licence: "invoke",
    backend: "path",
    languages: ["js-ts"],
    detection: {
      manifests: ["tsconfig.json"],
      extensions: [".ts", ".tsx", ".mts", ".cts"],
      absent: [],
    },
    lane: "build",
    tiers: ["deep"],
    output: { format: "json", parser: "tsc" },
    cost: "high",
    network: { kind: "none" },
    scratchWrites: true,
    template: "tsc-noemit",
    lenses: ["correctness-logic"],
    status: "probation",
  },
} as const
