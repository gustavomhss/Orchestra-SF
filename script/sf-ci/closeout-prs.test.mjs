import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeCloseout, parseArgs, DISPOSITIONS } from './closeout-prs.mjs';

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const MERGED = 'c'.repeat(40);
const REAL_TEMPLATES = resolve(fileURLToPath(new URL(
  '../../docs/qa/sucafina/consolidation/closeout-templates/', import.meta.url,
)));

function record(overrides = {}) {
  return {
    schema_version: 'orchestra-sf-consolidation-ledger-v1',
    record_id: 'PR-71:example/file.ts',
    observed_at: '2026-11-17T21:10:00-03:00',
    base_observed: 'd'.repeat(40),
    source_pr: 71,
    source_head: HEAD,
    source_branch: 'example-source-71',
    source_base: 'close-final-candidate',
    source_state: 'OPEN',
    scope: { path: 'example/file.ts' },
    bundle: 'B2',
    disposition: 'ABSORBED_BLOB',
    status: 'CLOSE_READY',
    owner: 'business-product',
    close_ready: true,
    canonical_pr: null,
    evidence: [{ type: 'BLOB_MATCH', ref: 'base', detail: 'Identical file blob at pinned base' }],
    ...overrides,
  };
}

function fakeGh({ head = HEAD, afterCommentHead = head } = {}) {
  const calls = [];
  let commented = false;
  const gh = async (args) => {
    calls.push(args);
    if (args[0] === 'api' && args.includes('--paginate')) {
      return JSON.stringify([[{ number: 71, head: { sha: head }, state: 'open' }]]);
    }
    if (args[0] === 'api' && args[1].endsWith('/pulls/71')) {
      return JSON.stringify({
        state: 'open', head: { sha: commented ? afterCommentHead : head },
      });
    }
    if (args[0] === 'pr' && args[1] === 'comment') {
      commented = true;
      return '';
    }
    if (args[0] === 'pr' && args[1] === 'close') return '';
    throw new Error('Unexpected fake gh call: ' + JSON.stringify(args));
  };
  return { gh, calls };
}

