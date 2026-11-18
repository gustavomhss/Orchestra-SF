#!/usr/bin/env node
// WP10: topology proof only. Never approves release, changes PR #237, or pushes.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'gustavomhss/Orchestra-SF';
const PR_NUMBER = 237;
const GO = 'refs/remotes/origin/go-live-close';
const CANDIDATE = 'refs/remotes/origin/close-final-candidate';
const SYNTHETIC = 'refs/promotion-proof/pr-237-merge';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = join(ROOT, 'docs/qa/sucafina/consolidation/promotion-proof.json');
const SHA = /^[0-9a-f]{40}$/;

function fail(code, detail) {
  throw new Error(`PROMOTION_${code}: ${detail}`);
}
function command(executable, args, cwd = ROOT, allowFailure = false) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) fail('COMMAND_ERROR', `${executable}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    fail('COMMAND_FAILED', `${executable} ${args.join(' ')}: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}
const git = (...args) => command('git', args).stdout.trim();
function prSnapshot() {
  const raw = command('gh', ['api', `repos/${REPO}/pulls/${PR_NUMBER}`]).stdout;
  let pr;
  try { pr = JSON.parse(raw); } catch { fail('PR_METADATA', 'GitHub returned non-JSON PR metadata'); }
  if (pr.number !== PR_NUMBER || pr.state !== 'open' || pr.draft !== true ||
      pr.base?.ref !== 'go-live-close' || pr.head?.ref !== 'close-final-candidate' ||
      pr.base?.repo?.full_name !== REPO || pr.head?.repo?.full_name !== REPO ||
      !SHA.test(pr.base.sha || '') || !SHA.test(pr.head.sha || '')) {
    fail('PR_NOT_DRAFT_OR_WRONG_REFS', 'PR #237 must be open, draft, and close-final-candidate -> go-live-close');
  }
  return { base: pr.base.sha, head: pr.head.sha };
}
function mergeTree(goSha, headSha) {
  const attempt = command('git', ['merge-tree', '--write-tree', goSha, headSha], ROOT, true);
  if (attempt.status === 0) {
    const treeSha = attempt.stdout.trim().split(/\s+/)[0];
    if (!SHA.test(treeSha || '')) fail('MERGE_TREE_INVALID', 'git merge-tree returned no valid tree SHA');
    return { method: 'git merge-tree --write-tree', treeSha };
  }
  // Older Git releases lack --write-tree. A temporary detached worktree performs
  // a strictly fast-forward merge, without creating a merge commit or touching a branch.
  if (!/unknown option|unrecognized option|usage:\s*git merge-tree/i.test(attempt.stderr || '')) {
    fail('MERGE_TREE_CONFLICT', (attempt.stderr || attempt.stdout).trim());
  }
  const dir = mkdtempSync(join(tmpdir(), 'sf-promotion-proof-'));
  let added = false;
  try {
    git('worktree', 'add', '--detach', dir, goSha);
    added = true;
    command('git', ['merge', '--ff-only', headSha], dir);
    return { method: 'temporary detached worktree: git merge --ff-only',
      treeSha: command('git', ['rev-parse', 'HEAD^{tree}'], dir).stdout.trim() };
  } finally {
    if (added) command('git', ['worktree', 'remove', '--force', dir], ROOT);
    rmSync(dir, { recursive: true, force: true });
  }
}
function snapshot() {
  const prBefore = prSnapshot();
  // Only local remote-tracking / proof refs are updated. Protected remote branches
  // and PR metadata are never written. Re-fetching prevents stale local proofs.
  git('fetch', '--no-tags', 'origin',
    `+refs/heads/go-live-close:${GO}`,
    `+refs/heads/close-final-candidate:${CANDIDATE}`,
    `+refs/pull/${PR_NUMBER}/merge:${SYNTHETIC}`);
  const goSha = git('rev-parse', `${GO}^{commit}`);
  const headSha = git('rev-parse', `${CANDIDATE}^{commit}`);
  if (goSha !== prBefore.base || headSha !== prBefore.head) {
    fail('REMOTE_DRIFT', 'Fetched Git heads differ from the current PR base/head');
  }
  const ancestor = command('git', ['merge-base', '--is-ancestor', goSha, headSha], ROOT, true);
  if (ancestor.status !== 0) fail('NOT_FAST_FORWARD', 'go-live-close is not an ancestor of close-final-candidate');
  const counts = git('rev-list', '--left-right', '--count', `${goSha}...${headSha}`).split(/\s+/).map(Number);
  if (counts.length !== 2 || counts.some((v) => !Number.isSafeInteger(v)) || counts[0] !== 0) {
    fail('AHEAD_BEHIND', 'Expected go-live-close ahead=0 and nonnegative behind count');
  }
  const goTree = git('rev-parse', `${goSha}^{tree}`);
  const candidateTree = git('rev-parse', `${headSha}^{tree}`);
  const merge = mergeTree(goSha, headSha);
  if (merge.treeSha !== candidateTree) {
    fail('MERGE_TREE_MISMATCH', `local merge tree ${merge.treeSha} differs from candidate ${candidateTree}`);
  }
  const syntheticSha = git('rev-parse', `${SYNTHETIC}^{commit}`);
  const syntheticTree = git('rev-parse', `${syntheticSha}^{tree}`);
  const syntheticParents = git('rev-list', '--parents', '-n', '1', syntheticSha).split(/\s+/).slice(1);
  if (syntheticParents.length !== 2 || syntheticParents[0] !== goSha || syntheticParents[1] !== headSha) {
    fail('SYNTHETIC_REF_STALE', 'GitHub refs/pull/237/merge parents do not match the pinned PR base/head');
  }
  if (syntheticTree !== candidateTree) {
    fail('SYNTHETIC_TREE_MISMATCH', 'GitHub synthetic merge tree differs from candidate head tree');
  }
  const prAfter = prSnapshot();
  if (prAfter.base !== goSha || prAfter.head !== headSha) {
    fail('PR_MOVED_DURING_PROOF', 'PR #237 base/head changed while calculating proof');
  }
  return {
    schemaVersion: 1,
    repository: REPO,
    pullRequest: { number: PR_NUMBER, state: 'open', isDraft: true,
      baseRefName: 'go-live-close', headRefName: 'close-final-candidate' },
    refs: {
      goLiveClose: { sha: goSha, treeSha: goTree },
      closeFinalCandidate: { sha: headSha, treeSha: candidateTree },
      githubMergeRef: { ref: `refs/pull/${PR_NUMBER}/merge`, sha: syntheticSha,
        treeSha: syntheticTree, parents: syntheticParents },
    },
    aheadBehind: { goLiveAhead: counts[0], goLiveBehind: counts[1] },
    localMerge: { method: merge.method, treeSha: merge.treeSha },
    checks: { goLiveIsAncestor: true, localTreeMatchesCandidate: true,
      githubMergeTreeMatchesCandidate: true, githubMergeParentsMatch: true },
    proofStatus: 'TOPOLOGY_VERIFIED_ONLY',
    releaseGates: 'NOT_EVALUATED',
    observedAtUtc: new Date().toISOString(),
  };
}
function checkPinned(stored, live) {
  if (stored?.proofStatus !== 'TOPOLOGY_VERIFIED_ONLY' ||
      !['git merge-tree --write-tree', 'temporary detached worktree: git merge --ff-only'].includes(stored?.localMerge?.method) ||
      stored?.localMerge?.treeSha !== live.localMerge.treeSha) {
    fail('LOCAL_PROOF_MISSING', 'Stored proof has not been reproduced by local Git; rerun without --check');
  }
  for (const [label, expected, actual] of [
    ['base SHA', stored.refs?.goLiveClose?.sha, live.refs.goLiveClose.sha],
    ['base tree', stored.refs?.goLiveClose?.treeSha, live.refs.goLiveClose.treeSha],
    ['head SHA', stored.refs?.closeFinalCandidate?.sha, live.refs.closeFinalCandidate.sha],
    ['head tree', stored.refs?.closeFinalCandidate?.treeSha, live.refs.closeFinalCandidate.treeSha],
    ['merge ref SHA', stored.refs?.githubMergeRef?.sha, live.refs.githubMergeRef.sha],
    ['merge tree', stored.refs?.githubMergeRef?.treeSha, live.refs.githubMergeRef.treeSha],
    ['ahead count', stored.aheadBehind?.goLiveAhead, live.aheadBehind.goLiveAhead],
    ['behind count', stored.aheadBehind?.goLiveBehind, live.aheadBehind.goLiveBehind],
  ]) {
    if (expected !== actual) fail('PROOF_STALE', `${label} changed: stored=${expected}, live=${actual}`);
  }
  if (JSON.stringify(stored.refs?.githubMergeRef?.parents) !== JSON.stringify(live.refs.githubMergeRef.parents) ||
      JSON.stringify(stored.checks) !== JSON.stringify(live.checks) ||
      stored.releaseGates !== 'NOT_EVALUATED' || stored.pullRequest?.isDraft !== true) {
    fail('PROOF_STALE', 'Stored parentage, proof assertions, draft state or gate scope has changed');
  }
}
try {
  if (process.argv.slice(2).some((arg) => arg !== '--check') ||
      process.argv.slice(2).filter((arg) => arg === '--check').length > 1) {
    fail('USAGE', 'Usage: node script/sf-ci/promotion-proof.mjs [--check]');
  }
  const check = process.argv.includes('--check');
  const live = snapshot();
  if (check) {
    let saved;
    try { saved = JSON.parse(readFileSync(OUTPUT, 'utf8')); }
    catch { fail('PROOF_MISSING', `Missing or invalid ${OUTPUT}`); }
    checkPinned(saved, live);
    process.stdout.write(`PROMOTION_CHECK_OK pr=#237 head=${live.refs.closeFinalCandidate.sha} tree=${live.localMerge.treeSha}\n`);
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    const temp = `${OUTPUT}.${process.pid}.tmp`;
    try {
      writeFileSync(temp, `${JSON.stringify(live, null, 2)}\n`, { flag: 'wx' });
      renameSync(temp, OUTPUT);
    } finally { rmSync(temp, { force: true }); }
    process.stdout.write(`PROMOTION_TOPOLOGY_ONLY ${OUTPUT} go-live behind=${live.aheadBehind.goLiveBehind}\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
