#!/usr/bin/env node
// Historical PR closeout. Read-only by default; mutations require --apply and an exact count.
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = join(ROOT, 'docs/qa/sucafina/consolidation');
export const DISPOSITIONS = Object.freeze([
  'ABSORBED_BLOB', 'ABSORBED_PATCH', 'ABSORBED_ANCESTOR',
  'DUPLICATE_HEAD', 'SUPERSEDED', 'DOCS_ONLY', 'REPLAY',
]);
const SUPPORTED = new Set(DISPOSITIONS);
const BLOCKED = new Set([
  'UNREVIEWED', 'BLOCKED_OWNER_DECISION', 'BLOCKED_MISSING_BRANCH',
  'BLOCKED_SEMANTIC_CONFLICT', 'PROMOTION_ONLY', 'DROP_WITH_EVIDENCE',
]);
const PRIORITY = [
  'REPLAY', 'SUPERSEDED', 'DUPLICATE_HEAD', 'DOCS_ONLY',
  'ABSORBED_PATCH', 'ABSORBED_BLOB', 'ABSORBED_ANCESTOR',
];
const SHA = /^[0-9a-f]{40}$/i;
const EXPLICIT_PROOF = {
  ABSORBED_BLOB: ['BLOB_MATCH', 'DELETION_MATCH'],
  ABSORBED_PATCH: ['PATCH_ID', 'EMPTY_DIFF', 'HUNK_MATCH'],
  ABSORBED_ANCESTOR: ['ANCESTRY'],
  DUPLICATE_HEAD: ['HEAD_MATCH'],
  SUPERSEDED: ['SEMANTIC_REVIEW', 'BLOB_MATCH', 'PATCH_ID', 'HUNK_MATCH'],
};

export class CloseoutError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CloseoutError';
    this.code = code;
  }
}

const failure = (code, message) => { throw new CloseoutError(code, message); };
const integer = (n) => Number.isSafeInteger(n) && n > 0;
const safeRepo = (repo) => typeof repo === 'string'
  && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo);
const truncate = (value, size = 100) => {
  const s = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return s.length > size ? s.slice(0, size - 3) + '...' : s;
};
const positivePr = (n) => integer(n) ? n : null;

