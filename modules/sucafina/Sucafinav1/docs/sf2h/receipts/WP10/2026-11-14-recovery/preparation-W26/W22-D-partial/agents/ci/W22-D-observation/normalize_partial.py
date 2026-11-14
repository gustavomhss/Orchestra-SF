"""Pure data-only capture of an incomplete hosted log; never imports product code."""
from pathlib import Path
import hashlib
import json
import re
from collections import Counter

ROOT = Path('/workspace/scratch/301a7f2754f4')
BASE = ROOT / 'evidence/W22'
OUT = BASE / 'normalized/D-portfolio-finance-partial'
PACKAGE = ROOT / 'agents/ci/W22-D-observation'
OUT.mkdir(parents=True, exist_ok=True)

def read(path):
    return json.loads((ROOT / path).read_text())

def sha(data):
    return hashlib.sha256(data).hexdigest()

def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def evidence(path):
    path = ROOT / path
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data)}

run = read('evidence/W22/terminal-D-run.json')
jobs = read('evidence/W22/terminal-D-jobs.json')['structuredContent']['jobs']
artifacts = read('evidence/W22/terminal-D-artifacts.json')['structuredContent']['artifacts']
log_response = read('evidence/W22/terminal-D-log-response.json')
raw = (BASE / 'D-job-132494810814.raw.txt').read_bytes()
assert raw == log_response['structuredContent']['content'].encode('utf-8')
assert sha(raw) == '98e1ca1414d36cccbe9a52f881dfc2f92c77c851ba830451647dae109b1654b5'
assert b'\r' not in raw
lines = raw.decode('utf-8').splitlines()
pins = read('evidence/W22/D-selection-pins.json')
envelope = read('evidence/W22/D-envelope.json')
compare = read('evidence/W22/D-compare.json')
commit = read('evidence/W22/initial-D-commit.json')
publication = read('publication/manifest-W22.json')
assert run['id'] == 43610668152 and run['head_sha'] == pins['snapshotSha'] == commit['sha']
assert run['status'] == 'completed' and run['conclusion'] == 'cancelled'
assert publication['productSha'] == pins['productSha'] == commit['parents'][0]['sha']
assert publication['expectedTree'] == pins['productTree']
assert commit['tree']['sha'] == pins['snapshotTree']
assert compare['ahead_by'] == 1 and compare['behind_by'] == 0 and compare['total_commits'] == 1
assert [value['filename'] for value in compare['files']] == ['.ci-run.json']
selected = [p for p in envelope['args'] if p.endswith('.test.ts')]
assert len(selected) == 18 and len(set(selected)) == 18
pin_by_path = {row['path']: row for row in pins['rows']}
for path in selected:
    full = 'modules/sucafina/' + path
    body = (ROOT / 'publication/frozen-W22/repo' / full).read_bytes()
    row = pin_by_path[full]
    assert sha(body) == row['sha256']
    assert hashlib.sha1(f'blob {len(body)}\0'.encode() + body).hexdigest() == row['candidateBlobSha']

headers, rows, errors, phases, cancellations = [], [], [], [], []
current = None
for number, raw_line in enumerate(lines, 1):
    clean = re.sub(r'^\d{4}-\d\d-\d\dT\S+\s', '', raw_line)
    header = re.fullmatch(r'(Sucafinav1/test/product/[^\s]+\.test\.ts):', clean)
    if header:
        current = header.group(1)
        assert current in selected
        headers.append({'path': current, 'rawLogLine': number})
    row = re.fullmatch(r'\((pass|fail|skip)\) (.+?)(?: \[([0-9.]+)ms\])?', clean)
    if row:
        assert current
        full = 'modules/sucafina/' + current
        pin = pin_by_path[full]
        rows.append({'status': row.group(1), 'name': row.group(2),
                     'durationMs': float(row.group(3)) if row.group(3) else None,
                     'path': current, 'rawLogLine': number,
                     'testOwner': pin['triageOwner'], 'own': pin['own'],
                     'candidateBlobSha': pin['candidateBlobSha'],
                     'producerPin': pin['producerPin']})
    if clean.startswith('# Unhandled error between tests'):
        errors.append({'kind': 'unhandled-error-between-tests', 'rawLogLine': number,
                       'nearbyFileHeader': current,
                       'qualification': 'An error event is not an additional named test outcome.',
                       'excerpt': lines[number-1:min(number+17, len(lines))]})
    marker = 'SF_WP13_SENSITIVITY_PHASE:'
    if marker in clean:
        phases.append({'rawLogLine': number, **json.loads(clean.split(marker, 1)[1])})
    if 'The operation was canceled.' in clean:
        cancellations.append({'rawLogLine': number, 'text': clean})

