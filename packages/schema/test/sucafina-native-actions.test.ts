import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Sucafina } from "../src/sucafina"

const page = {
  surface: "procurement",
  page: "Purchase Requests",
  pages: ["Purchase Requests"],
  actor: { id: "reader", name: "Reader", canWrite: false, roles: [], assigned: [], domains: [] },
  year: 2026,
  month: 3,
  data: { visible: "authorized projection" },
  versions: { "requests:r1": { version: 7, by: "prior-editor" } },
  directory: [{ id: "reader", name: "Reader" }],
} satisfies Sucafina.PageState
const text = { en: "Description", br: "Descrição" }
const field = { kind: "text", path: ["description"], label: text } satisfies Sucafina.NativeScalar
const command = {
  page: "Purchase Requests", action: "save-request", id: "r1", version: 7,
  values: { description: "Keep", quotes: [{ supplier: "s1", selected: false, amount: 0 }] },
  confirmed: false,
}
const action = {
  key: "request-r1", label: { en: "Edit request", br: "Editar solicitação" },
  command, fields: [field],
}
const decode = Schema.decodeUnknownSync(Sucafina.PageState)

test("PageState retains complete nested action descriptors and literal command defaults", () => {
  const actions = [{
    ...action,
    group: { en: "Requests", br: "Solicitações" },
    target: { collection: "requests", id: "r1" },
    confirm: { en: "Save these changes?", br: "Salvar estas alterações?" },
    danger: false,
    fields: [{
      kind: "group", label: { en: "Request", br: "Solicitação" },
      fields: [
        { ...field, required: true, readOnly: false, blank: "omit" },
        { kind: "textarea", path: ["notes"], label: text, blank: "empty" },
        { kind: "date", path: ["delivery"], label: text, blank: "null" },
        { kind: "number", path: ["totals", 0, "amount"], label: text, min: 0, max: 100, step: 0.5 },
        { kind: "checkbox", path: ["approved"], label: text, readOnly: true },
        {
          kind: "select", path: ["choice"], label: text,
          options: [
            { value: "s1", label: { en: "Supplier", br: "Fornecedor" } },
            { value: 0, label: { en: "Zero", br: "Zero" } },
            { value: false, label: { en: "No", br: "Não" } },
            { value: null, label: { en: "None", br: "Nenhum" } },
          ],
        },
        {
          kind: "list", path: ["quotes"], label: { en: "Quotes", br: "Cotações" },
          minimum: 0, maximum: 5, remove: true, readOnly: false,
          add: { supplier: "", selected: false, amount: 0, details: { note: null }, tags: [] },
          fields: [{
            kind: "group",
            fields: [
              { kind: "select", path: ["supplier"], label: text, options: [{ value: "s1", label: text }] },
              {
                kind: "list", path: ["owners"], label: { en: "Owners", br: "Responsáveis" },
                fields: [{ kind: "text", path: ["name"], label: text }],
              },
            ],
          }],
        },
      ],
    }],
  }] satisfies Sucafina.NativeAction[]
  const decoded = decode({ ...page, actions })
  expect(Reflect.get(decoded, "actions")).toEqual(actions)
  expect(decoded).toEqual({ ...page, actions })
})

test("PageState accepts omitted and empty actions without changing existing fields", () => {
  const decoded = decode(page)
  expect(decoded).toEqual(page)
  expect(Reflect.get(decoded, "actions")).toBeUndefined()
  expect(Reflect.get(decode({ ...page, actions: [] }), "actions")).toEqual([])
})

test("all scalar kinds and explicit blank modes survive PageState decoding", () => {
  const actions = [{ ...action, fields: [
    { ...field, blank: "omit" },
    { kind: "textarea", path: ["notes"], label: text, blank: "empty" },
    { kind: "number", path: ["amount"], label: text, blank: "null", min: -10, max: 10, step: 0.25 },
    { kind: "date", path: ["date"], label: text },
    { kind: "select", path: ["choice"], label: text, options: [] },
    { kind: "checkbox", path: ["checked"], label: text, required: false, readOnly: true },
  ] }] satisfies Sucafina.NativeAction[]
  expect(Reflect.get(decode({ ...page, actions }), "actions")).toEqual(actions)
})

test("paths reject empty, unsafe, noninteger, negative and malformed segments", () => {
  for (const path of [
    [], ["__proto__"], ["safe", "prototype"], ["rows", 0, "constructor"],
    [-1], [0.5], [9007199254740992], [true], [null], [{}], "description", null,
  ]) {
    expect(() => decode({ ...page, actions: [{ ...action, fields: [{ ...field, path }] }] }), JSON.stringify(path)).toThrow()
    expect(() => decode({ ...page, actions: [{ ...action, fields: [{ kind: "list", path, label: text, fields: [field] }] }] }), JSON.stringify(path)).toThrow()
  }
})