export async function defaultGh(args) {
  try {
    const { stdout } = await execFileAsync('gh', args, {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    failure('GH_FAILED', truncate(error.stderr || error.message, 400));
  }
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch {
    failure('INVALID_JSON', 'Cannot parse ' + label);
  }
}

function readLedger(raw) {
  const records = [];
  const seenIds = new Set();
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const rec = parseJson(line, 'ledger line ' + (index + 1));
    if (!rec || !integer(rec.source_pr) || !SHA.test(rec.source_head || '')
      || typeof rec.disposition !== 'string'
      || typeof rec.close_ready !== 'boolean'
      || !Array.isArray(rec.evidence)) {
      failure('INVALID_LEDGER_RECORD', 'Invalid ledger record at line ' + (index + 1));
    }
    if (rec.record_id !== undefined) {
      if (seenIds.has(rec.record_id)) failure('DUPLICATE_RECORD_ID', rec.record_id);
      seenIds.add(rec.record_id);
    }
    records.push(rec);
  }
  if (!records.length) failure('EMPTY_LEDGER', 'No ledger records found');
  return records;
}

function parseMapping(raw) {
  const mapping = parseJson(raw, 'completed bundle mapping');
  if (!mapping || mapping.schema_version !== 'orchestra-sf-closeout-mapping-v1'
    || mapping.complete !== true || !mapping.source_prs
    || typeof mapping.source_prs !== 'object' || Array.isArray(mapping.source_prs)) {
    failure('INCOMPLETE_MAPPING',
      'Mapping needs schema_version=orchestra-sf-closeout-mapping-v1, complete=true, and source_prs={}');
  }
  return mapping;
}

function openHeads(raw) {
  const json = parseJson(raw, 'open PR listing');
  if (!Array.isArray(json)) failure('INVALID_GH_RESPONSE', 'Expected array from gh api');
  const pages = json.length && Array.isArray(json[0]) ? json.flat() : json;
  const heads = new Map();
  for (const pr of pages) {
    if (!integer(pr?.number) || !SHA.test(pr?.head?.sha || '')) {
      failure('INVALID_GH_RESPONSE', 'Missing number/head.sha in open PR listing');
    }
    if (heads.has(pr.number)) failure('DUPLICATE_OPEN_PR', 'PR #' + pr.number);
    heads.set(pr.number, pr.head.sha);
  }
  return heads;
}

function describeEvidence(records) {
  const counts = new Map();
  const proofs = new Set();
  for (const rec of records) {
    counts.set(rec.disposition, (counts.get(rec.disposition) || 0) + 1);
    for (const entry of rec.evidence) {
      if (typeof entry?.detail !== 'string' || !entry.detail.trim()) continue;
      const path = rec.scope?.path || '__all__';
      proofs.add('[' + entry.type + (entry.ref ? ' ' + truncate(entry.ref, 48) : '') + '] '
        + truncate(path, 96) + ': ' + truncate(entry.detail, 160));
    }
  }
  const distribution = [...counts].sort().map(([kind, count]) => kind + '=' + count).join(', ');
  const sample = [...proofs].slice(0, 8);
  const remainder = proofs.size - sample.length;
  return 'Ledger: ' + records.length + ' records (' + distribution + '). '
    + sample.join(' | ')
    + (remainder > 0 ? ' | ' + remainder + ' additional evidence entries in ledger.' : '');
}

function validateProof(records) {
  for (const rec of records) {
    const entries = rec.evidence.filter(e => e && typeof e.detail === 'string' && e.detail.trim());
    if (!entries.length) return 'MISSING_EVIDENCE';
    const required = EXPLICIT_PROOF[rec.disposition];
    if (required && !entries.some(e => required.includes(e.type))) return 'MISSING_PROOF_TYPE';
  }
  return null;
}

function validateRoute(pr, records, mapping) {
  const kinds = new Set(records.map(r => r.disposition));
  const route = mapping.source_prs[String(pr)] ?? null;
  const ledgerCanonicals = [...new Set(records.map(r => r.canonical_pr).filter(integer))];
  if (ledgerCanonicals.length > 1) return { status: 'CONFLICTING_CANONICAL_PR' };
  const canonical = positivePr(route?.canonical_pr) || ledgerCanonicals[0] || null;
  if (route?.canonical_pr != null && (!integer(route.canonical_pr)
    || (ledgerCanonicals.length && canonical !== ledgerCanonicals[0]))) {
    return { status: 'CONFLICTING_CANONICAL_PR' };
  }
  if (canonical === pr) return { status: 'CANONICAL_SELF_REFERENCE' };
  if (kinds.has('DUPLICATE_HEAD') && !canonical) return { status: 'MAPPING_INCOMPLETE' };
  if (kinds.has('SUPERSEDED') && (!canonical || !route
    || typeof route.evidence !== 'string' || !route.evidence.trim())) {
    return { status: 'MAPPING_INCOMPLETE' };
  }
  if (kinds.has('REPLAY')) {
    if (!route || !canonical || !route.bundles || typeof route.bundles !== 'object') {
      return { status: 'MAPPING_INCOMPLETE' };
    }
    for (const bundle of new Set(records.filter(r => r.disposition === 'REPLAY').map(r => r.bundle))) {
      const item = route.bundles[bundle];
      if (!item || item.status !== 'MERGED' || !SHA.test(item.merge_sha || '')
        || !integer(item.canonical_pr) || item.canonical_pr === pr) {
        return { status: 'MAPPING_INCOMPLETE' };
      }
    }
  }
  const routeProof = route?.evidence ? ' | Mapping: ' + truncate(route.evidence, 240) : '';
  const bundles = route?.bundles && typeof route.bundles === 'object'
    ? Object.entries(route.bundles).filter(([key]) =>
      records.some(r => r.disposition === 'REPLAY' && r.bundle === key))
      .map(([bundle, value]) => bundle + ' canonical PR #' + value.canonical_pr
        + ' at ' + value.merge_sha).join(' | ')
    : '';
  return { status: 'READY', canonical, extra: routeProof + (bundles ? ' | ' + bundles : '') };
}

function classify(pr, records, heads, mapping, commentsDir) {
  const kinds = [...new Set(records.map(r => r.disposition))];
  const known = kinds.find(k => !SUPPORTED.has(k) && !BLOCKED.has(k));
  const disposition = kinds.length === 1 ? kinds[0]
    : PRIORITY.find(k => kinds.includes(k)) || kinds[0];
  const current = heads.get(pr) || null;
  const observed = [...new Set(records.map(r => r.source_head))];
  const evidence = describeEvidence(records);
  const item = {
    pr, disposition, evidence, source_head: observed[0], live_head: current,
    status: 'READY', comment_path: null, canonical_pr: null,
    close_ready: records.every(r => r.close_ready === true),
  };
  const reject = (status) => { item.status = status; return item; };
  if (known) return reject('UNKNOWN_DISPOSITION');
  if (kinds.some(k => BLOCKED.has(k))) return reject('BLOCKED_DISPOSITION');
  if (observed.length !== 1) return reject('INCONSISTENT_SNAPSHOT');
  if (records.some(r => r.source_state && r.source_state !== 'OPEN')) return reject('SOURCE_STATE_MISMATCH');
  if (!current) return reject('NOT_OPEN');
  if (current.toLowerCase() !== observed[0].toLowerCase()) return reject('STALE_SNAPSHOT');
  if (!item.close_ready) return reject('NOT_CLOSE_READY');
  if (records.some(r => r.owner_decision_required === true)) return reject('NEEDS_INPUT');
  if (records.some(r => r.status && r.status !== 'CLOSE_READY')) return reject('STATUS_NOT_CLOSE_READY');
  const proof = validateProof(records);
  if (proof) return reject(proof);
  const route = validateRoute(pr, records, mapping);
  if (route.status !== 'READY') return reject(route.status);
  item.canonical_pr = route.canonical;
  item.evidence += route.extra;
  item.comment_path = join(commentsDir, 'PR-' + pr + '.md');
  return item;
}

export function parseArgs(argv) {
  const defaults = {
    ledger: join(DOCS, 'ledger.jsonl'),
    mapping: join(DOCS, 'bundle-mapping.json'),
    report: join(DOCS, 'closeout-report.json'),
    commentsDir: join(DOCS, 'closeout-comments'),
    templatesDir: join(DOCS, 'closeout-templates'),
    repo: 'gustavomhss/Orchestra-SF', apply: false, confirm: null,
  };
  const values = { ...defaults };
  const flags = new Map([
    ['--ledger', 'ledger'], ['--mapping', 'mapping'], ['--report', 'report'],
    ['--comments-dir', 'commentsDir'], ['--templates-dir', 'templatesDir'],
    ['--repo', 'repo'], ['--confirm', 'confirm'],
  ]);
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    if (flag === '--apply' && inline === undefined) { values.apply = true; continue; }
    if (flag === '--help' && inline === undefined) { values.help = true; continue; }
    const key = flags.get(flag);
    if (!key) failure('UNKNOWN_ARGUMENT', 'Unrecognized option: ' + flag);
    const value = inline === undefined ? argv[++i] : inline;
    if (value === undefined || value === '') failure('MISSING_ARGUMENT', flag);
    values[key] = value;
  }
  if (!safeRepo(values.repo)) failure('INVALID_REPO', 'Expected owner/repo');
  if (values.confirm !== null) {
    if (!/^(0|[1-9]\d*)$/.test(String(values.confirm))
      || !Number.isSafeInteger(Number(values.confirm))) {
      failure('INVALID_CONFIRM', '--confirm requires a nonnegative integer');
    }
    values.confirm = Number(values.confirm);
  }
  if (values.apply && values.confirm === null) {
    failure('CONFIRM_REQUIRED', '--apply requires --confirm=<count>');
  }
  if (!values.apply && values.confirm !== null) {
    failure('CONFIRM_WITHOUT_APPLY', '--confirm only applies with --apply');
  }
  return values;
}

