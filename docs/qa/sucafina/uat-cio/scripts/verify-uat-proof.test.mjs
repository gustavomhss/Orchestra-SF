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

// Adversarial regressions: role labels and a decorative actor list must not satisfy SoD.
async function makeProcurementEvidence() {
  const dir = await mkdtemp(join(tmpdir(), 'sf-uat-proc-'));
  const payload = 'SYNTHETIC_OPERATOR_WITNESS\n';
  await writeFile(join(dir,'witness.txt'),payload);
  const c=plan.cases.find(x=>x.caseId==='QA2-002');
  const identities = { requester: hash('requester'), approver: hash('approver'), buyer: hash('buyer') };
  const proofs=c.proofs.map((p,i) => ({
    proofId:p.id,kind:p.kind,actorRole:p.actorRole,principalHash:identities[p.actorRole],
    observedAt:'2026-11-16T19:00:00Z',correlationRef:'QA2-002-'+i,
    httpStatus:p.kind==='deny' ? p.allowedStatus[0] : 200,
    artifactPath:'witness.txt',artifactSha256:hash(payload),
    beforeDigest:hash('before'+i),afterDigest:p.kind==='deny'?hash('before'+i):hash('after'+i),
    ...(p.from?{fromState:p.from,toState:p.to}:{}),
    ...(p.kind==='commit'?{receiptRef:'receipt'+i,receiptDigest:hash('receipt'+i),idempotencyKeyHash:hash('idem'+i)}:{}),
    ...(p.kind==='oracle'?{observed:independentOracle(c.oracle)}:{})
  }));
  const proof={schema:'sf-uat-evidence-v1',case_id:c.caseId,attempt_id:'synthetic-qa2-002',
    timestamp_utc:'2026-11-16T19:00:00Z',operator_alias:'test-operator',
    product_commit_sha:SHA,git_tree_sha:SHA,installed_artifact_sha256:hash('package'),
    fixture_source_sha256:hash('fixture'),installation_alias:'isolated-test-only',tenant_alias:'QA-TENANT-A',
    actor_bindings:Object.entries(identities).map(([role,principalHash])=>({role,principalHash})),proofs};
  return { dir, c, proof, identities };
}

test('requester/approver/buyer must be participating distinct principals, not declared labels',async t=>{
  const {dir,c,proof,identities}=await makeProcurementEvidence();
  t.after(()=>rm(dir,{recursive:true,force:true}));
  assert.equal((await inspectEvidence(c,proof,dir,SHA)).status,'EVIDENCE_SUBMITTED_REQUIRES_EXTERNAL_VERIFICATION');
  const forged=structuredClone(proof);
  for(const p of forged.proofs)p.principalHash=identities.requester;
  forged.actor_bindings=[...forged.actor_bindings,
    {role:'observer-1',principalHash:hash('decorative-one')},
    {role:'observer-2',principalHash:hash('decorative-two')}];
  for(const b of forged.actor_bindings)if(b.role!=='observer-1'&&b.role!=='observer-2')b.principalHash=identities.requester;
  await assert.rejects(inspectEvidence(c,forged,dir,SHA),/participating distinct actors|decorative/);
  const merged=structuredClone(proof);
  for(const p of merged.proofs)if(p.actorRole==='approver')p.principalHash=identities.requester;
  merged.actor_bindings=merged.actor_bindings.map(b=>b.role==='approver'?{...b,principalHash:identities.requester}:b);
  await assert.rejects(inspectEvidence(c,merged,dir,SHA),/participating distinct actors|separation of duties/);
  const decorative=structuredClone(proof);
  decorative.actor_bindings.push({role:'observer',principalHash:hash('unseen-in-logs')});
  await assert.rejects(inspectEvidence(c,decorative,dir,SHA),/unused decorative actor bindings/);
});

test('winner is computed from eligible priced quotes; fabricated claim is refused',()=>{
  const src=plan.cases[1].oracle;
  assert.equal(independentOracle(src).expectedWinner,'B');
  assert.equal(independentOracle({...src,quotes:src.quotes.map(q=>q.id==='C'?{...q,eligible:true}:q)}).expectedWinner,'C');
  assert.throws(()=>independentOracle({...src,expectedWinner:'D-inexistente'}),/legacy oracle/);
  assert.throws(()=>independentOracle({...src,quotes:[...src.quotes.slice(0,2),{...src.quotes[2],id:'D'}]}),/exactly A, B and C/);
});

test('CLI distinguishes report-only, malformed and strict non-executed status via exit codes', async t=>{
  const { spawnSync }=await import('node:child_process');
  const script=fileURLToPath(new URL('./verify-uat-proof.mjs',import.meta.url));
  const run=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
  const normal=run([]);
  assert.equal(normal.status,0);assert.match(normal.stdout,/NOT_RUN/);
  const strict=run(['--strict']);
  assert.equal(strict.status,2);assert.match(strict.stdout,/NOT_RUN/);
  const {dir}=await makeEnv();t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'QA2-001.json'),'{"bad":"evidence"}');
  const invalid=run(['--evidence-dir',dir,'--candidate',SHA]);
  assert.equal(invalid.status,1);assert.match(invalid.stdout,/INVALID_OR_INCOMPLETE/);
  const missing=run(['--evidence-dir',dir,'--candidate',SHA,'--strict']);
  assert.equal(missing.status,1);
  const bad=run(['--unknown-option']);
  assert.equal(bad.status,1);assert.match(bad.stderr,/unknown command argument/);
});