test("malformed recursive fields and scalar metadata are rejected", () => {
  for (const invalid of [
    null, "field", { ...field, kind: "script" },
    { kind: "text", label: text }, { kind: "text", path: ["name"] },
    { ...field, required: "true" }, { ...field, readOnly: 1 }, { ...field, blank: "zero" },
    { ...field, min: "0" }, { ...field, max: false }, { ...field, step: "1" },
    { kind: "group" }, { kind: "group", fields: "fields" },
    { kind: "group", fields: [{ ...field, path: ["constructor"] }] },
    { kind: "list", path: ["rows"], label: text },
    { kind: "list", path: ["rows"], label: text, fields: [null] },
    { kind: "list", path: ["rows"], label: text, fields: [field], add: [] },
    { kind: "list", path: ["rows"], label: text, fields: [field], add: "row" },
    { kind: "list", path: ["rows"], label: text, fields: [field], remove: "true" },
    { kind: "list", path: ["rows"], label: text, fields: [field], minimum: "0" },
    { kind: "list", path: ["rows"], label: text, fields: [field], maximum: false },
  ]) {
    expect(() => decode({ ...page, actions: [{ ...action, fields: [invalid] }] }), JSON.stringify(invalid)).toThrow()
  }
})

test("choices accept only scalar values and complete bilingual labels", () => {
  for (const options of [
    "choices", null, [null], [{ value: {}, label: text }], [{ value: [], label: text }],
    [{ label: text }], [{ value: "s1", label: { en: "Only English" } }],
    [{ value: "s1", label: { en: "Supplier", br: 1 } }],
  ]) {
    expect(() => decode({ ...page, actions: [{ ...action, fields: [{ kind: "select", path: ["supplier"], label: text, options }] }] }), JSON.stringify(options)).toThrow()
  }
})

test("action, field, group, list and confirmation copy requires both languages", () => {
  for (const label of [{ en: "English only" }, { br: "Somente português" }, { en: "English", br: false }, "Label"]) {
    for (const invalid of [
      { ...action, label }, { ...action, group: label }, { ...action, confirm: label },
      { ...action, fields: [{ ...field, label }] },
      { ...action, fields: [{ kind: "group", label, fields: [field] }] },
      { ...action, fields: [{ kind: "list", path: ["rows"], label, fields: [field] }] },
    ]) expect(() => decode({ ...page, actions: [invalid] }), JSON.stringify(invalid)).toThrow()
  }
})

test("malformed action containers, targets and descriptor properties are rejected", () => {
  for (const actions of [null, {}, [null], [{ ...action, key: 1 }], [{ ...action, danger: "true" }],
    [{ ...action, target: { collection: "requests", id: 1 } }],
    [{ ...action, target: { id: "r1" } }], [{ ...action, fields: null }], [{ ...action, command: null }],
  ]) expect(() => decode({ ...page, actions }), JSON.stringify(actions)).toThrow()
})

test("action keys remain unique within the page", () => {
  const actions = [action, { ...action, key: "request-r2", target: { collection: "requests", id: "r2" } }]
  expect(Reflect.get(decode({ ...page, actions }), "actions")).toEqual(actions)
  expect(() => decode({ ...page, actions: [action, { ...action }] })).toThrow()
})

test("actions retain the existing Command schema invariants", () => {
  for (const invalid of [
    { action: "save", version: 1, values: {} },
    { ...command, page: 1 }, { ...command, action: false }, { ...command, id: 1 },
    { page: "Purchase Requests", action: "save", values: {} },
    { ...command, version: "7" }, { ...command, version: 0.5 },
    { ...command, values: [] }, { ...command, values: null }, { ...command, confirmed: "yes" },
  ]) {
    expect(() => Schema.decodeUnknownSync(Sucafina.Command)(invalid), JSON.stringify(invalid)).toThrow()
    expect(() => decode({ ...page, actions: [{ ...action, command: invalid }] }), JSON.stringify(invalid)).toThrow()
  }
  expect(Schema.decodeUnknownSync(Sucafina.Command)(command)).toEqual(command)
})

test("action key, label, command and fields are required while empty fields are valid", () => {
  for (const key of ["key", "label", "command", "fields"]) {
    const incomplete = Object.fromEntries(Object.entries(action).filter(([name]) => name !== key))
    expect(() => decode({ ...page, actions: [incomplete] }), `missing ${key}`).toThrow()
  }
  const actions = [{ ...action, fields: [] }]
  expect(Reflect.get(decode({ ...page, actions }), "actions")).toEqual(actions)
})

test("embedded minimal commands preserve optional fields and all existing integer versions", () => {
  for (const version of [7, 0, -1]) {
    const minimal = { page: "Purchase Requests", action: "save-request", version, values: {} }
    expect(Schema.decodeUnknownSync(Sucafina.Command)(minimal)).toEqual(minimal)
    const actions = [{ ...action, command: minimal }]
    expect(Reflect.get(decode({ ...page, actions }), "actions")).toEqual(actions)
  }
})