async function fixture(t, records = [record()], map = null) {
  const root = await mkdtemp(join(tmpdir(), 'sf-closeout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const docs = join(root, 'docs');
  const templatesDir = join(docs, 'templates');
  await mkdir(templatesDir, { recursive: true });
  for (const kind of DISPOSITIONS) {
    await writeFile(join(templatesDir, kind + '.md'),
      '# Source PR {{PR}}\nEvidence: {{EVIDENCE}}\nCanonical route: {{CANONICAL_PR}}\n');
  }
  const ledger = join(docs, 'ledger.jsonl');
  const mapping = join(docs, 'mapping.json');
  const report = join(docs, 'report.json');
  const commentsDir = join(docs, 'comments');
  await writeFile(ledger, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  await writeFile(mapping, JSON.stringify(map ?? {
    schema_version: 'orchestra-sf-closeout-mapping-v1',
    complete: true, source_prs: {},
  }));
  const args = {
    ledger, mapping, report, commentsDir, templatesDir,
    repo: 'gustavomhss/Orchestra-SF', apply: false, confirm: null,
  };
  const output = { text: '', write(value) { this.text += value; } };
  return { args, output, root };
}

const outcome = (report) => report.outcomes.find(e => e.pr === 71);
const mutating = (calls) => calls.some(args => args[0] === 'pr');

test('default dry-run writes a plan, rendered comment, and per-PR JSON; no gh mutations', async t => {
  const { args, output } = await fixture(t);
  const { gh, calls } = fakeGh();
  const report = await executeCloseout(args, { gh, output });
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.planned_close_count, 1);
  assert.equal(outcome(report).status, 'DRY_RUN_READY');
  assert.match(output.text, /pr \| disposition \| evidence \| comment path/);
  assert.match(output.text, /#71 \| ABSORBED_BLOB/);
  assert.match(await readFile(outcome(report).comment_path, 'utf8'), /Source PR 71/);
  assert.match(await readFile(outcome(report).comment_path, 'utf8'), /Identical file blob/);
  assert.equal(JSON.parse(await readFile(args.report, 'utf8')).outcomes[0].pr, 71);
  assert.equal(mutating(calls), false);
});

test('STALE_SNAPSHOT blocks an open PR when the live head changed', async t => {
  const { args, output } = await fixture(t);
  const { gh, calls } = fakeGh({ head: OTHER });
  const report = await executeCloseout(args, { gh, output });
  assert.equal(outcome(report).status, 'STALE_SNAPSHOT');
  assert.equal(report.planned_close_count, 0);
  assert.equal(outcome(report).comment_path, null);
  assert.equal(mutating(calls), false);
});

test('a single close_ready:false record blocks the whole PR even under --apply', async t => {
  const secondary = record({
    record_id: 'PR-71:another.ts',
    scope: { path: 'another.ts' },
    close_ready: false,
  });
  const { args, output } = await fixture(t, [record(), secondary]);
  const { gh, calls } = fakeGh();
  const report = await executeCloseout(
    { ...args, apply: true, confirm: 0 }, { gh, output },
  );
  assert.equal(outcome(report).status, 'NOT_CLOSE_READY');
  assert.equal(report.planned_close_count, 0);
  assert.equal(mutating(calls), false);
});

test('count mismatch reports error before any comment or close', async t => {
  const { args, output } = await fixture(t);
  const { gh, calls } = fakeGh();
  await assert.rejects(
    executeCloseout({ ...args, apply: true, confirm: 2 }, { gh, output }),
    error => error.code === 'CONFIRM_COUNT_MISMATCH',
  );
  const report = JSON.parse(await readFile(args.report, 'utf8'));
  assert.equal(report.outcomes[0].status, 'NOT_APPLIED_COUNT_MISMATCH');
  assert.equal(mutating(calls), false);
});

test('missing required ledger fields fail closed before any gh operation', async t => {
  for (const [mutated, field] of [
    [{ status: undefined }, 'status'],
    [{ scope: undefined }, 'scope'],
    [{ source_branch: undefined }, 'source_branch'],
    [{ evidence: [] }, 'evidence'],
    [{ schema_version: 'unknown' }, 'schema_version'],
  ]) {
    const { args, output } = await fixture(t, [record(mutated)]);
    const { gh, calls } = fakeGh();
    await assert.rejects(
      executeCloseout(args, { gh, output }),
      error => error.code === 'INVALID_LEDGER_RECORD',
      'must reject invalid ' + field,
    );
    assert.equal(calls.length, 0);
  }
});

test('conflicting snapshot base or branch blocks entire PR, even with matching head', async t => {
  for (const changed of [
    { base_observed: OTHER },
    { source_branch: 'unexpected-branch' },
  ]) {
    const { args, output } = await fixture(t, [
      record(),
      record({ record_id: 'PR-71:other.ts', scope: { path: 'other.ts' }, ...changed }),
    ]);
    const { gh, calls } = fakeGh();
    const report = await executeCloseout(args, { gh, output });
    assert.equal(outcome(report).status, 'INCONSISTENT_SNAPSHOT');
    assert.equal(mutating(calls), false);
  }
});

test('unknown disposition is reported as UNKNOWN_DISPOSITION and never actioned', async t => {
  const { args, output } = await fixture(t, [record({ disposition: 'UNSUPPORTED_UNKNOWN' })]);
  const { gh, calls } = fakeGh();
  const report = await executeCloseout(
    { ...args, apply: true, confirm: 0 }, { gh, output },
  );
  assert.equal(outcome(report).status, 'UNKNOWN_DISPOSITION');
  assert.equal(outcome(report).comment_path, null);
  assert.equal(mutating(calls), false);
});

test('known blocking classification, owner decision, and missing proof all block', async t => {
  for (const [overrides, expected] of [
    [{ disposition: 'PROMOTION_ONLY' }, 'BLOCKED_DISPOSITION'],
    [{ owner_decision_required: true }, 'NEEDS_INPUT'],
    [{ evidence: [{ type: 'OTHER', detail: 'Unrelated claim' }] }, 'MISSING_PROOF_TYPE'],
  ]) {
    const { args, output } = await fixture(t, [record(overrides)]);
    const { gh, calls } = fakeGh();
    const report = await executeCloseout(args, { gh, output });
    assert.equal(outcome(report).status, expected);
    assert.equal(mutating(calls), false);
  }
});

test('duplicate head requires a different canonical PR', async t => {
  const { args, output } = await fixture(t, [record({
    disposition: 'DUPLICATE_HEAD',
    evidence: [{ type: 'HEAD_MATCH', detail: 'Head equals PR #72 head' }],
  })]);
  const report = await executeCloseout(args, { gh: fakeGh().gh, output });
  assert.equal(outcome(report).status, 'MAPPING_INCOMPLETE');
});

test('replay requires all bundle heads proven merged in completed mapping', async t => {
  const replay = record({
    disposition: 'REPLAY',
    evidence: [{ type: 'CI_RUN', detail: 'Verified bundle run' }],
  });
  const { args, output } = await fixture(t, [replay], {
    schema_version: 'orchestra-sf-closeout-mapping-v1',
    complete: true,
    source_prs: { '71': { canonical_pr: 400, bundles: {
      B2: { status: 'PENDING', canonical_pr: 400, merge_sha: MERGED },
    } } },
  });
  const report = await executeCloseout(args, { gh: fakeGh().gh, output });
  assert.equal(outcome(report).status, 'MAPPING_INCOMPLETE');
});

test('fake apply enforces head checks and writes the comment before closing', async t => {
  const { args, output } = await fixture(t);
  const { gh, calls } = fakeGh();
  const report = await executeCloseout(
    { ...args, apply: true, confirm: 1 }, { gh, output },
  );
  assert.equal(outcome(report).status, 'CLOSED_BY_TOOL');
  const verbs = calls.map(args => args[0] === 'pr' ? args[1] : 'read');
  assert.deepEqual(verbs, ['read', 'read', 'comment', 'read', 'close']);
});

test('head drift after comment prevents close and leaves a precise outcome', async t => {
  const { args, output } = await fixture(t);
  const { gh, calls } = fakeGh({ afterCommentHead: OTHER });
  const report = await executeCloseout(
    { ...args, apply: true, confirm: 1 }, { gh, output },
  );
  assert.equal(outcome(report).status, 'COMMENTED_STALE_SNAPSHOT');
  assert.ok(calls.some(args => args[0] === 'pr' && args[1] === 'comment'));
  assert.ok(!calls.some(args => args[0] === 'pr' && args[1] === 'close'));
});

test('CLI parsing requires exact explicit confirmation and refuses unknown flags', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.throws(() => parseArgs(['--apply']), { code: 'CONFIRM_REQUIRED' });
  assert.throws(() => parseArgs(['--apply', '--confirm=NaN']), { code: 'INVALID_CONFIRM' });
  assert.throws(() => parseArgs(['--confirm=1']), { code: 'CONFIRM_WITHOUT_APPLY' });
  assert.throws(() => parseArgs(['--unsafe']), { code: 'UNKNOWN_ARGUMENT' });
  assert.deepEqual(
    { apply: parseArgs(['--apply', '--confirm=0']).apply,
      confirm: parseArgs(['--apply', '--confirm=0']).confirm },
    { apply: true, confirm: 0 },
  );
});

test('all seven real templates contain required substitutions', async () => {
  for (const kind of DISPOSITIONS) {
    const template = await readFile(join(REAL_TEMPLATES, kind + '.md'), 'utf8');
    for (const field of ['{{PR}}', '{{EVIDENCE}}', '{{CANONICAL_PR}}']) {
      assert.ok(template.includes(field), kind + ' must contain ' + field);
    }
    if (kind === 'REPLAY' || kind === 'SUPERSEDED') {
      assert.doesNotMatch(template, /(?:was|has been)\s+merged/i);
    }
  }
});
