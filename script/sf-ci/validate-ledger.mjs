#!/usr/bin/env node
// Phase A inventory validator. Deliberately dependency-free and fail-closed.
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = join(root, "docs/qa/sucafina/consolidation/ledger.schema.json");
const ledgerPath = join(root, "docs/qa/sucafina/consolidation/ledger.jsonl");
const EXPECTED_LINES = 37603;
const REPLAY_BUNDLES = new Set(["B0", "B1", "B2", "B3", "FINAL"]);
const DISPOSITIONS = new Set([
  "UNREVIEWED", "ABSORBED_ANCESTOR", "ABSORBED_BLOB", "ABSORBED_PATCH",
  "DUPLICATE_HEAD", "SUPERSEDED", "REPLAY", "DOCS_ONLY",
  "DROP_WITH_EVIDENCE", "BLOCKED_OWNER_DECISION", "BLOCKED_MISSING_BRANCH",
  "BLOCKED_SEMANTIC_CONFLICT", "PROMOTION_ONLY",
]);
const SCHEMA_KEYWORDS = new Set([
  "$schema", "$id", "title", "description", "default", "type",
  "additionalProperties", "required", "properties", "const", "enum",
  "pattern", "format", "minimum", "minLength", "items", "minItems",
  "uniqueItems", "allOf", "if", "then", "else", "not",
]);
const patterns = new Map();

function schemaCheck(rule, at = "$") {
  if (!rule || Array.isArray(rule) || typeof rule !== "object") {
    throw new Error("UNSUPPORTED_SCHEMA at " + at);
  }
  for (const key of Object.keys(rule)) {
    if (!SCHEMA_KEYWORDS.has(key)) {
      throw new Error("UNSUPPORTED_SCHEMA keyword " + at + "." + key);
    }
  }
  if (rule.additionalProperties !== undefined &&
      typeof rule.additionalProperties !== "boolean") {
    throw new Error("UNSUPPORTED_SCHEMA additionalProperties at " + at);
  }
  if (rule.pattern !== undefined) new RegExp(rule.pattern);
  if (rule.format !== undefined && rule.format !== "date-time") {
    throw new Error("UNSUPPORTED_SCHEMA format " + rule.format);
  }
  for (const [key, child] of Object.entries(rule.properties ?? {})) {
    schemaCheck(child, at + ".properties." + key);
  }
  if (rule.items !== undefined) schemaCheck(rule.items, at + ".items");
  for (const key of ["allOf"]) {
    for (const [index, child] of (rule[key] ?? []).entries()) {
      schemaCheck(child, at + "." + key + "[" + index + "]");
    }
  }
  for (const key of ["if", "then", "else", "not"]) {
    if (rule[key] !== undefined) schemaCheck(rule[key], at + "." + key);
  }
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isSafeInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validDateTime(value) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!m) return false;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
}

function validate(value, rule, at, errors) {
  if (rule.type !== undefined) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(at + ": type mismatch");
      return;
    }
  }
  if (Object.hasOwn(rule, "const") && !isDeepStrictEqual(value, rule.const)) {
    errors.push(at + ": unexpected const");
  }
  if (rule.enum && !rule.enum.some((item) => isDeepStrictEqual(value, item))) {
    errors.push(at + ": unknown enum value");
  }
  if (typeof value === "string") {
    if (rule.minLength !== undefined && [...value].length < rule.minLength) {
      errors.push(at + ": minLength");
    }
    if (rule.pattern !== undefined) {
      if (!patterns.has(rule.pattern)) patterns.set(rule.pattern, new RegExp(rule.pattern));
      if (!patterns.get(rule.pattern).test(value)) errors.push(at + ": pattern");
    }
    if (rule.format === "date-time" && !validDateTime(value)) {
      errors.push(at + ": invalid RFC3339 date-time");
    }
  }
  if (typeof value === "number" && rule.minimum !== undefined &&
      value < rule.minimum) {
    errors.push(at + ": minimum");
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      errors.push(at + ": minItems");
    }
    if (rule.uniqueItems) {
      for (let i = 0; i < value.length; i++) {
        if (value.slice(0, i).some((previous) => isDeepStrictEqual(previous, value[i]))) {
          errors.push(at + ": duplicate array item");
          break;
        }
      }
    }
    if (rule.items) {
      value.forEach((item, index) => validate(item, rule.items, at + "[" + index + "]", errors));
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of (rule.required ?? [])) {
      if (!Object.hasOwn(value, key)) errors.push(at + ": missing " + key);
    }
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(rule.properties ?? {}, key)) {
          errors.push(at + ": unexpected " + key);
        }
      }
    }
    for (const [key, child] of Object.entries(rule.properties ?? {})) {
      if (Object.hasOwn(value, key)) validate(value[key], child, at + "." + key, errors);
    }
  }
  for (const child of (rule.allOf ?? [])) validate(value, child, at, errors);
  if (rule.not) {
    const probe = [];
    validate(value, rule.not, at, probe);
    if (probe.length === 0) errors.push(at + ": prohibited by not");
  }
  if (rule.if) {
    const probe = [];
    validate(value, rule.if, at, probe);
    const branch = probe.length === 0 ? rule.then : rule.else;
    if (branch) validate(value, branch, at, errors);
  }
}

