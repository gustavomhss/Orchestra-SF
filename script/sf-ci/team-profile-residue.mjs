// G09 inventories every tracked byte and actual packed member. The shipped
// catalog is diagnostic; qualification additionally requires exact independent
// review and executed controls/obligations from the current hosted source/run.
import { createHash, createPublicKey, verify } from "node:crypto"
import { lstat, readFile, readlink, realpath, writeFile } from "node:fs/promises"
import { builtinModules } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"
import ts from "typescript"

const fail = (message) => { throw new Error("TEAM_PROFILE_RESIDUE_FAIL_CLOSED: " + message) }
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
export const gitObject = (type, bytes) => createHash("sha1").update(Buffer.from(type + " " + bytes.length + "\0")).update(bytes).digest("hex")
export const gitBlob = (bytes) => gitObject("blob", bytes)
const digest = (value) => hash(JSON.stringify(value))
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const decimal = (value) => typeof value === "string" && /^[1-9][0-9]*$/.test(value)
const utf8 = new TextDecoder("utf-8", { fatal: true })
export const seeds = Object.freeze([
  "profileProject", "HomeProjectSelection", "appDockProfile", "repo-",
  "tabMatchesProfile", "selectProject", "project.open", "home.selection",
  "Project.resolve", "ProjectID.global", "project_id", "projectId", "projectID",
  "worktree", "directoryKey", "serverWorkspace", "McpProjectConfig",
  "trustedProjects", "trusted_projects", "profileDirectory",
  "LeanProfilePreferences", "location_id", "repo_project_id", "orchestra.json", ".orchestra",
])
export const classifications = Object.freeze([
  "migrated-teams", "removed-sf", "technical-placement", "personal-installation",
  "different-meaning", "historical", "active-legacy", "orphan",
])
export const surfaces = Object.freeze([
  "cli-entry", "cli-command-registry", "installed-entry", "web-entry",
  "schema", "generated-client", "packed-content",
])
export const requiredEntrypoints = Object.freeze([
  {
    "id": "cli",
    "domain": "source",
    "path": "apps/cli/src/index.ts",
    "surface": "cli-entry"
  },
  {
    "id": "cli-registry",
    "domain": "source",
    "path": "apps/cli/src/commands/commands.ts",
    "surface": "cli-command-registry"
  },
  {
    "id": "installed",
    "domain": "source",
    "path": "modules/sucafina/Sucafinav1/local/entry.ts",
    "surface": "installed-entry"
  },
  {
    "id": "web",
    "domain": "source",
    "path": "apps/web/src/entry.tsx",
    "surface": "web-entry"
  },
  {
    "id": "team-schema",
    "domain": "source",
    "path": "packages/schema/src/sucafina/team-profile.ts",
    "surface": "schema"
  },
  {
    "id": "session-schema",
    "domain": "source",
    "path": "packages/schema/src/session.ts",
    "surface": "schema"
  },
  {
    "id": "protocol",
    "domain": "source",
    "path": "packages/protocol/src/api.ts",
    "surface": "schema"
  },
  {
    "id": "generated-promise",
    "domain": "source",
    "path": "packages/client/src/generated/client.ts",
    "surface": "generated-client"
  },
  {
    "id": "generated-effect",
    "domain": "source",
    "path": "packages/client/src/generated-effect/client.ts",
    "surface": "generated-client"
  },
  {
    "id": "generated-types",
    "domain": "source",
    "path": "packages/client/src/generated/types.ts",
    "surface": "generated-client"
  },
  {
    "id": "packed-skills",
    "domain": "source",
    "path": "modules/maestro/coordination/src/seat-skills-module.ts",
    "surface": "packed-content"
  },
  {
    "id": "packed-cli",
    "domain": "archive",
    "path": "bin/orchestra",
    "surface": "cli-entry"
  },
  {
    "id": "packed-installed",
    "domain": "archive",
    "path": "bin/local/entry.mjs",
    "surface": "installed-entry"
  },
  {
    "id": "packed-web",
    "domain": "archive",
    "path": "bin/web/index.html",
    "surface": "web-entry"
  },
  {
    "id": "packed-inventory",
    "domain": "archive",
    "path": "distribution.json",
    "surface": "packed-content"
  }
].map(Object.freeze))

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      required.some((key) => !Object.hasOwn(value, key)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key)))
    fail("unknown or missing object fields")
}
export function safePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || /[\x00-\x1f\x7f]/.test(value) ||
      value.startsWith("/") || /^[a-z]:/i.test(value) ||
      value.split("/").some((part) => !part || part === "." || part === ".."))
    fail("unsafe inventory path")
  return value
}
export function parseTrackedInventory(raw) {
  const text = utf8.decode(raw)
  if (!text.endsWith("\0")) fail("truncated git tree inventory")
  const seen = new Set()
  const entries = text.slice(0, -1).split("\0").map((line) => {
    const match = /^(100644|100755|120000|160000) (blob|commit) ([a-f0-9]{40})\t(.+)$/.exec(line)
    if (!match || ((match[1] === "160000") !== (match[2] === "commit"))) fail("invalid git tree row")
    const relative = safePath(match[4])
    if (seen.has(relative)) fail("duplicate tracked path")
    seen.add(relative)
    return { path: relative, mode: match[1], type: match[2], oid: match[3] }
  })
  if (!entries.length) fail("empty tracked inventory")
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}
export function record(domain, relative, bytes, metadata = {}) {
  safePath(relative)
  if (domain !== "source" && domain !== "archive") fail("unknown inventory domain")
  const data = Buffer.from(bytes)
  let encoding = "binary", text
  if (data.length >= 2 && data[0] === 255 && data[1] === 254) {
    if (data.length % 2) fail("truncated UTF-16LE text")
    encoding = "utf16le"; text = data.subarray(2).toString("utf16le")
  } else if (data.length >= 2 && data[0] === 254 && data[1] === 255) {
    if (data.length % 2) fail("truncated UTF-16BE text")
    encoding = "utf16be"; text = Buffer.from(data.subarray(2)).swap16().toString("utf16le")
  } else if (!data.includes(0)) {
    try { text = utf8.decode(data); encoding = "utf8" } catch { /* Raw bytes are still inventoried and scanned. */ }
  }
  return { ...metadata, domain, path: relative, byteLength: data.length, sha256: hash(data), encoding, data, text }
}
export function publicFile(item) {
  const { data, text, ...metadata } = item
  return metadata
}
export function findOccurrences(records, literals = seeds) {
  const unique = new Set()
  if (!Array.isArray(literals) || !literals.length ||
      literals.some((value) => typeof value !== "string" || !value || unique.has(value) || !unique.add(value)))
    fail("literal seed inventory is invalid")
  return records.flatMap((item) => literals.flatMap((seed) => {
    const encodings = item.encoding === "binary" ? ["utf8", "utf16le", "utf16be"]
      : [item.encoding]
    return encodings.flatMap((encoding) => {
      const needle = Buffer.from(seed, encoding === "utf16be" ? "utf16le" : encoding)
      if (encoding === "utf16be") needle.swap16()
      const matches = []
      let start = 0
      while (start < item.data.length) {
        const offset = item.data.indexOf(needle, start)
        if (offset < 0) break
        const identity = { domain: item.domain, path: item.path, fileSha256: item.sha256,
          byteOffset: offset, byteLength: needle.length, seed, encoding }
        matches.push({ id: digest(identity), ...identity })
        start = offset + needle.length
      }
      return matches
    })
  })).sort((a, b) => a.domain.localeCompare(b.domain) || a.path.localeCompare(b.path) || a.byteOffset - b.byteOffset || a.seed.localeCompare(b.seed))
}
export function validateManifest(value) {
  exactKeys(value, ["schema", "status", "review", "seeds", "entrypoints", "dispositions"])
  if (value.schema !== "teams-profile-residue-catalog-v1" || !["DIAGNOSTIC_UNQUALIFIED", "QUALIFICATION_REQUESTED"].includes(value.status))
    fail("catalog cannot self-certify qualification")
  exactKeys(value.review, ["status", "reason", "surfaces"])
  if (value.review.status !== (value.status === "DIAGNOSTIC_UNQUALIFIED" ? "pending" : "required") || typeof value.review.reason !== "string" || !value.review.reason.trim() ||
      !Array.isArray(value.review.surfaces) || value.review.surfaces.length !== surfaces.length ||
      !surfaces.every((surface) => value.review.surfaces.includes(surface))) fail("incomplete review boundary")
  if (!Array.isArray(value.seeds) || new Set(value.seeds).size !== value.seeds.length ||
      !seeds.every((seed) => value.seeds.includes(seed)) ||
      value.seeds.some((seed) => typeof seed !== "string" || !seed || seed.length > 128)) fail("mandatory literal seeds changed")
  if (!Array.isArray(value.entrypoints) || !value.entrypoints.length ||
      new Set(value.entrypoints.map((item) => item.id)).size !== value.entrypoints.length) fail("entrypoint inventory required")
  value.entrypoints.forEach((entry) => {
    exactKeys(entry, ["id", "domain", "path", "surface"])
    if (typeof entry.id !== "string" || !entry.id || !["source", "archive"].includes(entry.domain) || !surfaces.includes(entry.surface)) fail("invalid entrypoint")
    safePath(entry.path)
  })
  if (requiredEntrypoints.some((required) => !value.entrypoints.some((entry) =>
      entry.domain === required.domain && entry.path === required.path && entry.surface === required.surface)))
    fail("mandatory runtime schema generated and packed entrypoints changed")
  if (!Array.isArray(value.dispositions)) fail("exact occurrence dispositions required")
  const ids = new Set()
  value.dispositions.forEach((item) => {
    exactKeys(item, ["occurrenceId", "classification", "symbol", "producer", "consumer", "entrypoints",
      "storeField", "action", "owner", "reason", "testObligations", "reviewSource"])
    if (!sha256(item.occurrenceId) || ids.has(item.occurrenceId) || !classifications.includes(item.classification) ||
        !sha(item.reviewSource) || !Array.isArray(item.entrypoints) || !Array.isArray(item.testObligations) ||
        !item.testObligations.length || !["symbol", "producer", "consumer", "action", "owner", "reason"].every((key) =>
          typeof item[key] === "string" && item[key].trim()) ||
        (item.storeField !== null && (typeof item.storeField !== "string" || !item.storeField.trim())))
      fail("disposition lacks exact identity, explanation or test obligation")
    ids.add(item.occurrenceId)
    item.entrypoints.forEach(safePath)
    item.testObligations.forEach((proof) => {
      exactKeys(proof, ["path", "fileSha256", "caseName"])
      safePath(proof.path)
      if (!sha256(proof.fileSha256) || typeof proof.caseName !== "string" || !proof.caseName.trim()) fail("invalid test obligation")
    })
  })
  return value
}

