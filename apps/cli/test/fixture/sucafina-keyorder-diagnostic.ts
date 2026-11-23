// Fixture-only mechanical key-order experiment. No canonical bytes, object
// identities, grants or domain values are retained. Bootstrap intrinsics have
// the same trust limitation as the existing canonical capture proof.
const originalObject = Object
const originalKeys = Object.keys
const originalArrayPrototype = Array.prototype
const originalSort = Array.prototype.sort
const property = Object.getOwnPropertyDescriptor
const own = Object.hasOwn
const define = Object.defineProperty
const apply = Reflect.apply
const originalMap = Map
const get = Map.prototype.get
const set = Map.prototype.set
const clear = Map.prototype.clear

type Shape = { input: string[]; output: string[]; units: number }
const shapes = new originalMap<number, Shape>()
const maximumKeys = 64, maximumUnits = 65536
let retainedUnits = 0
const totals = { calls: 0, fallback: 0, ordered: 0, hit: 0, miss: 0, refused: 0, clears: 0 }

function data(owner: object, key: PropertyKey, expected: unknown) {
  const descriptor = property(owner, key)
  return !!descriptor && own(descriptor, "value") && descriptor.value === expected
}

export function sfCanonicalKeyOrderDiagnostic(record: Record<string, unknown>, memo: boolean): string[] {
  totals.calls++
  const owner = Object
  if (owner !== originalObject || !data(owner, "keys", originalKeys)) {
    totals.fallback++
    return owner.keys(record).sort()
  }
  // The original native call retains every input Proxy ownKeys/descriptor trap.
  const keys = owner.keys(record)
  if (!data(originalArrayPrototype, "sort", originalSort)) {
    totals.fallback++
    return keys.sort()
  }
  // Keep the original method Get. Native Object.keys returned this private,
  // fresh, dense array of primitive strings; no caller has observed it yet.
  const sort = keys.sort
  if (!memo) {
    for (let index = 1; index < keys.length; index++) {
      if (keys[index - 1]! > keys[index]!) return apply(sort, keys, [])
    }
    totals.ordered++
    return keys
  }
  if (keys.length < 2 || keys.length > maximumKeys) {
    totals.refused++
    return apply(sort, keys, [])
  }
  const saved: Shape | undefined = apply(get, shapes, [keys.length])
  if (saved) {
    let matches = true
    for (let index = 0; index < keys.length; index++) {
      if (keys[index] !== saved.input[index]) { matches = false; break }
    }
    if (matches) {
      totals.hit++
      for (let index = 0; index < keys.length; index++) keys[index] = saved.output[index]!
      return keys
    }
  }
  totals.miss++
  let units = 0
  for (let index = 0; index < keys.length; index++) {
    units += keys[index]!.length * 2
    if (units > maximumUnits) {
      totals.refused++
      return apply(sort, keys, [])
    }
  }
  // Define own indices: inherited setters and array species must never see
  // private memo arrays. Do not retain keys, since map hooks may observe it.
  const input: string[] = [], output: string[] = []
  for (let index = 0; index < keys.length; index++)
    define(input, index, { value: keys[index], enumerable: true, writable: true, configurable: true })
  const sorted: string[] = apply(sort, keys, [])
  for (let index = 0; index < keys.length; index++)
    define(output, index, { value: sorted[index], enumerable: true, writable: true, configurable: true })
  if (retainedUnits - (saved?.units ?? 0) > maximumUnits - units) {
    apply(clear, shapes, [])
    retainedUnits = 0
    totals.clears++
  } else retainedUnits -= saved?.units ?? 0
  apply(set, shapes, [keys.length, { input, output, units }])
  retainedUnits += units
  return sorted
}

export function sfCanonicalKeyOrderDiagnosticState() {
  return { ...totals, retainedUnits, maximumKeys, maximumUnits }
}

export function resetSfCanonicalKeyOrderDiagnostic() {
  apply(clear, shapes, [])
  retainedUnits = 0
  totals.calls = 0
  totals.fallback = 0
  totals.ordered = 0
  totals.hit = 0
  totals.miss = 0
  totals.refused = 0
  totals.clears = 0
}