function sortedCounts(counts) {
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
}
function increment(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

async function main() {
  if (process.argv.length !== 2) throw new Error("USAGE: node script/sf-ci/validate-ledger.mjs");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("UNSUPPORTED_SCHEMA draft");
  }
  schemaCheck(schema);
  if (!statSync(ledgerPath).isFile()) throw new Error("LEDGER_MISSING: not a file");

  const errors = [];
  let errorCount = 0;
  const fail = (line, code, detail) => {
    errorCount++;
    if (errors.length < 40) errors.push("line " + line + " " + code + ": " + detail);
  };
  const recordIds = new Set();
  const sources = new Map();
  const heads = new Map();
  const dispositions = new Map();
  const bundles = new Map();
  const replayBundles = new Map();
  const absorbedPatchPaths = new Set();
  let lineNo = 0;
  let readyCount = 0;

  const lines = createInterface({ input: createReadStream(ledgerPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    lineNo++;
    if (!line.trim()) {
      fail(lineNo, "EMPTY_LINE", "every line must be one JSON record");
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      fail(lineNo, "INVALID_JSON", error.message);
      continue;
    }
    const violations = [];
    validate(record, schema, "$", violations);
    for (const violation of violations.slice(0, 8)) fail(lineNo, "SCHEMA_INVALID", violation);
    if (violations.length > 8) fail(lineNo, "SCHEMA_INVALID", (violations.length - 8) + " additional violations");
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;

    if (!DISPOSITIONS.has(record.disposition)) {
      fail(lineNo, "UNKNOWN_DISPOSITION", String(record.disposition));
    }
    if (!Array.isArray(record.evidence) || record.evidence.length === 0 ||
        record.evidence.some((entry) => !entry || typeof entry.detail !== "string" || !entry.detail.trim())) {
      fail(lineNo, "MISSING_EVIDENCE", "nonempty evidence details required");
    }
    if (record.disposition === "REPLAY" && !REPLAY_BUNDLES.has(record.bundle)) {
      fail(lineNo, "INVALID_REPLAY_BUNDLE", String(record.bundle));
    }
    if (record.close_ready === true &&
        (!/^[0-9a-f]{40}$/i.test(record.merged_sha ?? "") ||
         !Array.isArray(record.ci_runs) || record.ci_runs.length === 0 ||
         !Array.isArray(record.evidence) ||
         !record.evidence.some((entry) => entry && entry.type === "CI_RUN" &&
           typeof entry.detail === "string" && entry.detail.trim()))) {
      fail(lineNo, "CLOSE_READY_WITHOUT_PROOF", "merged_sha, ci_runs, and CI_RUN evidence required");
    }
    if (typeof record.record_id !== "string" || recordIds.has(record.record_id)) {
      fail(lineNo, "DUPLICATE_OR_INVALID_RECORD_ID", String(record.record_id));
    } else {
      recordIds.add(record.record_id);
    }
    if (Number.isSafeInteger(record.source_pr) &&
        typeof record.record_id === "string" &&
        !record.record_id.startsWith("PR-" + record.source_pr + ":")) {
      fail(lineNo, "RECORD_PR_MISMATCH", record.record_id);
    }
    if (violations.length > 0) continue;

    const prior = sources.get(record.source_pr);
    if (prior && prior.head !== record.source_head) {
      fail(lineNo, "SOURCE_HEAD_DRIFT", "PR " + record.source_pr + " has multiple head SHAs");
    } else {
      sources.set(record.source_pr, {
        head: record.source_head,
        state: record.source_state ?? prior?.state ?? null,
      });
    }
    if (!heads.has(record.source_head)) heads.set(record.source_head, new Set());
    heads.get(record.source_head).add(record.source_pr);
    increment(dispositions, record.disposition);
    increment(bundles, record.bundle);
    if (record.disposition === "REPLAY") increment(replayBundles, record.bundle);
    if (record.disposition === "ABSORBED_PATCH" && record.scope.path !== "__all__") {
      absorbedPatchPaths.add(record.scope.path);
    }
    if (record.close_ready === true) readyCount++;
  }
  if (lineNo !== EXPECTED_LINES) {
    fail(0, "RECORD_COUNT_MISMATCH", "expected " + EXPECTED_LINES + ", found " + lineNo);
  }
  if (errorCount) {
    console.error("INVALID_LEDGER errors=" + errorCount);
    for (const error of errors) console.error(error);
    if (errorCount > errors.length) console.error("... " + (errorCount - errors.length) + " further errors");
    process.exitCode = 1;
    return;
  }
  const duplicateHeadGroups = [...heads.values()].filter((prs) => prs.size > 1).length;
  const openPrs = [...sources.values()].filter((source) => source.state === "OPEN").length;
  const stateUnknownPrs = [...sources.values()].filter((source) => source.state === null).length;
  console.log("VALID_LEDGER " + JSON.stringify({
    records: lineNo,
    unique_record_ids: recordIds.size,
    source_prs: sources.size,
    open_prs_observed: openPrs,
    state_unknown_prs: stateUnknownPrs,
    close_ready_records: readyCount,
    duplicate_head_groups: duplicateHeadGroups,
    patch_absorbed_unique_paths: absorbedPatchPaths.size,
    by_disposition: sortedCounts(dispositions),
    by_bundle: sortedCounts(bundles),
    replay_by_bundle: sortedCounts(replayBundles),
  }));
}

main().catch((error) => {
  const code = error.code === "ENOENT" ? "LEDGER_OR_SCHEMA_MISSING" : "VALIDATOR_ERROR";
  console.error(code + ": " + error.message);
  process.exitCode = 1;
});
