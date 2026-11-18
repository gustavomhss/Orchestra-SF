#!/usr/bin/env bun
// WP10: topology proof only. Never approves release, changes PR #237, or pushes.
import { Effect } from 'effect';
import { ChildProcess } from 'effect/unstable/process';
import { AppProcess } from '@orchestra/core/process';
import { LayerNode } from '@orchestra/core/effect/layer-node';
import { randomUUID } from 'node:crypto';
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
/** The only process-launch boundary: approved Orchestra AppProcess provider. */
async function command(executable, args, cwd = ROOT, allowFailure = false) {
  let result;
  try {
    result = await Effect.runPromise(Effect.gen(function* () {
      const runner = yield* AppProcess.Service;
      return yield* runner.run(ChildProcess.make(executable, args, {
        cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
      }), { timeout: '120 seconds', maxOutputBytes: 8 * 1024 * 1024,
        maxErrorBytes: 8 * 1024 * 1024 });
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))));
  } catch (error) {
    fail('COMMAND_ERROR', `${executable}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (result.stdoutTruncated || result.stderrTruncated)
    fail('COMMAND_TRUNCATED', `${executable}: bounded command output overflow`);
  const value = { status: result.exitCode, stdout: result.stdout.toString('utf8'),
    stderr: result.stderr.toString('utf8') };
  if (value.status !== 0 && !allowFailure) {
    fail('COMMAND_FAILED', `${executable} ${args.join(' ')}: ${(value.stderr || value.stdout).trim()}`);
  }
  return value;
}
const git = async (...args) => (await command('git', args)).stdout.trim();
async function prSnapshot() {
  const raw = (await command('gh', ['api', `repos/${REPO}/pulls/${PR_NUMBER}`])).stdout;
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
async function mergeTree(goSha, headSha) {
  const attempt = await command('git', ['merge-tree', '--write-tree', goSha, headSha], ROOT, true);
  if (attempt.status === 0) {
    const treeSha = attempt.stdout.trim().split(/\s+/)[0];
    if (!SHA.test(treeSha || '')) fail('MERGE_TREE_INVALID', 'git merge-tree returned no valid tree SHA');
    return { method: 'git merge-tree --write-tree', treeSha };
  }
  // Older Git releases lack --write-tree. Use a private, named temporary branch
  // in a separate worktree: no detached HEAD, protected ref updates or merge commits.
  if (!/unknown option|unrecognized option|usage:\s*git merge-tree/i.test(attempt.stderr || '')) {
    fail('MERGE_TREE_CONFLICT', (attempt.stderr || attempt.stdout).trim());
  }
  const dir = mkdtempSync(join(tmpdir(), 'sf-promotion-proof-'));
  const branch = 'promotion-proof-temp-' + randomUUID();
  let added = false;
  try {
    await git('worktree', 'add', '-b', branch, dir, goSha);
    added = true;
    await command('git', ['merge', '--ff-only', headSha], dir);
    return { method: 'temporary named worktree: git merge --ff-only',
      treeSha: (await command('git', ['rev-parse', 'HEAD^{tree}'], dir)).stdout.trim() };
  } finally {
    if (added) {
      await command('git', ['worktree', 'remove', '--force', dir], ROOT);
      await command('git', ['branch', '--delete', branch], ROOT);
    }
    rmSync(dir, { recursive: true, force: true });
  }
}
async function snapshot() {
  const prBefore = await prSnapshot();
  // Only local remote-tracking / proof refs are updated. Protected remote branches
  // and PR metadata are never written. Re-fetching prevents stale local proofs.
  await git('fetch', '--no-tags', 'origin',
    `+refs/heads/go-live-close:${GO}`,
    `+refs/heads/close-final-candidate:${CANDIDATE}`,
    `+refs/pull/${PR_NUMBER}/merge:${SYNTHETIC}`);
  const goSha = await git('rev-parse', `${GO}^{commit}`);
  const headSha = await git('rev-parse', `${CANDIDATE}^{commit}`);
  if (goSha !== prBefore.base || headSha !== prBefore.head) {
    fail('REMOTE_DRIFT', 'Fetched Git heads differ from the current PR base/head');
  }
  const ancestor = await command('git', ['merge-base', '--is-ancestor', goSha, headSha], ROOT, true);
  if (ancestor.status !== 0) fail('NOT_FAST_FORWARD', 'go-live-close is not an ancestor of close-final-candidate');
  const counts = (await git('rev-list', '--left-right', '--count', `${goSha}...${headSha}`)).split(/\s+/).map(Number);
  if (counts.length !== 2 || counts.some((v) => !Number.isSafeInteger(v)) || counts[0] !== 0) {
    fail('AHEAD_BEHIND', 'Expected go-live-close ahead=0 and nonnegative behind count');
  }
  const goTree = await git('rev-parse', `${goSha}^{tree}`);
  const candidateTree = await git('rev-parse', `${headSha}^{tree}`);
  const merge = await mergeTree(goSha, headSha);
  if (merge.treeSha !== candidateTree) {
    fail('MERGE_TREE_MISMATCH', `local merge tree ${merge.treeSha} differs from candidate ${candidateTree}`);
  }
  const syntheticSha = await git('rev-parse', `${SYNTHETIC}^{commit}`);
  const syntheticTree = await git('rev-parse', `${syntheticSha}^{tree}`);
  const syntheticParents = (await git('rev-list', '--parents', '-n', '1', syntheticSha)).split(/\s+/).slice(1);
  if (syntheticParents.length !== 2 || syntheticParents[0] !== goSha || syntheticParents[1] !== headSha) {
    fail('SYNTHETIC_REF_STALE', 'GitHub refs/pull/237/merge parents do not match the pinned PR base/head');
  }
  if (syntheticTree !== candidateTree) {
    fail('SYNTHETIC_TREE_MISMATCH', 'GitHub synthetic merge tree differs from candidate head tree');
  }
  const prAfter = await prSnapshot();
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
/** GitHub-only topology proof; useful for MCP/CI where no local Git is available.
 * This MUST NEVER claim that git merge-tree was run locally. */
async function api(path) {
  const raw = (await command('gh', ['api', `repos/${REPO}/${path}`])).stdout;
  try { return JSON.parse(raw); }
  catch { fail('GITHUB_API_INVALID', 'Non-JSON response for ' + path); }
}
async function remoteSnapshot() {
  const prBefore = await api(`pulls/${PR_NUMBER}`);
  const validPr = (pr) => pr.number === PR_NUMBER && pr.state === 'open' &&
    pr.draft === true && pr.base?.ref === 'go-live-close' &&
    pr.head?.ref === 'close-final-candidate' &&
    pr.base?.repo?.full_name === REPO && pr.head?.repo?.full_name === REPO &&
    SHA.test(pr.base?.sha || '') && SHA.test(pr.head?.sha || '');
  if (!validPr(prBefore)) fail('PR_NOT_DRAFT_OR_WRONG_REFS', 'PR #237 must be open, draft, and have the prescribed base/head in this repository');
  const base = prBefore.base.sha, head = prBefore.head.sha;
  const compared = await api(`compare/${base}...${head}`);
  if (compared.status !== 'ahead' || compared.ahead_by < 1 ||
      !Number.isSafeInteger(compared.ahead_by) || compared.behind_by !== 0 ||
      compared.merge_base_commit?.sha !== base || compared.base_commit?.sha !== base) {
    fail('NOT_FAST_FORWARD', 'GitHub compare did not prove an ancestor base with 0 behind and a positive ahead count');
  }
  const [baseCommit, headCommit, mergeRef] = await Promise.all([
    api(`git/commits/${base}`),
    api(`git/commits/${head}`),
    api(`git/ref/pull/${PR_NUMBER}/merge`)
  ]);
  if (mergeRef.ref !== `refs/pull/${PR_NUMBER}/merge` ||
      mergeRef.object?.type !== 'commit' || !SHA.test(mergeRef.object?.sha || '')) {
    fail('MISSING_MERGE_REF', 'GitHub synthetic merge ref is missing or malformed');
  }
  const mergeSha = mergeRef.object.sha;
  const mergeCommit = await api(`git/commits/${mergeSha}`);
  const expectedParents = [base, head];
  const parents = mergeCommit.parents?.map((p) => p.sha);
  if (JSON.stringify(parents) !== JSON.stringify(expectedParents) ||
      mergeCommit.sha !== mergeSha || (prBefore.merge_commit_sha && prBefore.merge_commit_sha !== mergeSha)) {
    fail('SYNTHETIC_REF_STALE', 'Synthetic merge parentage/PR merge SHA is stale or unexpected');
  }
  const baseTree = baseCommit.tree?.sha;
  const candidateTree = headCommit.tree?.sha;
  const mergedTree = mergeCommit.tree?.sha;
  if (![baseTree, candidateTree, mergedTree].every((value) => SHA.test(value || ''))) {
    fail('TREE_SHA_INVALID', 'GitHub did not return valid Git tree object IDs');
  }
  if (mergedTree !== candidateTree) {
    fail('SYNTHETIC_TREE_MISMATCH', 'GitHub merge ref tree differs from candidate head tree');
  }
  const prAfter = await api(`pulls/${PR_NUMBER}`);
  if (!validPr(prAfter) || prAfter.base.sha !== base ||
      prAfter.head.sha !== head || prAfter.merge_commit_sha !== mergeSha) {
    fail('PR_MOVED_DURING_PROOF', 'PR #237 metadata changed during the remote proof');
  }
  return {
    schemaVersion: 1,
    repository: REPO,
    pullRequest: { number: PR_NUMBER, state: 'open', isDraft: true,
      baseRefName: 'go-live-close', headRefName: 'close-final-candidate' },
    refs: {
      goLiveClose: { sha: base, treeSha: baseTree },
      closeFinalCandidate: { sha: head, treeSha: candidateTree },
      githubMergeRef: { ref: `refs/pull/${PR_NUMBER}/merge`, sha: mergeSha,
        treeSha: mergedTree, parents },
    },
    aheadBehind: { goLiveAhead: compared.behind_by, goLiveBehind: compared.ahead_by },
    localMerge: { method: 'NOT_RUN', treeSha: null },
    checks: { goLiveIsAncestor: true, localTreeMatchesCandidate: false,
      githubMergeTreeMatchesCandidate: true, githubMergeParentsMatch: true },
    proofStatus: 'REMOTE_TOPOLOGY_VERIFIED',
    releaseGates: 'NOT_EVALUATED',
    observedAtUtc: new Date().toISOString(),
    source: 'GITHUB_API_ONLY',
  };
}

function checkPinned(stored, live) {
  if (stored?.proofStatus !== live.proofStatus) {
    fail('PROOF_MODE_MISMATCH', 'Stored proof mode differs from this run: use --github for remote proof or no flag for local merge-tree');
  }
  if (live.proofStatus === 'TOPOLOGY_VERIFIED_ONLY' &&
      (!['git merge-tree --write-tree', 'temporary named worktree: git merge --ff-only'].includes(stored?.localMerge?.method) ||
        stored?.localMerge?.treeSha !== live.localMerge.treeSha)) {
    fail('LOCAL_PROOF_MISSING', 'Stored proof has not been reproduced by local Git; rerun without --check');
  }
  if (live.proofStatus === 'REMOTE_TOPOLOGY_VERIFIED' &&
      (stored?.localMerge?.method !== 'NOT_RUN' || stored?.localMerge?.treeSha !== null ||
       stored?.checks?.localTreeMatchesCandidate !== false || stored.source !== 'GITHUB_API_ONLY')) {
    fail('REMOTE_PROOF_INVALID', 'GitHub-only evidence must never claim a local merge-tree execution');
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
async function main() {
  const flags = process.argv.slice(2);
  if (flags.some((arg) => !['--check', '--github'].includes(arg)) ||
      new Set(flags).size !== flags.length) {
    fail('USAGE', 'Usage: bun script/sf-ci/promotion-proof.mjs [--github] [--check]');
  }
  const check = flags.includes('--check');
  const github = flags.includes('--github');
  const live = github ? await remoteSnapshot() : await snapshot();
  if (check) {
    let saved;
    try { saved = JSON.parse(readFileSync(OUTPUT, 'utf8')); }
    catch { fail('PROOF_MISSING', `Missing or invalid ${OUTPUT}`); }
    checkPinned(saved, live);
    process.stdout.write(`PROMOTION_CHECK_OK mode=${live.proofStatus} pr=#237 head=${live.refs.closeFinalCandidate.sha} tree=${live.refs.githubMergeRef.treeSha}\n`);
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    const temp = `${OUTPUT}.${process.pid}.tmp`;
    try {
      writeFileSync(temp, `${JSON.stringify(live, null, 2)}\n`, { flag: 'wx' });
      renameSync(temp, OUTPUT);
    } finally { rmSync(temp, { force: true }); }
    process.stdout.write(`PROMOTION_TOPOLOGY_ONLY mode=${live.proofStatus} ${OUTPUT} go-live behind=${live.aheadBehind.goLiveBehind}\n`);
  }
}
await main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
