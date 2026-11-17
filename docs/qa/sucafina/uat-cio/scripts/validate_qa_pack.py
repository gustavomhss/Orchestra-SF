#!/usr/bin/env python3
"""Read-only consistency QA for the authored QA 360° archive; no app tests or external access."""
from pathlib import Path
import csv, json, hashlib, collections, zipfile, sys
ROOT=Path(__file__).resolve().parent.parent

def require(cond, message):
    if not cond: raise AssertionError(message)

def rows(path):
    with (ROOT/path).open(encoding='utf-8-sig',newline='') as f: return list(csv.DictReader(f))

def cases(path):
    with (ROOT/path).open(encoding='utf-8') as f: return [json.loads(line) for line in f if line.strip()]

surfaces=rows('MATRIX-70-SURFACES.csv')
routes=rows('MATRIX-165-ROUTES.csv')
surface_cases=cases('stories_70x2.jsonl')
e2e=cases('stories_e2e.jsonl')
probes=rows('ROUTE-TEST-CASES.csv')
probes_json=cases('ROUTE-TEST-CASES.jsonl')
fixture=json.loads((ROOT/'fixtures/SF-LAB-2026.json').read_text())
require(len(surfaces)==70 and len(set(x['surface_id'] for x in surfaces))==70,'70 unique surfaces')
require(len(routes)==165 and len(set((x['surface_id'],x['route_kind'],x['pattern']) for x in routes))==165,'165 unique route variants')
require(len(surface_cases)==140 and len(set(x['id'] for x in surface_cases))==140,'140 primary/adversarial stories')
require(len(e2e)==45 and len(set(x['id'] for x in e2e))==45,'45 cross-domain stories')
require(len(probes)==825 and len(probes_json)==825,'825 route probes (five for each route)')
all_surface_ids={x['surface_id'] for x in surfaces}; all_story_ids={x['id'] for x in surface_cases}
require(all(x['surface_ids'] and set(x['surface_ids'])<=all_surface_ids for x in surface_cases),'surface story references')
require(all(x['primary_story'] in all_story_ids and x['negative_story'] in all_story_ids for x in surfaces),'every surface has actual paired stories')
require(all(x['canonical_story'] in all_story_ids and x['adversarial_story'] in all_story_ids for x in routes),'every route has canonical and adversarial story')
require(all(x['surface_id'] in all_surface_ids and x['primary_story'] in all_story_ids for x in probes),'each probe traces to surface story')
require(all(x['status']=='NOT_RUN' for x in probes),'never pre-fill route status')
require(all(x.get('priority') in ('P0','P1','P2') and len(x.get('steps',[]))>=3 and len(x.get('expected',[]))>=2 for x in surface_cases+e2e),'stories are actionable and have oracles')
require(all(x.get('id','').startswith('SF-') for x in surface_cases+e2e),'stable QA identifiers')
require(set(j for x in e2e for j in x['journeys'])=={f'J{i:02}' for i in range(1,9)},'all 8 original journeys')
require(all(not any(str(x.get(f,''))=='PASSED' for f in ('status','execution_status')) for x in surface_cases+e2e),'do not claim passes')
for x in surfaces:
    ss=[s for s in surface_cases if x['surface_id'] in s['surface_ids']]
    require(sum(s['kind']=='SURFACE_PRIMARY' for s in ss)==1 and sum(s['kind']=='SURFACE_ADVERSARIAL' for s in ss)==1,'missing unique positive and negative: '+x['surface_id'])
require(len(fixture['projects'])==25 and len(fixture['suppliers'])==10,'25 synthetic projects / 10 synthetic suppliers')
require(len(fixture['graph_fake']['fake_user_profiles_for_mock_only'])>=20,'synthetic mock users')
assert fixture['budget']['annual_budget']==600000
assert fixture['budget']['base_outlook']==590000
assert fixture['headcount']['planned_fte']==42
require(fixture['classification'].startswith('100% FICTITIOUS'),'fixture classification')
for name in ('fixtures/IMPORT-OPEX-VALID.xlsx','fixtures/IMPORT-OPEX-ADVERSARIAL.xlsx'):
    with zipfile.ZipFile(ROOT/name) as z:
        z.testzip(); require('xl/workbook.xml' in z.namelist(),'xlsx archive structure '+name)
all_files=[p for p in ROOT.rglob('*') if p.is_file() and p.name!='QA-TRACEABILITY.json']
checksums={p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in all_files}
report={
 'schema':'sf-uat-360-static-verification-v1','status':'STATIC_DESIGN_CHECKS_PASSED_NOT_PRODUCT_EXECUTION',
 'surface_count':len(surfaces),'route_count':len(routes),'surface_stories':len(surface_cases),'e2e_stories':len(e2e),
 'distinct_stories':len(surface_cases)+len(e2e),'route_probes':len(probes),
 'coverage_journeys':sorted(set(j for x in e2e for j in x['journeys'])),
 'surface_coverage':{x['surface_id']:dict(primary=x['primary_story'],adversarial=x['negative_story']) for x in surfaces},
 'routes_by_surface': dict(collections.Counter(x['surface_id'] for x in routes)),
 'e2e_by_priority':dict(collections.Counter(x['priority'] for x in e2e)),
 'e2e_by_condition':dict(collections.Counter(x.get('condition','BASELINE') for x in e2e)),
 'file_sha256':checksums, 'not_run':True,'executed_tests':0,'live_tenant_tests':0,'go_live_approved':False
}
(ROOT/'QA-TRACEABILITY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VALIDATED: 70 surfaces / 165 routes / 140+45=185 full stories / 825 manual route probes / 8 journeys / 25 projects / 10 suppliers')
print('STATUS: static design validation ONLY; no product/tenant/VM acceptance executed.')