async function saveJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + '.tmp-' + process.pid;
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'w' });
  await rename(temporary, path);
}

async function renderComment(entry, templatesDir) {
  const template = await readFile(join(templatesDir, entry.disposition + '.md'), 'utf8');
  for (const field of ['{{PR}}', '{{EVIDENCE}}', '{{CANONICAL_PR}}']) {
    if (!template.includes(field)) failure('INVALID_TEMPLATE', entry.disposition + ' missing ' + field);
  }
  const rendered = template.replaceAll('{{PR}}', String(entry.pr))
    .replaceAll('{{EVIDENCE}}', entry.evidence)
    .replaceAll('{{CANONICAL_PR}}', entry.canonical_pr ? '#' + entry.canonical_pr : 'N/A');
  if (/{{[A-Z_]+}}/.test(rendered)) failure('INVALID_TEMPLATE', 'Unresolved placeholder');
  await mkdir(dirname(entry.comment_path), { recursive: true });
  await writeFile(entry.comment_path, rendered, { flag: 'w' });
}

function printTable(entries, output) {
  output.write('pr | disposition | evidence | comment path\n');
  for (const entry of entries) {
    output.write('#' + entry.pr + ' | ' + entry.disposition + ' | '
      + '[' + entry.status + '] ' + truncate(entry.evidence, 140)
      + ' | ' + (entry.comment_path || '-') + '\n');
  }
}

async function recheckHead(gh, repo, entry) {
  const raw = await gh(['api', 'repos/' + repo + '/pulls/' + entry.pr]);
  const current = parseJson(raw, 'live PR #' + entry.pr);
  if (current.state !== 'open') return 'NOT_OPEN';
  if (!SHA.test(current.head?.sha || '') ||
      current.head.sha.toLowerCase() !== entry.source_head.toLowerCase()) {
    return 'STALE_SNAPSHOT';
  }
  return null;
}