assert not re.search(r'^\d+ pass$', '\n'.join(re.sub(r'^\d{4}-\d\d-\d\dT\S+\s', '', s).strip() for s in lines), re.M)
observed = Counter(row['status'] for row in rows)
assert observed == {'pass': 27, 'fail': 2} and len(rows) == 29 and len(errors) == 1
assert len(headers) == 9 and len({h['path'] for h in headers}) == 9
test_job = next(j for j in jobs if j['id'] == 132494810814)
cleanup = next(j for j in jobs if j['id'] == 132507288922)
assert test_job['status'] == 'completed' and test_job['conclusion'] == 'cancelled'
assert cleanup['status'] == 'completed' and cleanup['conclusion'] == 'success'
delete_step = next(s for s in cleanup['steps'] if s['name'] == 'Delete the snapshot branch')
assert delete_step['status'] == 'completed' and delete_step['conclusion'] == 'success'
assert artifacts == []
observed_paths = {row['path'] for row in headers}
file_rows = []
for path in selected:
    outcomes = [row for row in rows if row['path'] == path]
    pin = pin_by_path['modules/sucafina/' + path]
    file_rows.append({'path': path, 'headerObserved': path in observed_paths,
                     'completeOutcomeInventory': False,
                     'observedNamedResults': len(outcomes),
                     'observedPass': sum(r['status'] == 'pass' for r in outcomes),
                     'observedFail': sum(r['status'] == 'fail' for r in outcomes),
                     'own': pin['own'], 'testOwner': pin['triageOwner'],
                     'fullFileOutcome': None, 'candidateBlobSha': pin['candidateBlobSha'],
                     'producerPin': pin['producerPin']})

identity = {'label': 'W22-D-portfolio-finance-partial', 'productSha': pins['productSha'],
            'productTree': pins['productTree'], 'snapshotSha': pins['snapshotSha'],
            'snapshotTree': pins['snapshotTree'], 'runId': run['id'], 'runAttempt': run['run_attempt'],
            'jobId': test_job['id'], 'envelopeSHA256': pins['envelopeSHA256']}
terminal = {'schema': 'wp10-hosted-partial-terminal-v1', **identity,
            'observedRunStatus': run['status'], 'observedRunConclusion': run['conclusion'],
            'observedJobStatus': test_job['status'], 'observedJobConclusion': test_job['conclusion'],
            'runStartedAt': run['run_started_at'], 'runUpdatedAt': run['updated_at'],
            'testTerminalObservedAt': '2026-11-14T16:17:18Z',
            'cleanupObservedAt': '2026-11-14T16:17:49Z',
            'cleanupJobId': cleanup['id'], 'cleanupStatus': cleanup['status'],
            'cleanupConclusion': cleanup['conclusion'], 'deleteSnapshotBranchStep': delete_step,
            'cancellationMessages': cancellations,
            'cancellationCause': None,
            'qualification': 'GitHub reports cancelled. The raw job says operation canceled. No inferred timed_out conclusion or cancellation actor is assigned.',
            'rawLog': {**evidence('evidence/W22/D-job-132494810814.raw.txt'),
                       'encoding': 'utf-8', 'exactToolDecodedContent': True,
                       'lfCount': raw.count(b'\n'), 'crlfCount': raw.count(b'\r\n'),
                       'endsWithLF': raw.endswith(b'\n')}}
