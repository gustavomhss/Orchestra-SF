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
function safeCents(v) {
  if (v < 0n || v > BigInt(Number.MAX_SAFE_INTEGER)) problem('oracle amount exceeds exact integer range');
  return Number(v);
}
export function independentOracle(o) {
  if (o?.kind === 'forecast-variants-v1') {
    const baseline = cents(o.baselineCents), budget = cents(o.budgetCents), original = cents(o.originalLicenseCents);
    const a = baseline - original + cents(o.scenarioACents);
    const b = baseline - original + cents(o.scenarioBCents);
    return { outlookACents: Number(a), outlookBCents: Number(b), deltaACents: Number(a - baseline), deltaBCents: Number(b - baseline), marginACents: Number(budget - a), marginBCents: Number(budget - b) };
  }
  if (o?.kind === 'quote-choice-v1') {
    if (Object.keys(o).some(k => !['kind','eurUsdRateNumerator','eurUsdRateDenominator','quotes'].includes(k))) problem('legacy oracle winner/eligibility assertions are not independent inputs');
    const numerator = cents(o.eurUsdRateNumerator), denominator = cents(o.eurUsdRateDenominator);
    if (denominator <= 0n) problem('oracle FX denominator invalid');
    if (numerator <= 0n || !Array.isArray(o.quotes) || o.quotes.length !== 3) problem('oracle requires three positive-FX quotes');
    const ids = new Set(o.quotes.map(q => q?.id));
    if (ids.size !== 3 || [...ids].some(id => !['A','B','C'].includes(id))) problem('oracle must contain exactly A, B and C');
    const priced = o.quotes.map(q => {
      if (!object(q) || !Number.isSafeInteger(q.totalCents) || q.totalCents < 0 || typeof q.eligible !== 'boolean' || !['USD','EUR'].includes(q.currency)) problem('invalid quote oracle input');
      const total = cents(q.totalCents) * (q.currency === 'EUR' ? numerator : denominator);
      if (total % denominator !== 0n) problem('oracle FX requires explicit rounding');
      return { id: q.id, eligible: q.eligible, usdCents: safeCents(total / denominator) };
    });
    const eligible = priced.filter(q => q.eligible).sort((a,b) => a.usdCents - b.usdCents);
    if (eligible.length === 0) problem('no eligible quote');
    if (eligible.length > 1 && eligible[0].usdCents === eligible[1].usdCents) problem('price tie requires explicit decision oracle');
    return { quoteBUsdCents: priced.find(q => q.id === 'B').usdCents,
      quoteCEligible: priced.find(q => q.id === 'C').eligible,
      expectedWinner: eligible[0].id };
  }
  problem('unknown oracle model');
}
export function validatePlan(plan) {
  if (!object(plan) || plan.schema !== 'sf-uat-pilot-proof-plan-v1' || !SHA40.test(plan.sourceBaseline) || !Array.isArray(plan.cases)) problem('bad plan schema');
  const caseIds = new Set(), proofIds = new Set();
  for (const c of plan.cases) {
    if (!/^QA2-00[1-8]$/.test(c.caseId) || caseIds.has(c.caseId) || !Number.isInteger(c.minDistinctActors) || c.minDistinctActors < 1 || !Array.isArray(c.proofs) || c.proofs.length === 0) problem('bad case definition');
    caseIds.add(c.caseId);
    if (c.separateRoles !== undefined) {
      if (!Array.isArray(c.separateRoles) || c.separateRoles.length < 2 ||
          new Set(c.separateRoles).size !== c.separateRoles.length ||
          c.separateRoles.some(role => !text(role) || !c.proofs.some(p => p.actorRole === role))) problem('invalid incompatible-role matrix');
    }
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
  if (!Array.isArray(proof.actor_bindings) || proof.actor_bindings.some(a => !object(a) || !keepHash(a.principalHash) || !text(a.role))) problem('invalid actor bindings');
  const bindings = new Set(proof.actor_bindings.map(a => `${a.role}:${a.principalHash}`));
  if (bindings.size !== proof.actor_bindings.length) problem('duplicate actor bindings');
  if (!Array.isArray(proof.proofs) || proof.proofs.length !== planCase.proofs.length) problem('proof count differs from scoped plan');
  const byId = new Map(proof.proofs.map(o => [o.proofId, o]));
  if (byId.size !== planCase.proofs.length) problem('duplicate evidence proof IDs');
  const witnessedActors = new Set(), witnessedBindings = new Set(), byRole = new Map();
  for (const spec of planCase.proofs) {
    const o = byId.get(spec.id);
    if (!o) problem(`missing proof ${spec.id}`);
    validateProof(o, spec, byId, planCase);
    if (!bindings.has(`${o.actorRole}:${o.principalHash}`)) problem(`actor/witness mismatch: ${spec.id}`);
    witnessedActors.add(o.principalHash);
    witnessedBindings.add(`${o.actorRole}:${o.principalHash}`);
    if (!byRole.has(o.actorRole)) byRole.set(o.actorRole,new Set());
    byRole.get(o.actorRole).add(o.principalHash);
    await validateArtifact(dir, o);
  }
  if (witnessedActors.size < planCase.minDistinctActors) problem('insufficient participating distinct actors');
  if (witnessedBindings.size !== bindings.size) problem('unused decorative actor bindings');
  if (planCase.separateRoles?.length) {
    const participants = planCase.separateRoles.map(role => {
      const names = byRole.get(role);
      if (!names || names.size !== 1) problem(`inconsistent actor for role: ${role}`);
      return [...names][0];
    });
    if (new Set(participants).size !== participants.length) problem('separation of duties violated by same principal');
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
/** CLI exit status: 0 = read-only report or structurally admissible evidence; 1 = invalid; 2 = blocked/attestation pending. */
export function cliExitCode(out, { strict = false, requireAttestation = false } = {}) {
  if (out.results.some(x => x.status === 'INVALID_OR_INCOMPLETE')) return 1;
  if (out.state === 'SOURCE_RECONCILIATION_REQUIRED') return 2;
  if (requireAttestation || strict && out.state !== 'REQUIRES_EXTERNAL_ATTESTATION') return 2;
  return 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2), arg = k => { const at = args.indexOf(k); return at < 0 ? null : args[at + 1]; };
  try {
    if (args.some(x => !['--evidence-dir','--candidate','--strict','--require-attestation'].includes(x) && !args.some((opt,i) => i > 0 && ['--evidence-dir','--candidate'].includes(args[i-1]) && args[i] === x))) problem('unknown command argument');
    const e = arg('--evidence-dir'), c = arg('--candidate');
    if ((args.includes('--evidence-dir') && (!e || e.startsWith('--'))) || (args.includes('--candidate') && (!c || c.startsWith('--')))) problem('missing command argument value');
    const out = await audit({ evidenceDir: e, candidateSha: c });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exitCode = cliExitCode(out, { strict: args.includes('--strict'), requireAttestation: args.includes('--require-attestation') });
  } catch (e) { process.stderr.write(`SF_UAT_PROOF_INVALID: ${e.message}\n`); process.exitCode = 1; }
}