export function buildReachability(records, entrypoints, domain = "source") {
  const files = new Map(records.filter((item) => item.domain === domain).map((item) => [item.path, item]))
  const issues = [], edges = [], calls = [], configurations = []
  const parse = (file) => {
    try { return JSON.parse(file.text) } catch { issues.push({ kind: "invalid-package-json", path: file.path }); return undefined }
  }
  const root = files.get("package.json")
  const rootPackage = root?.text ? parse(root) : undefined
  const workspacePatterns = Array.isArray(rootPackage?.workspaces) ? rootPackage.workspaces : rootPackage?.workspaces?.packages ?? []
  const wildcard = (pattern) => new RegExp("^" + pattern.split("*").map((part) => part.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&")).join("[^/]*") + "$")
  const workspace = new Map(), dependencies = new Set(builtinModules)
  for (const file of files.values()) {
    if (file.path === "package.json" || file.path.endsWith("/package.json")) {
      const directory = path.posix.dirname(file.path)
      if (file.path !== "package.json" && !workspacePatterns.some((pattern) => wildcard(pattern).test(directory))) continue
      const pkg = file.path === "package.json" ? rootPackage : parse(file)
      if (!pkg) continue
      for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"])
        Object.keys(pkg[field] ?? {}).forEach((name) => dependencies.add(name))
      if (file.path !== "package.json" && typeof pkg.name === "string") {
        if (workspace.has(pkg.name)) issues.push({ kind: "duplicate-workspace-name", path: file.path, name: pkg.name })
        else workspace.set(pkg.name, { directory, pkg })
      }
    }
    if (/(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(file.path) && file.text !== undefined) {
      const parsed = ts.parseConfigFileTextToJson(file.path, file.text)
      if (parsed.error) { issues.push({ kind: "invalid-tsconfig", path: file.path }); continue }
      if (parsed.config.extends !== undefined) issues.push({ kind: "tsconfig-extends-requires-review", path: file.path, fileSha256: file.sha256, extends: parsed.config.extends })
      configurations.push({ directory: path.posix.dirname(file.path), options: parsed.config.compilerOptions ?? {} })
    }
  }
  function local(candidate) {
    const normalized = path.posix.normalize(candidate)
    if (normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) return []
    const base = /\.[cm]?jsx?$/.test(normalized) ? normalized.replace(/\.[cm]?jsx?$/, "") : normalized
    return [...new Set([normalized, ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"]
      .map((suffix) => base + suffix), ...[".ts", ".tsx", ".js", ".mjs", ".json"].map((suffix) => normalized + "/index" + suffix)])]
      .filter((name) => files.has(name))
  }
  const leaves = (value) => typeof value === "string" ? [value]
    : Array.isArray(value) ? value.flatMap(leaves)
    : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : []
  function resolve(from, specifier) {
    if (specifier.startsWith(".")) return { targets: local(path.posix.join(path.posix.dirname(from), specifier)) }
    if (specifier.startsWith("node:") || specifier === "bun" || specifier.startsWith("bun:"))
      return { targets: [], external: true }
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]
    const pkg = workspace.get(name)
    if (pkg) {
      const subpath = specifier === name ? "." : "." + specifier.slice(name.length)
      const exported = pkg.pkg.exports
      const targets = []
      if (typeof exported === "string" || Array.isArray(exported) ||
          exported && typeof exported === "object" && !Object.keys(exported).some((key) => key.startsWith("."))) {
        if (subpath === ".") targets.push(...leaves(exported))
      } else if (exported && typeof exported === "object") {
        for (const [key, value] of Object.entries(exported)) {
          if (!key.includes("*") && key === subpath) targets.push(...leaves(value))
          if (!key.includes("*")) continue
          const [before, after] = key.split("*")
          if (key.split("*").length !== 2 || !subpath.startsWith(before) || !subpath.endsWith(after)) continue
          const middle = subpath.slice(before.length, after ? -after.length : undefined)
          targets.push(...leaves(value).map((target) => target.replaceAll("*", middle)))
        }
      }
      if (!exported && subpath === ".") targets.push(...[pkg.pkg.module, pkg.pkg.main, pkg.pkg.types, "./index.ts"].filter((value) => typeof value === "string"))
      return { targets: [...new Set(targets.flatMap((target) => target.startsWith("./") ? local(path.posix.join(pkg.directory, target)) : []))] }
    }
    const aliases = configurations.filter((config) => config.directory === "." || from.startsWith(config.directory + "/"))
      .sort((a, b) => b.directory.length - a.directory.length)
    for (const config of aliases) {
      for (const [key, values] of Object.entries(config.options.paths ?? {})) {
        const parts = key.split("*")
        if (parts.length > 2 || !Array.isArray(values)) continue
        if (parts.length === 1 && key !== specifier) continue
        if (parts.length === 2 && (!specifier.startsWith(parts[0]) || !specifier.endsWith(parts[1]))) continue
        const middle = parts.length === 2 ? specifier.slice(parts[0].length, parts[1] ? -parts[1].length : undefined) : ""
        const found = values.filter((value) => typeof value === "string").flatMap((value) =>
          local(path.posix.join(config.directory, config.options.baseUrl ?? ".", value.replaceAll("*", middle))))
        if (found.length) return { targets: [...new Set(found)] }
      }
    }
    return { targets: [], external: dependencies.has(name) }
  }
  for (const file of files.values()) {
    if (file.text === undefined || !/\.[cm]?[jt]sx?$/.test(file.path)) continue
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true)
    if (source.parseDiagnostics.length) issues.push({ kind: "source-parse-diagnostics", path: file.path, count: source.parseDiagnostics.length })
    const walk = (node) => {
      const imported = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier : undefined
      const dynamic = ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ts.isIdentifier(node.expression) && node.expression.text === "require")
      if (imported || dynamic) {
        const expression = imported ?? node.arguments[0]
        const literal = expression && ts.isStringLiteralLike(expression) ? expression.text : undefined
        const resolution = literal ? resolve(file.path, literal) : { targets: [] }
        const edge = { domain, from: file.path, fileSha256: file.sha256, start: node.getStart(source), end: node.end,
          kind: imported ? "static-import-or-reexport" : "dynamic-import-or-require",
          specifier: literal ?? null, targets: resolution.targets,
          status: resolution.external ? "external-dependency" : resolution.targets.length ? "resolved" : "unresolved" }
        edges.push({ id: digest(edge), ...edge })
      }
      if (ts.isCallExpression(node)) {
        let parent = node.parent, caller = "<module>"
        while (parent && parent !== source) {
          if ((ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name) {
            caller = parent.name.getText(source); break
          }
          parent = parent.parent
        }
        const callsite = { domain, path: file.path, fileSha256: file.sha256, start: node.getStart(source), end: node.end,
          caller, callee: node.expression.getText(source).slice(0, 256), resolution: "lexical-callsite-only" }
        calls.push({ id: digest(callsite), ...callsite })
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
  }
  // HTML references and the embedded distribution inventory are content edges;
  // they are never presented as resolved function calls.
  for (const file of files.values()) {
    if (file.text === undefined) continue
    if (/\.html?$/.test(file.path)) {
      const expression = /<(?:script|link|img|source)\b[^>]*?\s(?:src|href)\s*=\s*(["'])(.*?)\1/gi
      for (const match of file.text.matchAll(expression)) {
        const specifier = match[2], withoutQuery = specifier.split(/[?#]/, 1)[0]
        const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(specifier)
        const candidate = withoutQuery.startsWith("/") && domain === "archive"
          ? "bin/web/" + withoutQuery.slice(1)
          : path.posix.join(path.posix.dirname(file.path), withoutQuery)
        const targets = external || !withoutQuery ? [] : local(candidate)
        const edge = { domain, from: file.path, fileSha256: file.sha256, start: match.index,
          end: match.index + match[0].length, kind: "html-content-reference", specifier, targets,
          status: external ? "external-content" : targets.length ? "resolved" : "unresolved" }
        edges.push({ id: digest(edge), ...edge })
      }
    }
    if (domain === "archive" && file.path === "distribution.json") {
      const distribution = parse(file)
      if (!Array.isArray(distribution?.files)) { issues.push({ kind: "invalid-distribution-member-list", path: file.path }); continue }
      for (const member of distribution.files) {
        const target = typeof member?.path === "string" ? member.path : null
        const edge = { domain, from: file.path, fileSha256: file.sha256, start: null, end: null,
          kind: "archive-manifest-membership", specifier: target, targets: target && files.has(target) ? [target] : [],
          status: target && files.has(target) ? "resolved" : "unresolved" }
        edges.push({ id: digest(edge), ...edge })
      }
    }
  }
  const outgoing = new Map()
  edges.forEach((edge) => outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), ...edge.targets]))
  const reachable = new Map()
  for (const entry of entrypoints.filter((entry) => entry.domain === domain)) {
    if (!files.has(entry.path)) { issues.push({ kind: "missing-entrypoint", ...entry }); continue }
    const queue = [[entry.path]], seen = new Set([entry.path])
    for (let index = 0; index < queue.length; index++) {
      const chain = queue[index], last = chain[chain.length - 1]
      reachable.set(last, [...(reachable.get(last) ?? []), { entrypoint: entry.id, surface: entry.surface, importPath: chain }])
      for (const target of outgoing.get(last) ?? []) {
        if (seen.has(target)) continue
        seen.add(target); queue.push([...chain, target])
      }
    }
  }
  return { domain, method: "conservative-file-import-and-content-edges-with-lexical-callsites",
    semanticCallGraphQualified: false, edges, calls, issues,
    unresolved: edges.filter((edge) => edge.status === "unresolved"),
    reachable: Object.fromEntries(reachable) }
}

function tarNumber(bytes) {
  const text = bytes.toString("ascii").replace(/\0.*$/, "").trim()
  if (text && !/^[0-7]+$/.test(text)) fail("unsupported or malformed tar number")
  const value = text ? Number.parseInt(text, 8) : 0
  if (!Number.isSafeInteger(value) || value < 0) fail("unsafe tar size")
  return value
}
function tarText(bytes) {
  const zero = bytes.indexOf(0)
  return utf8.decode(zero < 0 ? bytes : bytes.subarray(0, zero))
}
function paxFields(bytes) {
  const fields = {}
  let offset = 0
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset)
    if (space < 0) fail("truncated PAX record")
    const number = bytes.subarray(offset, space).toString("ascii")
    if (!/^[1-9][0-9]*$/.test(number)) fail("invalid PAX length")
    const length = Number(number), end = offset + length
    if (!Number.isSafeInteger(length) || end > bytes.length || bytes[end - 1] !== 10 || end <= space + 2) fail("invalid PAX boundary")
    const field = utf8.decode(bytes.subarray(space + 1, end - 1)), equal = field.indexOf("=")
    if (equal < 1) fail("invalid PAX assignment")
    const key = field.slice(0, equal)
    if (!["path", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname"].includes(key) || Object.hasOwn(fields, key))
      fail("unsupported or duplicate PAX field")
    fields[key] = field.slice(equal + 1)
    offset = end
  }
  return fields
}
export function readTarArchive(compressed, maximumBytes = 2 * 1024 * 1024 * 1024) {
  if (!Buffer.isBuffer(compressed) || compressed.length < 18 || compressed[0] !== 31 || compressed[1] !== 139)
    fail("actual gzip archive required")
  const bytes = gunzipSync(compressed, { maxOutputLength: maximumBytes })
  if (bytes.length % 512 !== 0) fail("truncated tar blocks")
  const files = [], seen = new Set()
  let offset = 0, pending = {}, ended = false
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) {
      if (offset + 1024 > bytes.length || bytes.subarray(offset).some((byte) => byte !== 0)) fail("tar has trailing data or a truncated end marker")
      ended = true; break
    }
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0)
    if (tarNumber(header.subarray(148, 156)) !== checksum) fail("tar header checksum mismatch")
    const prefix = tarText(header.subarray(345, 500))
    const name = (prefix ? prefix + "/" : "") + tarText(header.subarray(0, 100))
    const type = String.fromCharCode(header[156] || 48)
    const headerSize = tarNumber(header.subarray(124, 136))
    const size = type !== "x" && type !== "g" && pending.size !== undefined ? Number(pending.size) : headerSize
    if (!Number.isSafeInteger(size) || size < 0 || size > maximumBytes ||
        pending.size !== undefined && !/^(0|[1-9][0-9]*)$/.test(pending.size)) fail("invalid member size")
    const start = offset + 512, end = start + size
    if (end > bytes.length) fail("truncated tar member")
    const data = bytes.subarray(start, end)
    offset = start + Math.ceil(size / 512) * 512
    if (type === "x" || type === "g") {
      const fields = paxFields(data)
      if (type === "g" && (fields.path !== undefined || fields.size !== undefined)) fail("global PAX path or size is ambiguous")
      if (type === "x") {
        if (Object.keys(pending).length) fail("stacked PAX headers")
        pending = fields
      }
      continue
    }
    const relative = safePath((pending.path ?? name).replace(type === "5" ? /\/$/ : /$^/, ""))
    pending = {}
    if (seen.has(relative)) fail("duplicate archive member")
    seen.add(relative)
    if (type === "5") { if (size !== 0) fail("directory has payload"); continue }
    if (type !== "0") fail("archive links and unsupported member types are forbidden")
    files.push(record("archive", relative, data))
  }
  if (!ended || Object.keys(pending).length || !files.length) fail("archive did not close with nonempty complete inventory")
  const regular = new Set(files.map((file) => file.path))
  for (const file of files) {
    const parts = file.path.split("/")
    if (parts.slice(0, -1).some((_, index) => regular.has(parts.slice(0, index + 1).join("/"))))
      fail("archive file is also a parent directory")
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}
export function verifyArtifact(input) {
  const { source, archiveFile, compressed, files, inventoryBytes, receiptBytes, provenance, env } = input
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      env.GITHUB_REPOSITORY_ID !== "1455724710" || env.RUNNER_OS !== "Linux" || env.RUNNER_ARCH !== "X64" ||
      !sha(source.sha) || !sha(source.tree) || env.SF_PRODUCT_SOURCE_SHA !== source.sha || !sha(env.GITHUB_SHA) ||
      !decimal(env.GITHUB_RUN_ID) || !decimal(env.GITHUB_RUN_ATTEMPT)) fail("actual current hosted source/run identity required")
  const receipt = parseCanonicalJson(receiptBytes, "artifact receipt"), inventory = parseCanonicalJson(inventoryBytes, "archive inventory")
  exactKeys(receipt, ["schema", "proofRole", "sourceSHA", "sourceTreeSHA", "target", "version", "archiveFile", "archiveSha256", "archiveBytes", "manifestSha256", "inventoryFile", "inventorySha256", "fileCount", "archiveFileCount", "webFileCount", "brand", "channel", "viteEnvironmentInputs", "extractedVerified", "nativeBrowserProof", "fullSfCi"])
  exactKeys(inventory, ["schema", "sourceSHA", "sourceTreeSHA", "archiveFile", "archiveSha256", "files"])
  if (path.basename(archiveFile) !== archiveFile || !archiveFile.endsWith(".tar.gz")) fail("archive basename required")
  if (receipt.schema !== "sf-teams-production-artifact-v1" || receipt.proofRole !== "sf-production-archive" ||
      receipt.sourceSHA !== source.sha || receipt.sourceTreeSHA !== source.tree ||
      receipt.archiveFile !== archiveFile || receipt.archiveSha256 !== hash(compressed) ||
      receipt.archiveBytes !== compressed.length || receipt.inventoryFile !== archiveFile + ".inventory.json" ||
      receipt.inventorySha256 !== hash(inventoryBytes) || receipt.extractedVerified !== true ||
      receipt.target !== "linux-x64-baseline" || receipt.channel !== "prod" || receipt.brand !== "sucafina" ||
      receipt.viteEnvironmentInputs !== 0 || receipt.nativeBrowserProof !== "REQUIRED_SEPARATELY" ||
      receipt.fullSfCi !== "REQUIRED_SEPARATELY" || typeof receipt.version !== "string" || !receipt.version)
    fail("archive receipt does not bind actual bytes and current source")
  const actual = files.map((file) => ({ path: file.path, byteLength: file.byteLength, sha256: file.sha256 }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  if (inventory.schema !== "sf-teams-archive-inventory-v1" || inventory.sourceSHA !== source.sha ||
      inventory.sourceTreeSHA !== source.tree || inventory.archiveFile !== archiveFile ||
      inventory.archiveSha256 !== hash(compressed) || !Array.isArray(inventory.files) ||
      inventory.files.length !== actual.length || receipt.archiveFileCount !== actual.length)
    fail("archive inventory identity or count mismatch")
  inventory.files.forEach((file) => { exactKeys(file, ["path", "byteLength", "sha256"]); safePath(file.path) })
  const declared = [...inventory.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  if (JSON.stringify(declared) !== JSON.stringify(actual)) fail("actual archive members differ from inventory")
  const distribution = files.find((file) => file.path === "distribution.json")
  if (!distribution || receipt.manifestSha256 !== distribution.sha256) fail("actual embedded distribution is not bound")
  const descriptor = JSON.parse(distribution.text)
  if (!Array.isArray(descriptor.files) || descriptor.files.length !== receipt.fileCount ||
      descriptor.files.filter((file) => file.path.startsWith("bin/web/")).length !== receipt.webFileCount ||
      receipt.archiveFileCount !== receipt.fileCount + 2 ||
      descriptor.version !== receipt.version || descriptor.target !== receipt.target ||
      new Set(descriptor.files.map((file) => file.path)).size !== descriptor.files.length ||
      descriptor.files.some((file) => !actual.some((entry) => entry.path === file.path)) ||
      !files.some((file) => file.path === "checksums.sha256"))
    fail("archive distribution counters or target do not match actual members")
  exactKeys(provenance, ["schema", "runId", "runAttempt", "workflowSHA", "sourceSHA", "sourceTreeSHA", "producerJob",
    "artifact", "archiveSha256", "inventorySha256", "receiptSha256"])
  exactKeys(provenance.artifact, ["id", "name", "digest", "workflowRunId", "headSha", "expired"])
  if (provenance.schema !== "teams-profile-residue-provenance-v1" ||
      provenance.runId !== env.GITHUB_RUN_ID || provenance.runAttempt !== env.GITHUB_RUN_ATTEMPT ||
      provenance.workflowSHA !== env.GITHUB_SHA || provenance.sourceSHA !== source.sha || provenance.sourceTreeSHA !== source.tree ||
      provenance.producerJob !== "teams-profile-artifact" ||
      !decimal(provenance.artifact.id) || provenance.artifact.id !== env.SF_TEAMS_RESIDUE_ARTIFACT_ID ||
      typeof provenance.artifact.name !== "string" || !provenance.artifact.name ||
      !/^sha256:[a-f0-9]{64}$/.test(provenance.artifact.digest) ||
      provenance.artifact.digest !== env.SF_TEAMS_RESIDUE_ARTIFACT_DIGEST ||
      provenance.artifact.workflowRunId !== env.GITHUB_RUN_ID ||
      provenance.artifact.headSha !== source.sha || provenance.artifact.expired !== false ||
      provenance.archiveSha256 !== hash(compressed) || provenance.inventorySha256 !== hash(inventoryBytes) ||
      provenance.receiptSha256 !== hash(receiptBytes))
    fail("missing or mismatched same-run downloaded artifact provenance")
  return { status: "BOUND", source, workflowSHA: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    artifact: provenance.artifact, archiveFile, archiveSha256: hash(compressed),
    inventorySha256: hash(inventoryBytes), receiptSha256: hash(receiptBytes), memberCount: files.length,
    note: "Artifact ID/digest are supplied by the trusted download job; this is not operational or native-browser qualification." }
}

export function parseCanonicalJson(bytes, label) {
  const text = utf8.decode(bytes), value = JSON.parse(text)
  if (text !== JSON.stringify(value, null, 2) + "\n")
    fail(label + " must use canonical JSON with no duplicate keys")
  return value
}

export function gitTree(entries) {
  const root = new Map()
  for (const entry of entries) {
    const parts = safePath(entry.path).split("/")
    let parent = root
    for (const part of parts.slice(0, -1)) {
      const existing = parent.get(part)
      if (existing && !(existing instanceof Map)) fail("tracked file is also a parent directory")
      if (!existing) parent.set(part, new Map())
      parent = parent.get(part)
    }
    const name = parts.at(-1)
    if (parent.has(name)) fail("duplicate or overlapping tracked path")
    parent.set(name, entry)
  }
  const materialize = (directory) => {
    const rows = [...directory].map(([name, value]) => value instanceof Map
      ? { name, mode: "40000", oid: materialize(value), sort: Buffer.from(name + "/") }
      : { name, mode: value.mode, oid: value.oid, sort: Buffer.from(name) })
      .sort((a, b) => Buffer.compare(a.sort, b.sort))
    const bytes = Buffer.concat(rows.flatMap((row) => [
      Buffer.from(row.mode + " " + row.name + "\0"), Buffer.from(row.oid, "hex"),
    ]))
    return gitObject("tree", bytes)
  }
  return materialize(root)
}

export function verifyGitSource(commitBytes, inventoryBytes, expectedSHA) {
  if (!sha(expectedSHA) || gitObject("commit", commitBytes) !== expectedSHA)
    fail("commit bytes do not match the exact product source")
  const text = utf8.decode(commitBytes), separator = text.indexOf("\n\n")
  const headers = separator < 0 ? [] : text.slice(0, separator).split("\n")
  const match = /^tree ([a-f0-9]{40})$/.exec(headers[0] ?? "")
  if (!match || headers.filter((line) => line.startsWith("tree ")).length !== 1)
    fail("invalid commit tree header")
  const entries = parseTrackedInventory(inventoryBytes)
  if (gitTree(entries) !== match[1]) fail("tracked inventory does not reproduce the commit tree")
  return { sha: expectedSHA, tree: match[1], entries,
    commitSha256: hash(commitBytes), inventorySha256: hash(inventoryBytes) }
}

export async function readSource(rootPath, verified) {
  const root = await realpath(rootPath)
  if (!(await lstat(root)).isDirectory()) fail("source root is not a directory")
  const directories = new Set([root]), records = [], gaps = []
  for (const entry of verified.entries) {
    const parts = safePath(entry.path).split("/")
    let directory = root
    for (const name of parts.slice(0, -1)) {
      directory = path.join(directory, name)
      if (directories.has(directory)) continue
      const info = await lstat(directory)
      if (!info.isDirectory() || info.isSymbolicLink()) fail("tracked parent is not a real in-checkout directory")
      directories.add(directory)
    }
    if (entry.type === "commit") {
      // A gitlink binds the other tree's identity, not its contents. Never follow
      // it or certify it as an empty directory. Review must see this gap.
      const gap = { domain: "source", path: entry.path, oid: entry.oid, mode: entry.mode,
        kind: "gitlink-contents-unavailable" }
      gaps.push({ id: digest(gap), ...gap })
      continue
    }
    const filename = path.join(root, entry.path), before = await lstat(filename)
    if (entry.mode === "120000" ? !before.isSymbolicLink() : !before.isFile() || before.isSymbolicLink())
      fail("tracked file kind differs from Git: " + entry.path)
    if (entry.mode !== "120000" && ((before.mode & 0o111) !== 0) !== (entry.mode === "100755"))
      fail("tracked executable mode differs from Git: " + entry.path)
    const bytes = entry.mode === "120000" ? await readlink(filename, { encoding: "buffer" }) : await readFile(filename)
    const after = await lstat(filename)
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.mode !== after.mode || gitBlob(bytes) !== entry.oid)
      fail("tracked bytes changed or differ from Git: " + entry.path)
    const file = record("source", entry.path, bytes, { mode: entry.mode, gitOid: entry.oid,
      kind: entry.mode === "120000" ? "symlink-target-bytes" : "regular" })
    records.push(file)
    if (entry.mode === "120000") {
      const gap = { domain: "source", path: entry.path, fileSha256: file.sha256,
        kind: "symlink-target-not-followed" }
      gaps.push({ id: digest(gap), ...gap })
    }
  }
  return { root, records, gaps, trackedCount: verified.entries.length,
    byteBoundCount: records.length, contentsComplete: gaps.length === 0 }
}

function testObligation(proof) {
  exactKeys(proof, ["path", "fileSha256", "caseName"])
  safePath(proof.path)
  if (!sha256(proof.fileSha256) || typeof proof.caseName !== "string" || !proof.caseName.trim())
    fail("invalid exact test obligation")
}
export const controlCases = Object.freeze([
  "git objects bind every tracked path and the real commit tree",
  "git binding rejects omitted paths changed identities and unsafe inventory",
  "source reader binds actual regular bytes and executable modes",
  "source reader never follows external links or unqualified gitlinks",
  "literal audit covers source archive binary and UTF-16 occurrences",
  "exact dispositions never cover a changed file or another occurrence",
  "catalog rejects broad exclusions seed removal and self-certified PASS",
  "reachability records imports dynamic gaps callers and packed content",
  "archive parser inventories actual gzip tar members",
  "archive parser rejects traversal links duplicates checksums and truncation",
  "artifact binding verifies actual inventory receipt and separate workflow identity",
  "artifact binding rejects changed source run digest and omitted members",
  "empty matches and source-only scans cannot qualify",
  "qualification requires current review all gaps controls and executed obligations",
  "review sidecar can bind the catalog itself without circular file hashes",
  "negative controls cannot be forged by omitted skipped or duplicate cases",
])

function currentExecution(value, source, env) {
  return value.sourceSHA === source.sha && value.sourceTreeSHA === source.tree &&
    value.workflowSHA === env.GITHUB_SHA && value.runId === env.GITHUB_RUN_ID &&
    value.runAttempt === env.GITHUB_RUN_ATTEMPT
}
export function verifyControls(value, source, records, env) {
  exactKeys(value, ["schema", "sourceSHA", "sourceTreeSHA", "workflowSHA", "runId", "runAttempt",
    "scannerSha256", "testSha256", "complete", "cases"])
  const scanner = records.find((file) => file.domain === "source" && file.path === "script/sf-ci/team-profile-residue.mjs")
  const tests = records.find((file) => file.domain === "source" && file.path === "script/sf-ci/team-profile-residue.test.mjs")
  if (value.schema !== "teams-profile-residue-controls-v1" || !currentExecution(value, source, env) ||
      value.complete !== true || !scanner || !tests || value.scannerSha256 !== scanner.sha256 ||
      value.testSha256 !== tests.sha256 || !Array.isArray(value.cases) ||
      value.cases.length !== controlCases.length || new Set(value.cases.map((item) => item.name)).size !== controlCases.length ||
      controlCases.some((name) => !value.cases.some((item) => item.name === name && item.status === "pass")))
    fail("complete exact executed negative controls are required")
  value.cases.forEach((item) => exactKeys(item, ["name", "status"]))
  return { status: "VERIFIED", scannerSha256: scanner.sha256, testSha256: tests.sha256,
    cases: value.cases.length, receiptSha256: digest(value) }
}

function reviewDisposition(value) {
  exactKeys(value, ["occurrenceId", "classification", "symbol", "producer", "consumer", "entrypoints",
    "storeField", "action", "owner", "reason", "testObligations", "reviewSource"])
  if (!sha256(value.occurrenceId) || !classifications.includes(value.classification) || !sha(value.reviewSource) ||
      !["symbol", "producer", "consumer", "action", "owner", "reason"].every((key) =>
        typeof value[key] === "string" && value[key].trim()) ||
      value.storeField !== null && (typeof value.storeField !== "string" || !value.storeField.trim()) ||
      !Array.isArray(value.entrypoints) || !Array.isArray(value.testObligations) || !value.testObligations.length)
    fail("incomplete precise occurrence review")
  value.entrypoints.forEach(safePath)
  value.testObligations.forEach(testObligation)
}
function reviewGap(value) {
  exactKeys(value, ["findingId", "classification", "producer", "consumer", "entrypoints", "action",
    "owner", "reason", "testObligations", "reviewSource"])
  if (!sha256(value.findingId) || !classifications.includes(value.classification) || !sha(value.reviewSource) ||
      !["producer", "consumer", "action", "owner", "reason"].every((key) =>
        typeof value[key] === "string" && value[key].trim()) ||
      !Array.isArray(value.entrypoints) || !Array.isArray(value.testObligations) || !value.testObligations.length)
    fail("incomplete precise reachability review")
  value.entrypoints.forEach(safePath)
  value.testObligations.forEach(testObligation)
}

function canonicalBase64(value, label) {
  if (typeof value !== "string" || !value.length) fail(label + " must be canonical Base64")
  const bytes = Buffer.from(value, "base64")
  if (bytes.toString("base64") !== value) fail(label + " must be canonical Base64")
  return bytes
}

function trustAnchors(value) {
  exactKeys(value, ["schema", "reviewer", "obligationProducer"])
  if (value.schema !== "teams-profile-residue-trust-v1") fail("invalid residue trust schema")
  const anchors = [value.reviewer, value.obligationProducer].map((anchor) => {
    exactKeys(anchor, ["id", "publicKey"])
    if (typeof anchor.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(anchor.id))
      fail("invalid residue trust signer ID")
    const bytes = canonicalBase64(anchor.publicKey, "trust public key")
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" })
    if (key.asymmetricKeyType !== "ed25519" || !key.export({ format: "der", type: "spki" }).equals(bytes))
      fail("trust public key must be canonical Ed25519 SPKI")
    return { id: anchor.id, key, publicKeySha256: hash(bytes) }
  })
  if (anchors[0].id === anchors[1].id || anchors[0].publicKeySha256 === anchors[1].publicKeySha256)
    fail("independent residue trust signers and keys are required")
  return { reviewer: anchors[0], obligationProducer: anchors[1] }
}

function authenticateSidecar(sidecar, anchor, role) {
  if (!anchor) fail(role + " trust anchor is required")
  const { authentication, ...payload } = sidecar
  exactKeys(authentication, ["signerId", "signature"])
  if (authentication.signerId !== anchor.id || role === "review" && payload.reviewer !== anchor.id)
    fail(role + " signer is not trusted")
  const signature = canonicalBase64(authentication.signature, role + " signature")
  // Sign the compact JSON payload in the same property order as the sidecar.
  // The signed role prevents a review signature from attesting test execution.
  const payloadSha256 = digest(payload)
  const signed = Buffer.from(JSON.stringify(["teams-profile-residue-signature-v1", role, anchor.id, payloadSha256]))
  if (signature.length !== 64 || !verify(null, signed, anchor.key, signature))
    fail(role + " signature did not verify")
  return { signerId: anchor.id, publicKeySha256: anchor.publicKeySha256, payloadSha256 }
}

export function auditResidues(input) {
  const { source, records, sourceGaps = [], artifact, catalogBytes, review, controls, proofs, trust, env } = input
  const anchors = trust === undefined ? undefined : trustAnchors(trust)
  const catalog = validateManifest(parseCanonicalJson(catalogBytes, "residue catalog"))
  const sourceGraph = buildReachability(records, catalog.entrypoints, "source")
  const archiveGraph = buildReachability(records, catalog.entrypoints, "archive")
  const graph = { source: sourceGraph, archive: archiveGraph }
  const occurrences = findOccurrences(records, catalog.seeds)
  const gaps = [...sourceGaps]
  for (const current of [sourceGraph, archiveGraph]) {
    for (const edge of current.unresolved) {
      const gap = { kind: "unresolved-import-or-content-edge", domain: current.domain,
        path: edge.from, fileSha256: edge.fileSha256, edge }
      gaps.push({ id: digest(gap), ...gap })
    }
    for (const issue of current.issues) {
      const gap = { kind: "reachability-issue", domain: current.domain, ...issue }
      gaps.push({ id: digest(gap), ...gap })
    }
  }
  for (const file of records.filter((file) => file.domain === "archive" && file.encoding === "binary")) {
    const gap = { kind: "opaque-packed-content", domain: file.domain, path: file.path, fileSha256: file.sha256 }
    gaps.push({ id: digest(gap), ...gap })
  }
  const inventory = records.map(publicFile)
  const binding = { sourceSHA: source.sha, sourceTreeSHA: source.tree,
    catalogSha256: hash(catalogBytes), inventorySha256: digest(inventory),
    occurrencesSha256: digest(occurrences), graphSha256: digest(graph), gapsSha256: digest(gaps) }
  const evidenceBinding = { ...binding, workflowSHA: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, archiveSha256: artifact?.archiveSha256,
    artifactId: artifact?.artifact?.id, artifactDigest: artifact?.artifact?.digest }
  const blockers = [], inline = catalog.dispositions.map((item) => { reviewDisposition(item); return item })
  let reviewAuthentication
  if (review !== undefined) {
    exactKeys(review, ["schema", "status", ...Object.keys(evidenceBinding), "reviewSource", "reviewer", "reason",
      "surfaces", "dispositions", "gaps", "testObligations", "authentication"])
    if (review.schema !== "teams-profile-residue-review-v1" || review.status !== "reviewed" ||
        artifact?.status !== "BOUND" || Object.entries(evidenceBinding).some(([key, value]) => review[key] !== value) ||
        !sha(review.reviewSource) || typeof review.reviewer !== "string" || !review.reviewer.trim() ||
        typeof review.reason !== "string" || !review.reason.trim() ||
        !Array.isArray(review.surfaces) || review.surfaces.length !== surfaces.length ||
        new Set(review.surfaces).size !== surfaces.length || !surfaces.every((item) => review.surfaces.includes(item)) ||
        !Array.isArray(review.dispositions) || !Array.isArray(review.gaps) ||
        !Array.isArray(review.testObligations) || !review.testObligations.length)
      fail("review is not bound to the complete exact current audit")
    reviewAuthentication = authenticateSidecar(review, anchors?.reviewer, "review")
    review.dispositions.forEach(reviewDisposition); review.gaps.forEach(reviewGap)
    review.testObligations.forEach(testObligation)
  } else blockers.push("independent-current-source-review-missing")
  const occurrenceIds = new Set(occurrences.map((item) => item.id)), gapIds = new Set(gaps.map((item) => item.id))
  const dispositions = [...inline, ...(review?.dispositions ?? [])], byOccurrence = new Map()
  for (const item of dispositions) {
    if (byOccurrence.has(item.occurrenceId)) fail("duplicate exact occurrence disposition")
    byOccurrence.set(item.occurrenceId, item)
    if (!occurrenceIds.has(item.occurrenceId)) fail("stale or foreign occurrence disposition")
  }
  const gapReviews = new Map()
  for (const item of review?.gaps ?? []) {
    if (gapReviews.has(item.findingId) || !gapIds.has(item.findingId))
      fail("duplicate stale or foreign reachability disposition")
    gapReviews.set(item.findingId, item)
  }
  const fileKey = (domain, relative) => domain + "\0" + relative
  const byFile = new Map(records.map((file) => [fileKey(file.domain, file.path), file]))
  const callsByFile = new Map()
  for (const current of [sourceGraph, archiveGraph]) for (const callsite of current.calls) {
    const key = fileKey(callsite.domain, callsite.path)
    if (!callsByFile.has(key)) callsByFile.set(key, [])
    callsByFile.get(key).push(callsite)
  }
  const classified = occurrences.map((item) => {
    const key = fileKey(item.domain, item.path), fileCalls = callsByFile.get(key) ?? []
    const offset = fileCalls.length ? utf8Offset(byFile.get(key), item.byteOffset) : -1
    return { ...item, disposition: byOccurrence.get(item.id) ?? null,
      reachableEntrypoints: (graph[item.domain].reachable[item.path] ?? []).map((entry) => entry.entrypoint),
      callsites: offset < 0 ? [] : fileCalls
        .filter((call) => call.start <= offset && call.end >= offset).map((call) => call.id) }
  })
  const classifiedGaps = gaps.map((item) => ({ ...item, disposition: gapReviews.get(item.id) ?? null }))
  const unknownOccurrences = classified.filter((item) => item.disposition === null).length
  const unknownReachability = classifiedGaps.filter((item) => item.disposition === null).length
  const allDispositions = [...dispositions, ...(review?.gaps ?? [])]
  const counts = {
    occurrences: classified.length, classified: classified.length - unknownOccurrences,
    unknownOccurrences, unknownReachability, unclassified: unknownOccurrences + unknownReachability,
    activeLegacy: allDispositions.filter((item) => item.classification === "active-legacy").length,
    orphan: allDispositions.filter((item) => item.classification === "orphan").length,
  }
  if (counts.unclassified) blockers.push("unclassified-occurrences-or-reachability")
  if (counts.activeLegacy) blockers.push("active-legacy")
  if (counts.orphan) blockers.push("orphan")
  if (catalog.status !== "QUALIFICATION_REQUESTED") blockers.push("catalog-diagnostic-only")
  if (!artifact || artifact.status !== "BOUND") blockers.push("same-run-actual-archive-missing")
  // Missing entry files and unloaded external trees cannot be waived by prose.
  if (gaps.some((gap) => gap.kind === "gitlink-contents-unavailable" || gap.kind === "missing-entrypoint" ||
      gap.kind === "invalid-distribution-member-list")) blockers.push("incomplete-required-inventory")
  let controlEvidence
  if (controls !== undefined) controlEvidence = verifyControls(controls, source, records, env)
  else blockers.push("executed-negative-controls-missing")
  const obligations = [...new Map([...(review?.testObligations ?? []), ...allDispositions.flatMap((item) => item.testObligations)]
    .map((item) => [JSON.stringify([item.path, item.fileSha256, item.caseName]), item])).values()]
  let proofEvidence
  if (proofs !== undefined) {
    exactKeys(proofs, ["schema", ...Object.keys(evidenceBinding), "reviewSha256", "cases", "authentication"])
    if (proofs.schema !== "teams-profile-residue-proofs-v1" || !currentExecution(proofs, source, env) ||
        artifact?.status !== "BOUND" || Object.entries(evidenceBinding).some(([key, value]) => proofs[key] !== value) ||
        !sha256(proofs.reviewSha256) || !Array.isArray(proofs.cases))
      fail("executed proof inventory is not from the current source/run and exact audit")
    const authentication = authenticateSidecar(proofs, anchors?.obligationProducer, "executed-obligations")
    if (reviewAuthentication && proofs.reviewSha256 !== reviewAuthentication.payloadSha256)
      fail("executed proof inventory does not bind the authenticated review")
    const seen = new Set()
    for (const item of proofs.cases) {
      exactKeys(item, ["path", "fileSha256", "caseName", "status", "jobId", "evidenceSha256"])
      testObligation({ path: item.path, fileSha256: item.fileSha256, caseName: item.caseName })
      const key = JSON.stringify([item.path, item.fileSha256, item.caseName])
      if (seen.has(key) || item.status !== "pass" || !decimal(item.jobId) || !sha256(item.evidenceSha256))
        fail("proof case was repeated skipped failed or lacks actual evidence")
      seen.add(key)
    }
    for (const obligation of obligations) {
      const file = byFile.get(fileKey("source", obligation.path))
      if (!file || file.sha256 !== obligation.fileSha256 ||
          !seen.has(JSON.stringify([obligation.path, obligation.fileSha256, obligation.caseName])))
        blockers.push("test-obligation-not-executed:" + obligation.path + ":" + obligation.caseName)
    }
    proofEvidence = { receiptSha256: digest(proofs), authentication, cases: proofs.cases.length, obligations: obligations.length }
  } else blockers.push("executed-test-obligations-missing")
  return {
    schema: "teams-profile-residue-report-v1",
    status: blockers.length === 0 ? "PASS" : "DIAGNOSTIC_UNQUALIFIED",
    binding, execution: { workflowSHA: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT },
    readOnly: true, counts, blockers: [...new Set(blockers)],
    source: { sha: source.sha, tree: source.tree, trackedCount: source.trackedCount ?? records.filter((file) => file.domain === "source").length },
    artifact: artifact ?? { status: "MISSING" }, inventory,
    occurrences: classified, reachability: { ...graph, findings: classifiedGaps },
    review: reviewAuthentication ? { status: "BOUND", reviewer: review.reviewer, reviewSource: review.reviewSource,
      receiptSha256: digest(review), authentication: reviewAuthentication } : { status: "MISSING" },
    controls: controlEvidence ?? { status: "MISSING" }, proofs: proofEvidence ?? { status: "MISSING" },
    limitations: [
      "File imports and lexical callsites are conservative evidence; runtime meaning requires the precise independent dispositions and executed obligations.",
      "A G09 PASS is residue qualification only. Native journeys, Microsoft operations, migration, recovery and other mandatory gates remain separate.",
      "The host must provision trust anchors independently of the candidate and sidecars, and must isolate signing keys from audited code.",
    ],
  }
}
function utf8Offset(file, byteOffset) {
  if (!file || file.text === undefined) return -1
  if (file.encoding === "utf16le" || file.encoding === "utf16be") return (byteOffset - 2) / 2
  return Buffer.from(file.data.subarray(0, byteOffset)).toString("utf8").length
}

async function outsideFile(filename, root, label) {
  if (typeof filename !== "string" || !path.isAbsolute(filename)) fail(label + " requires an absolute path")
  const actual = await realpath(filename), relative = path.relative(root, actual)
  if (relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
    fail(label + " must be outside the read-only checkout")
  if (!(await lstat(actual)).isFile()) fail(label + " must be a real regular file")
  return readFile(actual)
}
async function optionalJson(filename, root, label) {
  return filename === undefined ? undefined : parseCanonicalJson(await outsideFile(filename, root, label), label)
}
export function parseArguments(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === "--diagnostic-source-only") {
      if (values.sourceOnly) fail("duplicate source-only option")
      values.sourceOnly = true; continue
    }
    if (!["--source", "--archive", "--manifest", "--output", "--installed-release", "--stage-private-release", "--service-pid"].includes(key) ||
        values[key.slice(2)] !== undefined || !argv[index + 1] || argv[index + 1].startsWith("--"))
      fail("unknown duplicate or incomplete argument")
    values[key.slice(2)] = argv[++index]
  }
  if (!values.source || !values.manifest || !values.output || (!values.archive && !values.sourceOnly) ||
      values.archive && values.sourceOnly ||
      (values["installed-release"] || values["stage-private-release"]) && !values.archive ||
      values["installed-release"] && values["stage-private-release"] ||
      values["service-pid"] !== undefined && (!values["installed-release"] || !decimal(values["service-pid"]) ||
        !Number.isSafeInteger(Number(values["service-pid"]))))
    fail("exact source/archive/catalog/output selection required")
  return values
}
export async function runAudit(options, env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      env.GITHUB_REPOSITORY_ID !== "1455724710" || env.RUNNER_OS !== "Linux" || env.RUNNER_ARCH !== "X64" ||
      !sha(env.SF_PRODUCT_SOURCE_SHA) || !sha(env.GITHUB_SHA) ||
      !decimal(env.GITHUB_RUN_ID) || !decimal(env.GITHUB_RUN_ATTEMPT))
    fail("exact hosted product source/workflow/run identity required")
  const root = await realpath(options.source)
  const commitBytes = await outsideFile(env.SF_TEAMS_RESIDUE_COMMIT_FILE, root, "raw commit evidence")
  const trackedBytes = await outsideFile(env.SF_TEAMS_RESIDUE_TRACKED_FILE, root, "NUL tracked inventory")
  const verified = verifyGitSource(commitBytes, trackedBytes, env.SF_PRODUCT_SOURCE_SHA)
  const source = { sha: verified.sha, tree: verified.tree, trackedCount: verified.entries.length }
  const loaded = await readSource(root, verified)
  const manifest = safePath(options.manifest)
  const catalogRecord = loaded.records.find((file) => file.path === manifest && file.kind === "regular")
  if (!catalogRecord) fail("catalog must be an actual tracked regular source file")
  let archiveFiles = [], artifact, installedRelease
  if (options.archive) {
    const compressed = await outsideFile(options.archive, root, "production archive")
    const inventoryBytes = await outsideFile(env.SF_TEAMS_RESIDUE_INVENTORY_FILE, root, "archive inventory")
    const receiptBytes = await outsideFile(env.SF_TEAMS_RESIDUE_RECEIPT_FILE, root, "archive receipt")
    const provenance = await optionalJson(env.SF_TEAMS_RESIDUE_PROVENANCE_FILE, root, "artifact provenance")
    if (!provenance) fail("same-run artifact provenance required")
    archiveFiles = readTarArchive(compressed)
    artifact = verifyArtifact({ source, archiveFile: path.basename(options.archive), compressed, files: archiveFiles,
      inventoryBytes, receiptBytes, provenance, env })
    const releaseRoot = options["installed-release"]
    if (releaseRoot !== undefined) {
      if (!path.isAbsolute(releaseRoot) || await realpath(releaseRoot) !== releaseRoot)
        fail("canonical installed release directory required")
      const relative = path.relative(root, releaseRoot)
      if (relative !== ".." && !relative.startsWith(".." + path.sep))
        fail("installed release directory must be outside checkout")
      const { verifyTeamsInstalledRelease, verifyTeamsRunningExecutable } = await import("./teams-installed-release.mjs")
      const pid = options["service-pid"]
      installedRelease = pid === undefined
        ? await verifyTeamsInstalledRelease({ releaseRoot, files: archiveFiles })
        : await verifyTeamsRunningExecutable({ releaseRoot, files: archiveFiles, pid: Number(pid) })
    }
  }
  const records = [...loaded.records, ...archiveFiles]
  // Provision this file through the trusted host, independently of the audit
  // inputs. Outside-checkout placement alone does not establish trust.
  const trust = await optionalJson(env.SF_TEAMS_RESIDUE_TRUST_FILE, root, "independent residue trust anchors")
  const review = await optionalJson(env.SF_TEAMS_RESIDUE_REVIEW_FILE, root, "current-source independent review")
  const controls = await optionalJson(env.SF_TEAMS_RESIDUE_CONTROLS_FILE, root, "executed residue controls")
  const proofs = await optionalJson(env.SF_TEAMS_RESIDUE_PROOFS_FILE, root, "executed test obligations")
  const report = auditResidues({ source, records, sourceGaps: loaded.gaps, artifact,
    catalogBytes: catalogRecord.data, review, controls, proofs, trust, env })
  // Bind again after graph traversal. Root CI separately proves the clean index
  // before/after; this catches concurrent changes to any byte actually audited.
  const after = await readSource(root, verified)
  if (digest(after.records.map(publicFile)) !== digest(loaded.records.map(publicFile)))
    fail("tracked source drifted during read-only audit")
  report.source = { ...report.source, commitSha256: verified.commitSha256,
    trackedInventorySha256: verified.inventorySha256, byteBoundCount: loaded.byteBoundCount,
    contentsComplete: loaded.contentsComplete, recheckedAfter: true }
  if (installedRelease) report.installedRelease = installedRelease
  if (options["stage-private-release"] !== undefined) {
    const destination = options["stage-private-release"]
    await requirePrivateStagePaths({ destination, output: options.output, root, runnerTemp: env.RUNNER_TEMP })
    if (artifact?.status !== "BOUND") fail("private staging requires exact bound archive")
    const { stageVerifiedTeamsRelease } = await import("./teams-stage-release.mjs")
    const staged = await stageVerifiedTeamsRelease({ destination, files: archiveFiles })
    report.readOnly = false
    report.privateStage = { status: "STAGED_NOT_ACTIVATED", archiveSha256: artifact.archiveSha256, ...staged }
  }
  return report
}

export async function requirePrivateStagePaths({ destination, output, root, runnerTemp }) {
  if (![destination, output, runnerTemp].every((value) => typeof value === "string" &&
      path.isAbsolute(value) && path.resolve(value) === value)) fail("private staging and report require normalized absolute paths")
  const [temporary, parent, reportParent] = await Promise.all([
    realpath(runnerTemp), realpath(path.dirname(destination)), realpath(path.dirname(output)),
  ])
  const within = (base, value) => {
    const relative = path.relative(base, value)
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)
  }
  const reportPath = path.join(reportParent, path.basename(output))
  if (parent !== path.dirname(destination) || !within(temporary, parent) || within(root, destination) ||
      !within(temporary, reportParent) || within(root, reportPath) || within(destination, reportPath))
    fail("private staging and report must be separate, inside RUNNER_TEMP and outside the checkout")
  const existingReport = await lstat(reportPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error
  })
  if (existingReport) fail("private staging requires a fresh report path")
}
async function writeReport(filename, source, report, env) {
  if (!path.isAbsolute(filename) || typeof env.RUNNER_TEMP !== "string" || !path.isAbsolute(env.RUNNER_TEMP))
    fail("fresh output in RUNNER_TEMP required")
  const [root, temporary, parent] = await Promise.all([realpath(source), realpath(env.RUNNER_TEMP), realpath(path.dirname(filename))])
  const toSource = path.relative(root, parent), toTemporary = path.relative(temporary, parent)
  if (toSource === "" || !toSource.startsWith(".." + path.sep) && toSource !== ".." && !path.isAbsolute(toSource) ||
      toTemporary === ".." || toTemporary.startsWith(".." + path.sep) || path.isAbsolute(toTemporary))
    fail("output must be inside RUNNER_TEMP and outside the checkout")
  await writeFile(path.join(parent, path.basename(filename)), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
    const report = await runAudit(options)
    await writeReport(options.output, options.source, report, process.env)
    console.log("TEAM_PROFILE_RESIDUE " + JSON.stringify({ status: report.status, binding: report.binding,
      counts: report.counts, blockers: report.blockers, output: options.output }))
    process.exitCode = report.status === "PASS" ? 0 : 2
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown audit error"
    if (options) {
      try { await writeReport(options.output, options.source, { schema: "teams-profile-residue-report-v1",
        status: "FAIL_CLOSED", readOnly: options["stage-private-release"] === undefined, reason }, process.env) }
      catch (reportError) { console.error("TEAM_PROFILE_RESIDUE_REPORT_FAILED", reportError instanceof Error ? reportError.message : "output failed") }
    }
    console.error("TEAM_PROFILE_RESIDUE_FAIL_CLOSED", reason)
    process.exitCode = 1
  }
}
