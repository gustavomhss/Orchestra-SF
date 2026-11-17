#!/usr/bin/env python3
"""Audit V2 documentation against V1 corpus; never marks product tests PASS."""
import pathlib,json,collections,re,csv
root=pathlib.Path(__file__).resolve().parents[1]
assert (root/'quality-v2'/'COLD-REVIEW.md').exists()
original=[json.loads(x) for x in (root/'stories_70x2.jsonl').read_text().splitlines() if x.strip()]
e2e=[json.loads(x) for x in (root/'stories_e2e.jsonl').read_text().splitlines() if x.strip()]
routes=[json.loads(x) for x in (root/'ROUTE-TEST-CASES.jsonl').read_text().splitlines() if x.strip()]
dossiers=json.loads((root/'quality-v2'/'STEP-LEVEL-DOSSIERS.json').read_text())['cases']
tr=json.loads((root/'QA-TRACEABILITY.json').read_text())
assert len(original)==140 and len(e2e)==45 and len(routes)==825 and len(dossiers)==8
assert len({x['id'] for x in original+e2e+dossiers})==193
assert all(x['user_story'].startswith('Como '+x['actors'][0]+',') for x in e2e)
assert e2e[5]['title']=='O documento diz 6 dias; a extração sugere 60'
conditions=collections.Counter(x['conditional_release_feature'] or 'BASELINE' for x in e2e)
assert conditions==tr['e2e_by_condition'],(conditions,tr['e2e_by_condition'])
assert conditions['BASELINE']==34 and sum(conditions.values())==45
assert all(x['test_execution_status']=='NOT_RUN' and all(s['status']=='NOT_RUN' and s['expected'] and s['witness'] for s in x['steps']) for x in dossiers)
assert len(set(x['pattern'] for x in routes if ':' in x['pattern']))==82
assert len(set(x['pattern'] for x in routes if ':' not in x['pattern']))==83
with (root/'quality-v2'/'TRANSITION-COVERAGE-PLAN.csv').open() as f:
    rr=list(csv.DictReader(f))
assert len(rr)>=40 and all(x['status']=='NOT_RUN' for x in rr)
print('AUDIT_V2_PASS: document grammar/conditional classification/fixture title/8 step-level dossiers/transition design validated')
print('PRODUCT_ACCEPTANCE_NOT_RUN: no UAT, no installed seed, no real Entra/VM; 306 operations still only mapped structurally')
