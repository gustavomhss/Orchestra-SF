#!/usr/bin/env python3
"""Offline evidence-census checks. Never imports product, uses network or runs CI."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
from canonical import read_inventory, COUNTS


def read(path):
    return json.loads(Path(path).read_text())


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def pointer(value, path):
    if not path:
        return value
    for token in path.split('/')[1:]:
        token = token.replace('~1', '/').replace('~0', '~')
        value = value[int(token)] if isinstance(value, list) else value[token]
    return value


def leaves(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from leaves(item)
    elif isinstance(value, list):
        for item in value:
            yield from leaves(item)
    else:
        yield value


def verify(args):
    inv = read_inventory(args.campaign, args.proof_map)
    root = args.census
    manifest = read(root / 'manifest.json')
    expected = {c['id']: c for c in inv['criteria']}
    criteria = [r for p in sorted((root / 'criteria').glob('*.json')) for r in read(p)['criteria']]
    ids = [c['id'] for c in criteria]
    assert len(ids) == len(set(ids)) == 1610, 'Criterion duplicates/count'
    assert set(ids) == set(expected), 'Canonical ID universe'
    assert manifest['counts'] == COUNTS
    sources = read(root / 'sources.json')['sources']
    sids = {s['id'] for s in sources}
    assert len(sids) == len(sources), 'Duplicate source IDs'
    runbook = read(root / 'runs.json')
    evidence_ids = set(runbook['published_evidence_records'])
    taskrows = read(root / 'tasks.json')['tasks']
    taskids = {t['canonical']['id'] for t in taskrows}
    assert len(taskids) == len(taskrows) == 74
    assert {t['canonical']['id']:t['canonical'] for t in taskrows} == {t['id']:t for t in inv['tasks']}, 'Canonical tasks altered'
    contracts = read(root / 'contracts.json')['contracts']
    assert [c['canonical_definition'] for c in contracts] == inv['contracts'], 'Canonical contracts altered'
    assert len(contracts) == 17
    enums = {'YES', 'PARTIAL', 'NO', 'UNKNOWN'}
    for c in criteria:
        for key in ['id','text','entity_id','family','canonical_pointer','text_sha256','proof_packages','integrated_proofs']:
            assert c[key] == expected[c['id']][key], f'{c["id"]}: canonical {key}'
        assert set(c['task_refs']) <= taskids
        for axis in ['implemented','integrated','proven']:
            assert c['assessment'][axis] in enums, (c['id'],axis)
        assert c['assessment']['accepted'] == 'NOT_ACCEPTED', 'No accepted C in this census'
        assert c['assessment']['basis'], 'Missing current rationale'
        expected_unknown = {k for k in ['implemented','integrated','proven'] if c['assessment'][k]=='UNKNOWN'}
        assert set(c['assessment']['unknown_dimensions']) == expected_unknown
        if expected_unknown:
            assert c['assessment'].get('unknown_reason'), 'Unexplained UNKNOWN'
        for field in [c['code']['source_refs'],c['consumer']['source_refs'],c['evidence']['source_refs']]:
            assert set(field) <= sids, (c['id'],'missing source refs',set(field)-sids)
        assert set(c['evidence']['record_refs']) <= evidence_ids, 'Missing evidence record'
        matrix = c['evidence']['published_row']
        if matrix:
            assert matrix['source_id'] in sids, (c['id'],'missing matrix source',matrix)
            assert matrix['pointer'], 'Missing literal row pointer'
        if c['assessment']['proven'] == 'YES':
            assert c['evidence']['scoped_run_ids'] or c['evidence']['record_refs'], 'Proof YES without bound observation'
    remaining = read(root / 'remaining-work.json')
    rs = remaining['tasks']
    assert len(rs) == 74 and {r['task_id'] for r in rs} == taskids, 'Remaining tasks not deduplicated'
    assert len(remaining['work_packages']) == 15
    pools = remaining['effort_pools']
    pids = {p['id'] for p in pools}
    charged = [t for p in pools for t in p['task_ids']]
    assert len(charged) == len(set(charged)) == 74 and set(charged) == taskids, 'Effort charged twice or task missing'
    for r in rs:
        assert r['owner'] and r['paths'] and r['next_action'], (r['task_id'],'unactionable')
        assert r['effort_pool'] in pids
        assert set(r['dependencies']['build']+r['dependencies']['consumer']) <= taskids
        assert set(r['evidence_refs']) <= sids
    totals = [sum(p['range_person_hours'][i] for p in pools) for i in [0,1]]
    assert totals == remaining['effort_summary']['unique_pool_arithmetic_range']
    common = remaining['common_actions']
    commonids = {a['id'] for a in common}
    assert len(commonids) == len(common)
    for action in common:
        assert action['accountable_pool'] in pids and action['owner'] and action['next_action']
        assert action['counted_once'] and not action['additional_to_pool_hours']
        assert sum(action['id'] in p['accountable_common_action_refs'] for p in pools) == 1
    for row in rs:
        assert set(row['common_action_refs']) <= commonids
    assert all(p['not_a_schedule_DAG'] for p in pools)
    handoffs = read(root / 'output-consumption.json')
    for output in handoffs['outputs']:
        c = output['canonical_output']
        assert c['producer_task'] in taskids and set(c['consumer_tasks']) <= taskids
        assert set(output['observed_artifact_source_refs']) <= sids
    integrity = read(root / 'source-integrity.json')
    assert not integrity['failures']
    assert all(x['matches'] is not False for x in integrity['observations'])
    matrix_checks = []
    if args.source_cache_index:
        cache = read(args.source_cache_index)
        parsed = {}
        for c in criteria:
            m = c['evidence']['published_row']
            if not m:
                continue
            sid = m['source_id']
            assert sid in cache and cache[sid].get('cache_path'), 'Missing local matrix body '+sid
            if sid not in parsed:
                parsed[sid] = read(cache[sid]['cache_path'])
            observed = pointer(parsed[sid], m['pointer'])
            vals = list(leaves(observed))
            assert c['id'] in vals, (c['id'],'matrix row ID not found',m)
            assert c['text'] in vals, (c['id'],'matrix row literal text not found',m)
            matrix_checks.append(c['id'])
        for source in sources:
            sid = source['id']
            local = cache.get(sid,{}).get('cache_path')
            if local and source.get('content_git_blob_verified'):
                raw = Path(local).read_bytes()
                actual = hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
                assert actual == source['blob_sha'], 'Blob mismatch '+sid
    delta_count = None
    if args.changed_files:
        delta = read(args.changed_files)
        files = delta if isinstance(delta,list) else delta['files']
        prefixes = manifest['allowed_write_prefixes']
        for f in files:
            path = f if isinstance(f,str) else f.get('path',f.get('filename'))
            assert any(path.startswith(prefix) for prefix in prefixes), 'Out-of-scope write '+path
            if isinstance(f,dict) and 'status' in f:
                assert f['status'] == 'added', 'Receipt attempt must be append-only '+path
        delta_count = len(files)
    if args.files_manifest:
        assert args.repo_root
        fs = read(args.files_manifest)
        for f in fs['files']:
            assert sha256(args.repo_root/f['path']) == f['sha256'], 'Deliverable digest mismatch '+f['path']
    counts = {axis:dict(collections.Counter(c['assessment'][axis] for c in criteria)) for axis in ['implemented','integrated','proven','accepted']}
    assert counts == manifest['assessment_counts_not_progress']
    return {'schema':'sf2h-census-verification-v1','result':'PASS','meaning':'Mechanical identity, reference and envelope checks only; no product proof or accepted C.','canonical_counts':COUNTS,'campaign_sha256':inv['campaign_sha256'],'literal_published_rows_checked':len(matrix_checks),'published_git_blobs_verified':sum(x['matches'] is True for x in integrity['observations']),'source_catalog_entries':len(sources),'task_effort_charged_once':len(charged),'namespace_delta_files_checked':delta_count,'product_tests_executed':False,'ci_dispatched':False,'checks':['Canonical bytes/hash/IDs/text/pointers/families/proof-map','74 tasks and17 contracts identical to canonical structures','No duplicates; source/evidence/task references resolve','Current axes and explicit UNKNOWN distinct from historical claims','Remaining owners/paths/dependencies/actions and unique effort pools','Source byte identities, optional literal matrix pointers and publication namespace envelope']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--campaign',required=True,type=Path)
    parser.add_argument('--proof-map',required=True,type=Path)
    parser.add_argument('--census',required=True,type=Path)
    parser.add_argument('--source-cache-index',type=Path,help='Optional offline MCP-exported source ID→cache_path index')
    parser.add_argument('--changed-files',type=Path,help='Optional MCP GitHub commit/compare files JSON or proposed path list')
    parser.add_argument('--files-manifest',type=Path)
    parser.add_argument('--repo-root',type=Path)
    parser.add_argument('--output',type=Path)
    args = parser.parse_args()
    result = verify(args)
    text = json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        args.output.write_text(text)
    print(text,end='')
