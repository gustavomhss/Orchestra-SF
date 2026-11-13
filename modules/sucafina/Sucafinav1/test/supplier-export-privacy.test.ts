import { expect, test } from "bun:test"
import type { Snapshot } from "../runtime/contract.ts"
import { download } from "../runtime/downloads.ts"
import { seal } from "../src/supplier.ts"

const bankKey = new Uint8Array(32).fill(9)
const iban = "PLAINTEXT-IBAN-GB00"
const account = "PLAINTEXT-ACCOUNT-9988"
const swift = "PLAINTEXT-SWIFT-BIC"
const bankName = "PRIVATE-BANK-NAME"
const accountHolder = "PRIVATE-ACCOUNT-HOLDER"
const bankCountry = "PRIVATE-BANK-COUNTRY"
const sealedIban = seal(iban, bankKey)
const sealedAccount = seal(account, bankKey)
const secretMarkers = [
  iban,
  account,
  swift,
  bankName,
  accountHolder,
  bankCountry,
  sealedIban,
  sealedAccount,
  "HISTORY-IBAN-LEAK",
  "STATUS-FILTER-BANK",
  "ID-FILTER-BANK",
  "NAN-FILTER-BANK",
  "DROPPED-NO-STATUS",
  "DROPPED-BAD-ID",
  "DROPPED-NAN-ID",
]
const ordinaryHeaders = [
  "number",
  "status",
  "legalName",
  "tradingName",
  "type",
  "country",
  "address",
  "taxId",
  "regNo",
  "categories",
  "contactName",
  "contactEmail",
  "contactPhone",
  "financeEmail",
  "paymentTerms",
  "currency",
  "incoterm",
  "riskRating",
  "dueDiligence",
  "sanctionsDate",
  "nda",
  "dpa",
  "certifications",
  "validatedBy",
  "validatedAt",
]
const ordinaryCells = [
  "SUP-77",
  "active",
  `'=Acme "Quoted"`,
  "Acme Trading",
  "producer",
  "CH",
  "Rue 1",
  "CHE-PRIV-1",
  "REG-1",
  "Green beans; Bulk, raw",
  "Ada Buyer",
  "ada@mill.test",
  "'+41000000000",
  "finance@mill.test",
  "Net 30",
  "USD",
  "FOB",
  "Low",
  "Yes",
  "2026-11-01",
  "No",
  "Yes",
  "Organic",
  "cio",
  "2026-11-02",
]
const incotermAt = ordinaryHeaders.indexOf("incoterm") + 1
const privilegedHeaders = [
  ...ordinaryHeaders.slice(0, incotermAt),
  "bankName",
  "accountHolder",
  "bankCountry",
  ...ordinaryHeaders.slice(incotermAt),
  "id",
  "iban",
  "swift",
  "account",
]
const privilegedCells = [
  ...ordinaryCells.slice(0, incotermAt),
  bankName,
  accountHolder,
  bankCountry,
  ...ordinaryCells.slice(incotermAt),
  "sup-kept",
  iban,
  swift,
  account,
]
const snapshot: Snapshot = {
  data: {
    store: {
      suppliers: [
        { id: "sup-dropped-status", legalName: "DROPPED-NO-STATUS", bankName: "STATUS-FILTER-BANK" },
        { status: "active", legalName: "DROPPED-BAD-ID", bankName: "ID-FILTER-BANK" },
        { id: Number.NaN, status: "active", legalName: "DROPPED-NAN-ID", bankName: "NAN-FILTER-BANK" },
        {
          id: "sup-kept",
          status: "active",
          number: "SUP-77",
          legalName: '=Acme "Quoted"',
          tradingName: "Acme Trading",
          type: "producer",
          country: "CH",
          address: "Rue 1",
          taxId: "CHE-PRIV-1",
          regNo: "REG-1",
          categories: ["Green beans", "Bulk, raw"],
          contactName: "Ada Buyer",
          contactEmail: "ada@mill.test",
          contactPhone: "+41000000000",
          financeEmail: "finance@mill.test",
          paymentTerms: "Net 30",
          currency: "USD",
          incoterm: "FOB",
          riskRating: "Low",
          dueDiligence: true,
          sanctionsDate: "2026-11-01",
          nda: false,
          dpa: true,
          certifications: ["Organic"],
          validatedBy: "cio",
          validatedAt: "2026-11-02",
          bankName,
          accountHolder,
          bankCountry,
          swift,
          iban: sealedIban,
          account: sealedAccount,
          history: [{ field: "iban", oldValue: "HISTORY-IBAN-LEAK" }],
        },
      ],
    },
  },
  versions: {},
  sequences: {},
  audit: [],
  notices: [],
}

async function supplierDownload(roles: readonly string[], withKey = true) {
  return download(
    "suppliers",
    structuredClone(snapshot),
    { id: "export-actor", canWrite: true, roles: [...roles] },
    {
      at: "2026-11-13T00:00:00Z",
      id: () => "supplier-export",
      directory: [],
      ...(withKey ? { bankKey } : {}),
    },
    new URLSearchParams(),
  )
}

function csvText(result: Awaited<ReturnType<typeof download>>): string {
  if (!result.ok) throw new Error(`expected suppliers csv, got ${result.status}`)
  return new TextDecoder().decode(result.bytes)
}

test("authorized nonprivileged supplier readers export no bank headers or values", async () => {
  for (const role of ["buyer", "viewer", "requester", "approver"]) {
    const text = csvText(await supplierDownload([role]))
    expect(parseCsv(text)[0]).toEqual(ordinaryHeaders)
    for (const marker of secretMarkers) expect(text).not.toContain(marker)
  }
  const withoutKey = csvText(await supplierDownload(["buyer"], false))
  expect(parseCsv(withoutKey)[0]).toEqual(ordinaryHeaders)
  for (const marker of secretMarkers) expect(withoutKey).not.toContain(marker)
})

test("authorized supplier export keeps ordinary fields, escaping, and status or id filtering", async () => {
  const result = await supplierDownload(["buyer"])
  expect(result).toMatchObject({ ok: true, name: "suppliers.csv", type: "text/csv; charset=utf-8" })
  if (!result.ok) return
  expect(parseCsv(new TextDecoder().decode(result.bytes))).toEqual([ordinaryHeaders, ordinaryCells])
})

test("admin and supplier admin exports keep bank fields and require the bank key", async () => {
  for (const role of ["admin", "supplier admin"]) {
    const text = csvText(await supplierDownload([role]))
    expect(parseCsv(text)).toEqual([privilegedHeaders, privilegedCells])
    expect(text).not.toContain(sealedIban)
    expect(text).not.toContain(sealedAccount)
    expect(await supplierDownload([role], false)).toEqual({ ok: false, status: 503 })
  }
})

test("a role outside procurement cannot export suppliers", async () => {
  expect(await supplierDownload(["finance"])).toEqual({ ok: false, status: 403 })
})

function parseCsv(csv: string): string[][] {
  return csv.split("\r\n").filter((line) => line.length > 0).map(parseCsvLine)
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index] ?? ""
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
        continue
      }
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}
