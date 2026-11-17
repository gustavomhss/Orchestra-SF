import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, independentOracle, inspectEvidence, sha256, validatePlan } from './verify-uat-proof.mjs';

const planPath = resolve(fileURLToPath(new URL('../quality-v3/pilot-proof-plan.json', import.meta.url)));
const SHA = 'a1e774ec9e1fc28c81e0b42a1889c0425060aed9';
const hash = s => sha256(Buffer.from(s));
const actor = hash('synthetic-finance-actor');
const before = hash('before-state');
const after = hash('after-state');
const receipt = hash('receipt-one');
const idem = hash('idempotency-key');

const plan = validatePlan(JSON.parse(await (await import('node:fs/promises')).readFile(planPath, 'utf8')));
const qa003 = plan.cases.find(x => x.caseId === 'QA2-003');

async function makeEnv() {
  const dir = await mkdtemp(join(tmpdir(), 'sf-uat-'));
  const payload = 'SYNTHETIC_LOG_ONLY\n';
  await writeFile(join(dir, 'witness.txt'), payload);
  const base = {
    principalHash: actor, actorRole: 'finance', observedAt: '2026-11-16T18:00:00Z',
    correlationRef: 'corr-synthetic', artifactPath: 'witness.txt', artifactSha256: hash(payload),
    beforeDigest: before, afterDigest: before, httpStatus: 200
  };
  const observations = qa003.proofs.map(p => ({ ...base, proofId: p.id, kind: p.kind }));
  const by = Object.fromEntries(observations.map(o => [o.proofId, o]));
  by['I-02'].httpStatus = 409;
  by['I-03'].afterDigest = after;
  Object.assign(by['I-03'], { receiptRef: 'receipted-import-1', receiptDigest: receipt, idempotencyKeyHash: idem });
  for (const k of ['I-04', 'I-05']) Object.assign(by[k], { afterDigest: after, receiptRef: 'receipted-import-1', receiptDigest: receipt, idempotencyKeyHash: idem });
  const proof = { schema: 'sf-uat-evidence-v1', case_id: 'QA2-003', product_commit_sha: SHA,
    attempt_id: 'run-synthetic-not-real', installation_alias: 'isolated-test-only', tenant_alias: 'QA-TENANT-A',
    operator_alias: 'synthetic-operator', timestamp_utc: '2026-11-16T18:00:00Z', git_tree_sha: SHA, installed_artifact_sha256: hash('package'),
    fixture_source_sha256: hash('fixture'), actor_bindings: [{ principalHash: actor, role: 'finance' }], proofs: observations
  };
  return { dir, proof };
}

test('pilot plan is three cases, not another 185-story duplicate', () => {
  assert.equal(plan.cases.length, 3);
  assert.equal(plan.cases.reduce((n, c) => n + c.proofs.length, 0), 21);
});

test('independent integer-cent oracles protect forecast and FX, including eligibility', () => {
  assert.deepEqual(independentOracle(plan.cases[0].oracle), {
    outlookACents: 60200000, outlookBCents: 59600000, deltaACents: 1200000,
    deltaBCents: 600000, marginACents: -200000, marginBCents: 400000
  });
  assert.deepEqual(independentOracle(plan.cases[1].oracle), {
    quoteBUsdCents: 3024000, quoteCEligible: false, expectedWinner: 'B'
  });
});

test('zero evidence yields NOT_RUN and never a hosted PASS', async () => {
  const result = await audit({ plan: planPath });
  assert.equal(result.state, 'PENDING');
  assert.equal(result.releaseGo, false);
  assert.equal(result.hostedVerified, false);
  assert.ok(result.results.every(r => r.status === 'NOT_RUN'));
});

test('complete local synthetic evidence is admitted for external review, never marked passed', async t => {
  const { dir, proof } = await makeEnv();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const r = await inspectEvidence(qa003, proof, dir, SHA);
  assert.equal(r.status, 'EVIDENCE_SUBMITTED_REQUIRES_EXTERNAL_VERIFICATION');
  assert.equal(r.proofCount, 5);
});

test('wrong candidate, mutated denial, changed original receipt and exposed token are refused', async t => {
  const { dir, proof } = await makeEnv();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(inspectEvidence(qa003, { ...proof, product_commit_sha: 'f'.repeat(40) }, dir, SHA), /candidate mismatch/);
  const mutate = structuredClone(proof);
  mutate.proofs.find(p => p.proofId === 'I-02').afterDigest = after;
  await assert.rejects(inspectEvidence(qa003, mutate, dir, SHA), /denial changed state/);
  const receiptDrift = structuredClone(proof);
  receiptDrift.proofs.find(p => p.proofId === 'I-04').receiptDigest = hash('wrong-receipt');
  await assert.rejects(inspectEvidence(qa003, receiptDrift, dir, SHA), /original receipt/);
  await assert.rejects(inspectEvidence(qa003, { ...proof, access_token: 'not-allowed' }, dir, SHA), /sensitive field/);
});

test('tampered witness and misbound actor are refused', async t => {
  const { dir, proof } = await makeEnv();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const badActor = structuredClone(proof);
  badActor.proofs[0].principalHash = hash('different-actor');
  await assert.rejects(inspectEvidence(qa003, badActor, dir, SHA), /actor\/witness mismatch/);
  await writeFile(join(dir, 'witness.txt'), 'TAMPERED');
  await assert.rejects(inspectEvidence(qa003, proof, dir, SHA), /hash mismatch/);
});

test('source changed requires explicit reconciliation even with no evidence', async () => {
  const r = await audit({ plan: planPath, candidateSha: 'f'.repeat(40) });
  assert.equal(r.state, 'SOURCE_RECONCILIATION_REQUIRED');
  assert.equal(r.releaseGo, false);
});
