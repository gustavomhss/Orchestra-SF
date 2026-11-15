import { describe, expect, test } from "bun:test"
import {
  SF_DOMAIN_PAGES, projectSfDomainData, projectSfDomainVersions,
} from "../../../../../apps/cli/src/sucafina-product/native-ui/domain/projection.ts"

describe("A01 domain source projection — source-boundary qualification", () => {
  test("maps all ten frozen dashboard capabilities to the original page identifiers", () => {
    expect(SF_DOMAIN_PAGES).toEqual({
      CAP01: "Executive Dashboard",
      CAP03: "Budget Overview",
      CAP04: "OPEX Detail",
      CAP05: "CAPEX Projects",
      CAP09: "Portfolio Dashboard",
      CAP10: "All Projects",
      CAP13: "IT Risks",
      CAP14: "Vendor Contracts",
      CAP15: "Stakeholder Management",
      CAP16: "IT Performance Contract",
    })
  })

  test("preserves recorded zero, explicit null, missing fields, nested IDs and removes private metadata", () => {
    const input = {
      projects: [
        {
          id: "p", name: "Migration", budget: 0, spent: null,
          watch: false, privateSalary: 65000,
          milestones: [
            { id: "m1", name: "Phase 1", status: "upcoming", notes: "", secret: "secret" },
            { id: "m2", name: "Phase 2", status: "done" },
          ],
        },
      ],
      tokens: ["never-release"],
    }
    const projected = projectSfDomainData("CAP10", input, 2026)
    expect(projected).toEqual({ projects: [
      {
        id: "p", name: "Migration", budget: 0, spent: null, watch: false,
        milestones: [
          { id: "m1", name: "Phase 1", status: "upcoming", notes: "" },
          { id: "m2", name: "Phase 2", status: "done" },
        ],
      },
    ] })
    expect(JSON.stringify(projected)).not.toContain("65000")
    expect(JSON.stringify(projected)).not.toContain("secret")
    expect(projectSfDomainData("CAP10", {}, 2026)).toBeUndefined()
    expect(projectSfDomainData("CAP10", { projects: [] }, 2026)).toEqual({ projects: [] })
  })

  test("contract documents expose only names/status/size; not private store blob paths", () => {
    const projected = projectSfDomainData("CAP14", {
      contracts: [{
        id: "c1", vendor: "Acme", amount: 0, currency: "BRL",
        bankAccount: "private", notes: null, docs: [
          { id: "asset1", name: "Contract", status: "clean", key: "private/path", added: "2026-11-15", scanRaw: "private" },
        ],
      }],
    }, 2026)
    expect(projected).toEqual({ contracts: [{
      id: "c1", vendor: "Acme", amount: 0, currency: "BRL", notes: null,
      docs: [{ id: "asset1", name: "Contract", status: "clean", added: "2026-11-15" }],
    }] })
    expect(JSON.stringify(projected)).not.toContain("private")
  })

  test("performance maintains original item/subitem IDs without exposing extra private fields", () => {
    const projected = projectSfDomainData("CAP16", {
      itperf: { name: "IT", year: 2026, confidential: 75000,
        items: [{ id: "i-1", name: "Quality", totalWeight: 0,
          subs: [{ id: "s-1", label: "Reliability", score: null, status: "behind", secretRate: 123 }],
        }],
      },
    }, 2026)
    expect(projected).toEqual({ itperf: { name: "IT", year: 2026,
      items: [{ id: "i-1", name: "Quality", totalWeight: 0,
        subs: [{ id: "s-1", label: "Reliability", score: null, status: "behind" }],
      }],
    } })
  })

  test("financial derivations run only on the server with complete source arrays", () => {
    const unavailable = projectSfDomainData("CAP01", { opexOwners: [{ id: "o", budget: 1200 }] }, 2026)
    expect(unavailable).toEqual({})
    const complete = projectSfDomainData("CAP03", {
      opexOwners: [{ id: "o", budget: 1200 }],
      opexEntries: [{ id: "m", ownerId: "o", year: 2026, month: 1, budget: 0, actual: 30, forecast: 40 }],
      capexProjects: [], capexEntries: [],
    }, 2026)
    expect(complete).toEqual({ totals: {
      opexBudget: 1200, opexActual: 30, opexForecast: 40,
      capexBudget: 0, capexActual: 0, capexForecast: 0,
      totalBudget: 1200, totalActual: 30, totalForecast: 40,
    } })
  })

  test("OPEX and CAPEX projections keep original month numbers and line-specific budget views", () => {
    const view = {
      opexOwners: [{ id: "o", name: "OPEX", budget: 0 }],
      capexProjects: [{ id: "c", name: "CAPEX", budget: 90 }],
      opexEntries: [{ id: "e", ownerId: "o", year: 2026, month: 12, actual: 0, forecast: null }],
      capexEntries: [{ id: "f", projId: "c", year: 2026, month: 1, actual: 1 }],
      budgetLineIds: ["opexOwners:o", "capexProjects:c"],
      deviations: { "opex-o-2026-12": { flag: "dev-red", text: "" },
        "capex-c-2026-1": { flag: "dev-green", text: "" } },
    }
    expect(projectSfDomainData("CAP04", view, 2026)).toEqual({
      opexOwners: [{ id: "o", name: "OPEX", budget: 0 }],
      opexEntries: [{ id: "e", ownerId: "o", year: 2026, month: 12, actual: 0, forecast: null }],
      budgetLineIds: ["opexOwners:o"], deviations: { "opex-o-2026-12": { flag: "dev-red", text: "" } },
    })
    expect(projectSfDomainData("CAP05", view, 2026)).toEqual({
      capexProjects: [{ id: "c", name: "CAPEX", budget: 90 }],
      capexEntries: [{ id: "f", projId: "c", year: 2026, month: 1, actual: 1 }],
      budgetLineIds: ["capexProjects:c"], deviations: { "capex-c-2026-1": { flag: "dev-green", text: "" } },
    })
  })

  test("version CAS is exposed only for matching source collections, never actor or private versions", () => {
    const versions = {
      "opexOwners:o": { version: 2, by: "principal-A" },
      "deviations:opex-o-2026-12": { version: 3, by: "principal-A" },
      "deviations:capex-c-2026-12": { version: 4, by: "principal-B" },
      "contracts:c": { version: 8, by: "principal-B" },
      "bank:supplier": { version: 100, by: "private" },
      "dataset": { version: 42, by: "system" },
    }
    expect(projectSfDomainVersions("CAP04", versions)).toEqual({
      "opexOwners:o": 2, "deviations:opex-o-2026-12": 3,
    })
    expect(projectSfDomainVersions("CAP14", versions)).toEqual({ "contracts:c": 8 })
    expect(JSON.stringify(projectSfDomainVersions("CAP14", versions))).not.toContain("principal")
    expect(JSON.stringify(projectSfDomainVersions("CAP14", versions))).not.toContain("bank")
  })
})