observation = {'schema': 'wp10-hosted-partial-observation-v1', **identity,
               'completeness': 'partial', 'completeBunSummaryObserved': False,
               'selectedInventoryComplete': False,
               'observedCounts': {'namedResults': len(rows), 'pass': observed['pass'],
                                  'fail': observed['fail'], 'skip': observed['skip'],
                                  'unhandledErrorEvents': len(errors)},
               'completeSuiteTotals': {'tests': None, 'pass': None, 'fail': None,
                                       'skip': None, 'errors': None, 'expects': None,
                                       'durationSeconds': None},
               'selectedFiles': len(selected), 'observedFileHeaders': len(headers),
               'unobservedFiles': [path for path in selected if path not in observed_paths],
               'ownUnobservedFiles': [p for p in selected if p not in observed_paths and pin_by_path['modules/sucafina/'+p]['own']],
               'headerOrder': headers, 'files': file_rows, 'namedResults': rows,
               'errorEvents': errors, 'phaseTraces': phases,
               'omniHook': {'status': 'not-observed', 'finalReceiptObserved': False,
                            'declaredTests': None, 'spawns': None, 'delegated': None,
                            'acceptance': None},
               'qualifications': [
                   'Counts describe visible named log rows only; they are not complete suite totals.',
                   'An unobserved file has no assigned result and receives no criterion credit.',
                   'A visible pass row is not proof that its complete selected file finished.',
                   'WP13 phases after the first timeout are retained as trace observations without attributing their work to the later named test.',
                   'No product code, local test, local build, local import, or local typecheck was executed to make this receipt.',
                   'The strict complete-summary normalizer was intentionally not invoked because its preconditions are absent.',
               ]}
art = {'schema': 'wp10-hosted-artifact-observation-v1', **identity,
       'apiArtifacts': [], 'artifactCountObservedOnReturnedPage': 0,
       'zipDownloaded': False, 'membersExtracted': False,
       'source': evidence('evidence/W22/terminal-D-artifacts.json'),
       'qualification': 'The GitHub MCP artifacts response for this run returned artifacts: []. No artifact or ZIP is fabricated.'}
write_new(OUT / 'terminal.json', terminal)
write_new(OUT / 'test-observations.json', observation)
write_new(BASE / 'D-artifact-manifest.json', art)
inputs = ['evidence/W22/terminal-D-run.json', 'evidence/W22/terminal-D-jobs.json',
          'evidence/W22/terminal-D-artifacts.json', 'evidence/W22/terminal-D-log-response.json',
          'evidence/W22/D-job-132494810814.raw.txt', 'evidence/W22/D-envelope.json',
          'evidence/W22/D-compare.json', 'evidence/W22/initial-D-commit.json',
          'evidence/W22/D-selection-pins.json', 'evidence/W22/D-source-anchors.json',
          'publication/manifest-W22.json', 'publication/verified-W22-tree.json',
          'evidence/W22/D-artifact-manifest.json',
          'evidence/W22/normalized/D-portfolio-finance-partial/terminal.json',
          'evidence/W22/normalized/D-portfolio-finance-partial/test-observations.json',
          'agents/ci/W22-D-observation/normalize_partial.py']
summary = {'schema': 'wp10-hosted-partial-capture-v1', **identity,
           'status': 'sealed-partial', 'completeSuiteReceipt': False,
           'observedCounts': observation['observedCounts'],
           'selectedFiles': 18, 'observedFileHeaders': 9,
           'runConclusion': 'cancelled', 'jobConclusion': 'cancelled',
           'cleanupConclusion': 'success', 'omniHookStatus': 'not-observed',
           'artifacts': [], 'strictNormalizerInvoked': False,
           'partialNormalizer': 'agents/ci/W22-D-observation/normalize_partial.py',
           'sourceValidations': {'rawExactToolDecodedContent': True, 'utf8LFUnchanged': True,
                                 'snapshotDirectChildOfProduct': True, 'envelopeOnlyDiff': True,
                                 'selectedFrozenBlobsVerified': 18},
           'files': [evidence(path) for path in inputs]}
write_new(BASE / 'terminal-D-capture-summary.json', summary)
seal_inputs = inputs + ['evidence/W22/terminal-D-capture-summary.json']
write_new(PACKAGE / 'capture-seal.json', {'schema': 'wp10-data-capture-seal-v1',
           'qualification': 'Partial hosted observation only. No product approval or suite pass.',
           'files': [evidence(path) for path in seal_inputs]})
print(json.dumps({'partialDirectory': str(OUT), 'observed': observation['observedCounts'],
                  'ownUnobserved': observation['ownUnobservedFiles'],
                  'captureSummary': evidence('evidence/W22/terminal-D-capture-summary.json'),
                  'seal': evidence('agents/ci/W22-D-observation/capture-seal.json')}, indent=2))
