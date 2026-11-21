// Supplier. Quem valida é o papel, não o holder do level 1. IBAN não sai em claro fora de supplier admin e admin.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ACTIVATE = ["legalName", "country", "address", "contactEmail", "paymentTerms", "riskRating", "sanctionsDate"] as const

export type BankSupplier = {
  id: string
  status: string
  createdBy?: string
  legalName?: string
  country?: string
  address?: string
  taxId?: string
  regNo?: string
  contactEmail?: string
  paymentTerms?: string
  riskRating?: string
  dueDiligence?: boolean
  sanctionsDate?: string
  iban?: string
  account?: string
  bankName?: string
  swift?: string
  validatedBy?: string | null
  validatedAt?: string | null
  history?: { field: string }[]
  recognized?: string
}

export function seal(plain: string, key: Uint8Array): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, body]).toString("base64")
}

export function open(sealed: string, key: Uint8Array): string {
  const raw = Buffer.from(sealed, "base64")
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const body = raw.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
}

export function presentSupplier(supplier: BankSupplier, actor: { roles: string[] }, key: Uint8Array): BankSupplier {
  if (privileged(actor)) {
    return {
      ...supplier,
      iban: supplier.iban ? open(supplier.iban, key) : supplier.iban,
      account: supplier.account ? open(supplier.account, key) : supplier.account,
    }
  }
  const restricted = ["iban", "account", "bankname", "swift", "accountholder", "bankcountry", "history"]
  const visible = Object.fromEntries(Object.entries(supplier).filter(([field]) => !restricted.includes(field.toLowerCase()))) as BankSupplier
  return { ...visible, iban: "masked", account: "masked" }
}

export function supplierCsv(suppliers: BankSupplier[], actor: { roles: string[] }, key: Uint8Array): Record<string, string>[] {
  return suppliers.map((supplier) => {
    const row: Record<string, string> = { id: supplier.id, legalName: supplier.legalName ?? "" }
    if (!privileged(actor)) return row
    return {
      ...row,
      iban: supplier.iban ? open(supplier.iban, key) : "",
      swift: supplier.swift ?? "",
      account: supplier.account ? open(supplier.account, key) : "",
    }
  })
}

export function activateSupplier(
  supplier: BankSupplier,
  actor: { id: string; canWrite: boolean; roles: string[] },
  others: BankSupplier[],
  blockSelfApproval: boolean,
): { ok: true; supplier: BankSupplier; warning: string | null } | { ok: false } {
  if (!actor.canWrite) return { ok: false }
  if (!actor.roles.includes("supplier admin") && !actor.roles.includes("admin")) return { ok: false }
  if (blockSelfApproval && supplier.createdBy === actor.id) return { ok: false }
  if (!canActivate(supplier)) return { ok: false }
  if (supplier.taxId && others.some((item) => item.id !== supplier.id && item.taxId === supplier.taxId)) return { ok: false }
  const duplicateName = supplier.legalName && others.some((item) => item.id !== supplier.id && item.legalName === supplier.legalName)
  return {
    ok: true,
    warning: duplicateName ? supplier.legalName ?? null : null,
    supplier: { ...supplier, status: "active", recognized: duplicateName ? "legalName" : undefined },
  }
}

export function changeBank(supplier: BankSupplier, field: "iban" | "account", value: string, actor: { canWrite: boolean; roles: string[] }, key: Uint8Array): { ok: true; supplier: BankSupplier } | { ok: false } {
  if (!actor.canWrite || !actor.roles.includes("supplier admin")) return { ok: false }
  const current = supplier[field] ? open(supplier[field], key) : ""
  if (supplier.status !== "active" || current === value) {
    return { ok: true, supplier: { ...supplier, [field]: current === value && supplier[field] ? supplier[field] : seal(value, key) } }
  }
  const sealed = seal(value, key)
  return {
    ok: true,
    supplier: {
      ...supplier,
      [field]: sealed,
      status: "pending",
      validatedBy: null,
      validatedAt: null,
      history: [...(supplier.history ?? []), { field }],
    },
  }
}

function privileged(actor: { roles: string[] }): boolean {
  return actor.roles.includes("admin") || actor.roles.includes("supplier admin")
}

export function supplierActivationRequirements(supplier: BankSupplier): string[] {
  return [
    ...ACTIVATE.filter((field) => !supplier[field]),
    ...(supplier.dueDiligence === true ? [] : ["dueDiligence"]),
    ...(supplier.taxId || supplier.regNo ? [] : ["taxId or regNo"]),
    ...(supplier.iban || supplier.bankName ? [] : ["iban or bankName"]),
  ]
}

function canActivate(supplier: BankSupplier): boolean {
  return supplierActivationRequirements(supplier).length === 0
}
