#!/usr/bin/env node
/** Read-only evidence admissibility check. Never asserts hosted success or release GO. */
import { createHash } from 'node:crypto';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, sep, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLAN = resolve(HERE, '../quality-v3/pilot-proof-plan.json');
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const SAFE_ALIAS = /^[a-zA-Z0-9_-]{2,80}$/;
const SAFE_PATH = /^(?!\.?\.?\/)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]{1,200}$/;
const SENSITIVE_KEY = /^(?:authorization|cookie|set-cookie|password|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|private[_-]?key|api[_-]?key|email|iban|account[_-]?number)$/i;
const KIND = new Set(['read', 'preview', 'oracle', 'commit', 'deny', 'recovery', 'receipt']);

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function problem(message) { throw new Error(message); }
function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function text(v) { return typeof v === 'string' && v.trim() !== ''; }
function keepHash(v) { return typeof v === 'string' && SHA64.test(v); }
function sameObject(a, b) { return object(a) && Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k,v]) => a[k] === v); }
function safeJson(value, path = '$') {
  if (Array.isArray(value)) { value.forEach((x, i) => safeJson(x, `${path}[${i}]`)); return; }
  if (!object(value)) return;
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) problem(`sensitive field in evidence: ${path}.${k}`);
    safeJson(v, `${path}.${k}`);
  }
}
function cents(v) { if (!Number.isSafeInteger(v)) problem('oracle amount must be integer cents'); return BigInt(v); }
export function independentOracle(o) {
  if (o?.kind === 'forecast-variants-v1') {
    const baseline = cents(o.baselineCents), budget = cents(o.budgetCents), original = cents(o.originalLicenseCents);
    const a = baseline - original + cents(o.scenarioACents);
    const b = baseline - original + cents(o.scenarioBCents);
    return { outlookACents: Number(a), outlookBCents: Number(b), deltaACents: Number(a - baseline), deltaBCents: Number(b - baseline), marginACents: Number(budget - a), marginBCents: Number(budget - b) };
  }
  if (o?.kind === 'quote-choice-v1') {
    const numerator = cents(o.eurUsdRateNumerator), denominator = cents(o.eurUsdRateDenominator);
    if (denominator <= 0n) problem('oracle FX denominator invalid');
    const total = cents(o.quoteBEurCents) * numerator;
    if (total % denominator !== 0n) problem('oracle FX requires explicit rounding');
    return { quoteBUsdCents: Number(total / denominator), quoteCEligible: o.quoteCEligible, expectedWinner: o.expectedWinner };
  }
  problem('unknown oracle model');
}
export function validatePlan(plan) {
  if (!object(plan) || plan.schema !== 'sf-uat-pilot-proof-plan-v1' || !SHA40.test(plan.sourceBaseline) || !Array.isArray(plan.cases)) problem('bad plan schema');
  const caseIds = new Set(), proofIds = new Set();
  for (const c of plan.cases) {
    if (!/^QA2-00[1-8]$/.test(c.caseId) || caseIds.has(c.caseId) || !Number.isInteger(c.minDistinctActors) || c.minDistinctActors < 1 || !Array.isArray(c.proofs) || c.proofs.length === 0) problem('bad case definition');
    caseIds.add(c.caseId);
    if (c.oracle) independentOracle(c.oracle);
    for (const p of c.proofs) {
      if (!/^[FPI]-\d{2}$/.test(p.id) || proofIds.has(p.id) || !KIND.has(p.kind) || !text(p.actorRole)) problem('bad proof definition');
      proofIds.add(p.id);
      if (p.kind === 'deny' && (!Array.isArray(p.allowedStatus) || p.allowedStatus.some(s => ![401,403,409,422].includes(s)))) problem('invalid deny status list');
    }
    for (const p of c.proofs) if (p.linksTo && !c.proofs.some(q => q.id === p.linksTo && q.kind === 'commit')) problem('recovery/receipt must reference case commit');
  }
  if (caseIds.size === 0 || caseIds.size !== plan.cases.length) problem('empty/duplicate proof plan');
  return plan;
}
async function readSmall(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size > 200_000) problem(`invalid evidence file: ${file}`);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function validateArtifact(dir, obs) {
  if (!text(obs.artifactPath) || !SAFE_PATH.test(obs.artifactPath) || !keepHash(obs.artifactSha256)) problem(`invalid artifact metadata: ${obs.proofId}`);
  const root = await realpath(dir), path = resolve(root, obs.artifactPath);
  if (!path.startsWith(root + sep)) problem('artifact path escapes evidence directory');
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > 20_000_000) problem('artifact is not a bounded regular file');
  const actual = await realpath(path);
  if (!actual.startsWith(root + sep)) problem('artifact symbolic link escape');
  if (sha256(await readFile(actual)) !== obs.artifactSha256) problem(`artifact hash mismatch: ${obs.proofId}`);
}
function status2xx(code) { return Number.isInteger(code) && code >= 200 && code < 300; }
function presentDigest(o) { return keepHash(o.beforeDigest) && keepHash(o.afterDigest); }
function requireStatus(o, allowed = null) {
  if (allowed ? !allowed.includes(o.httpStatus) : !status2xx(o.httpStatus)) problem(`HTTP witness mismatch: ${o.proofId}`);
}
function validateProof(o, def, index, planCase) {
  if (!object(o) || o.proofId !== def.id || o.kind !== def.kind || o.actorRole !== def.actorRole || !text(o.correlationRef) || !keepHash(o.principalHash) || !Number.isFinite(Date.parse(o.observedAt ?? ''))) problem(`invalid proof witness: ${def.id}`);
  if (def.from && (o.fromState !== def.from || o.toState !== def.to)) problem(`state transition mismatch: ${def.id}`);
  if (['commit', 'deny', 'preview', 'recovery', 'receipt'].includes(o.kind) && !presentDigest(o)) problem(`missing before/after: ${def.id}`);
  if (o.kind === 'deny') {
    requireStatus(o, def.allowedStatus);
    if (o.beforeDigest !== o.afterDigest) problem(`denial changed state: ${def.id}`);
  } else {
    requireStatus(o);
    if (o.kind === 'preview' && o.beforeDigest !== o.afterDigest) problem('preview changed producer');
    if (o.kind === 'commit' && (o.beforeDigest === o.afterDigest || !text(o.receiptRef) || !keepHash(o.receiptDigest) || !keepHash(o.idempotencyKeyHash))) problem(`commit witness invalid: ${def.id}`);
    if (o.kind === 'recovery' || o.kind === 'receipt') {
      const commit = index.get(def.linksTo);
      if (!commit || commit.kind !== 'commit' || o.receiptRef !== commit.receiptRef || o.receiptDigest !== commit.receiptDigest || o.afterDigest !== commit.afterDigest || o.idempotencyKeyHash !== commit.idempotencyKeyHash) problem(`recovery did not reconcile original receipt: ${def.id}`);
    }
    if (o.kind === 'oracle') {
      if (!planCase.oracle || !object(o.observed)) problem('missing independent oracle witness');
      const expected = independentOracle(planCase.oracle);
      if (!sameObject(o.observed, expected)) problem(`independent oracle mismatch: ${def.id}`);
    }
  }
}
export async function inspectEvidence(planCase, proof, dir, candidateSha) {
  if (!object(proof) || proof.schema !== 'sf-uat-evidence-v1' || proof.case_id !== planCase.caseId || proof.product_commit_sha !== candidateSha || !SAFE_ALIAS.test(proof.installation_alias ?? '') || !SAFE_ALIAS.test(proof.tenant_alias ?? '') || !text(proof.attempt_id) || !text(proof.operator_alias) || !Number.isFinite(Date.parse(proof.timestamp_utc ?? '')) || !keepHash(proof.fixture_source_sha256) || !SHA40.test(proof.git_tree_sha ?? '') || !keepHash(proof.installed_artifact_sha256)) problem('invalid V2 evidence envelope / candidate mismatch');
  safeJson(proof);
  if (!Array.isArray(proof.actor_bindings) || new Set(proof.actor_bindings.map(a => a?.principalHash)).size < planCase.minDistinctActors || proof.actor_bindings.some(a => !keepHash(a.principalHash) || !text(a.role))) problem('insufficient distinct actors');
  if (!Array.isArray(proof.proofs) || proof.proofs.length !== planCase.proofs.length) problem('proof count differs from scoped plan');
  const byId = new Map(proof.proofs.map(o => [o.proofId, o]));
  if (byId.size !== planCase.proofs.length) problem('duplicate evidence proof IDs');
  for (const spec of planCase.proofs) {
    const o = byId.get(spec.id);
    if (!o) problem(`missing proof ${spec.id}`);
    validateProof(o, spec, byId, planCase);
    if (!proof.actor_bindings.some(actor => actor.principalHash === o.principalHash && actor.role === o.actorRole)) problem(`actor/witness mismatch: ${spec.id}`);
    await validateArtifact(dir, o);
  }
  // Written V2 reviewer metadata is neither a cryptographic signature nor a hosted source check.
  return { caseId: planCase.caseId, status: 'EVIDENCE_SUBMITTED_REQUIRES_EXTERNAL_VERIFICATION', proofCount: byId.size };
}
export async function audit({ plan = DEFAULT_PLAN, evidenceDir = null, candidateSha = null } = {}) {
  const ledger = validatePlan(await readSmall(plan));
  if (evidenceDir && !candidateSha) problem('explicit --candidate required when checking submitted evidence');
  const candidate = candidateSha ?? ledger.sourceBaseline;
  if (!SHA40.test(candidate)) problem('candidate must be 40 hexadecimal characters');
  const result = { schema: 'sf-uat-proof-audit-v1', candidateSha: candidate, hostedVerified: false, releaseGo: false, state: 'PENDING', results: [] };
  for (const c of ledger.cases) {
    if (!evidenceDir) { result.results.push({ caseId: c.caseId, status: 'NOT_RUN' }); continue; }
    const p = join(evidenceDir, c.caseId + '.json');
    try { const proof = await readSmall(p); result.results.push(await inspectEvidence(c, proof, evidenceDir, candidate)); }
    catch (error) { result.results.push({ caseId: c.caseId, status: error?.code === 'ENOENT' ? 'NOT_RUN' : 'INVALID_OR_INCOMPLETE', reason: String(error.message).slice(0,160) }); }
  }
  result.state = candidate !== ledger.sourceBaseline ? 'SOURCE_RECONCILIATION_REQUIRED' : result.results.every(x => x.status === 'EVIDENCE_SUBMITTED_REQUIRES_EXTERNAL_VERIFICATION') ? 'REQUIRES_EXTERNAL_ATTESTATION' : 'PENDING';
  return result;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2), arg = k => { const at = args.indexOf(k); return at < 0 ? null : args[at + 1]; };
  try {
    const out = await audit({ evidenceDir: arg('--evidence-dir'), candidateSha: arg('--candidate') });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    if (args.includes('--require-attestation')) process.exitCode = 2;
  } catch (e) { process.stderr.write(`SF_UAT_PROOF_INVALID: ${e.message}\n`); process.exitCode = 1; }
}