export async function executeCloseout(options, dependencies = {}) {
  const gh = dependencies.gh || defaultGh;
  const output = dependencies.output || process.stdout;
  const repo = options.repo || 'gustavomhss/Orchestra-SF';
  if (!safeRepo(repo)) failure('INVALID_REPO', 'Expected owner/repo');
  const ledger = resolve(options.ledger || join(DOCS, 'ledger.jsonl'));
  const mappingPath = resolve(options.mapping || join(DOCS, 'bundle-mapping.json'));
  const reportPath = resolve(options.report || join(DOCS, 'closeout-report.json'));
  const commentsDir = resolve(options.commentsDir || join(DOCS, 'closeout-comments'));
  const templatesDir = resolve(options.templatesDir || join(DOCS, 'closeout-templates'));
  const [rawLedger, rawMapping] = await Promise.all([
    readFile(ledger, 'utf8'), readFile(mappingPath, 'utf8'),
  ]);
  const records = readLedger(rawLedger);
  const mapping = parseMapping(rawMapping);
  const live = openHeads(await gh([
    'api', '--paginate', '--slurp', 'repos/' + repo + '/pulls?state=open&per_page=100',
  ]));
  const byPr = new Map();
  for (const record of records) {
    if (!byPr.has(record.source_pr)) byPr.set(record.source_pr, []);
    byPr.get(record.source_pr).push(record);
  }
  const entries = [...byPr].sort((a, b) => a[0] - b[0])
    .map(([pr, group]) => classify(pr, group, live, mapping, commentsDir));
  const plannedCount = entries.filter(e => e.status === 'READY').length;
  const report = {
    schema_version: 'orchestra-sf-closeout-report-v1',
    generated_at: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    repo, ledger, mapping: mappingPath, planned_close_count: plannedCount,
    outcomes: entries,
  };
  printTable(entries, output);
  // A mismatch cannot perform even a single side effect.
  if (options.apply && options.confirm !== plannedCount) {
    for (const e of entries) if (e.status === 'READY') e.status = 'NOT_APPLIED_COUNT_MISMATCH';
    await saveJson(reportPath, report);
    failure('CONFIRM_COUNT_MISMATCH',
      '--confirm=' + options.confirm + ' but planned close count is ' + plannedCount);
  }
  // Pre-render every comment before any API mutation. A missing template cannot
  // leave the queue half closed.
  for (const e of entries) {
    if (e.status !== 'READY') continue;
    try {
      await renderComment(e, templatesDir);
    } catch (error) {
      e.status = 'TEMPLATE_FAILED';
      e.error = error.code || truncate(error.message, 200);
      await saveJson(reportPath, report);
      throw error;
    }
    if (!options.apply) e.status = 'DRY_RUN_READY';
  }
  await saveJson(reportPath, report);
  if (!options.apply) return report;
  for (const e of entries) {
    if (e.status !== 'READY') continue;
    try {
      let drift = await recheckHead(gh, repo, e);
      if (drift) { e.status = drift; continue; }
      await gh(['pr', 'comment', String(e.pr), '--repo', repo, '--body-file', e.comment_path]);
      drift = await recheckHead(gh, repo, e);
      if (drift) { e.status = 'COMMENTED_' + drift; continue; }
      await gh(['pr', 'close', String(e.pr), '--repo', repo]);
      e.status = 'CLOSED_BY_TOOL';
    } catch (error) {
      e.status = 'APPLY_FAILED';
      e.error = error.code || truncate(error.message, 200);
    }
    await saveJson(reportPath, report);
  }
  await saveJson(reportPath, report);
  return report;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(
        'Usage: node script/sf-ci/closeout-prs.mjs [--ledger FILE] [--mapping FILE]\n'
        + '  [--repo owner/repo] [--report FILE] [--comments-dir DIR]\n'
        + '  [--templates-dir DIR] [--apply --confirm=N]\n'
        + 'Dry-run is default. No PR is closed without --apply and exact --confirm.\n'
        + 'Mapping: {"schema_version":"orchestra-sf-closeout-mapping-v1",'
        + '"complete":true,"source_prs":{"123":{"canonical_pr":456,"evidence":"review",'
        + '"bundles":{"B2":{"status":"MERGED","canonical_pr":456,"merge_sha":"<40-hex>"}}}}}\n'
      );
    } else {
      await executeCloseout(options);
    }
  } catch (error) {
    process.stderr.write((error.code || 'CLOSEOUT_ERROR') + ': ' + error.message + '\n');
    process.exitCode = 1;
  }
}
