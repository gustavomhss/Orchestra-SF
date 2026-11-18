"""Validate planning metadata only. Does not execute any repository code or tests."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

p=argparse.ArgumentParser()
p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent)
p.add_argument('--canonical',type=Path)
p.add_argument('--trace',type=Path,help='Criteria index; defaults to ../criteria-trace.json beside the execution directory')
p.add_argument('--strict',action='store_true')
p.add_argument('--output',type=Path)
a=p.parse_args()
errors=[];warnings=[]
def load(path):
    try: return json.loads(path.read_text())
    except Exception as exc:
        errors.append(f'{path}: {exc}')
        return None
manifest=load(a.root/'manifest.json') or {}
rows=manifest.get('work_orders',[])
orders={}
for row in rows:
    w=load(a.root/row['path'])
    if not w: continue
    if w.get('id')!=row.get('id'): errors.append('ID/path mismatch '+str(row))
    if w['id'] in orders: errors.append('Duplicate work ID '+w['id'])
    orders[w['id']]=w
if len(orders)!=manifest.get('counts',{}).get('work_orders'): errors.append('Work-order count mismatch')
unlisted={x.stem for x in (a.root/'work-orders').glob('*.json')}-set(orders)
if unlisted:errors.append('Unlisted work orders '+str(sorted(unlisted)))
required=['owns','depends_authoring','depends_integration','depends_qualification','consumes','deliver','acceptance_cases','gates','stop','handoff','canonical']
claims=[]
for wid,w in orders.items():
    for key in required:
        if key not in w: errors.append(f'{wid} missing {key}')
    if not w.get('owns') or not w.get('acceptance_cases'): errors.append(f'{wid} empty ownership/acceptance')
    for x in w.get('owns',[]):
        prefix=x.endswith('/**');clean=x[:-3] if prefix else x
        if clean.startswith('/') or '..' in PurePosixPath(clean).parts or '//' in clean or str(PurePosixPath(clean))!=clean or '*' in clean:
            errors.append(f'{wid} unsafe pattern {x}')
        claims.append((wid,clean,prefix))
for i,(wa,pa,ga) in enumerate(claims):
    for wb,pb,gb in claims[i+1:]:
        if wa==wb: continue
        overlap=pa==pb or ga and pb.startswith(pa+'/') or gb and pa.startswith(pb+'/')
        if overlap: errors.append(f'Ownership overlap {wa}:{pa} <> {wb}:{pb}')
def graph_check(field):
    graph={wid: (w[field]['work_orders'] if isinstance(w[field],dict) else w[field]) for wid,w in orders.items()}
    seen=set();visiting=set()
    def visit(x):
        if x in visiting:
            errors.append(f'{field} cycle at {x}');return
        if x in seen:return
        visiting.add(x)
        for d in graph[x]:
            if d not in graph:errors.append(f'{x} missing {field} dependency {d}');continue
            visit(d)
        visiting.remove(x);seen.add(x)
    for x in graph:visit(x)
    return len(seen)
integrated=graph_check('depends_integration')
qualified=graph_check('depends_qualification')
integration_groups=manifest.get('integration_groups',{})
for gid,group in integration_groups.items():
    for member in group.get('members',[]):
        if member not in orders:errors.append(f'{gid} unknown atomic member {member}')
        elif orders[member].get('integration_group')!=gid:errors.append(f'{member} missing explicit atomic group {gid}')
    for dep in group.get('prerequisites',[]):
        if dep not in orders:errors.append(f'{gid} unknown atomic prerequisite {dep}')
def producer_closure(owner):
    seen=set();pending=[owner]
    while pending:
        node=pending.pop()
        if node in seen or node not in orders:continue
        seen.add(node);pending.extend(orders[node]['depends_integration'])
        group=integration_groups.get(orders[node].get('integration_group'),{})
        pending.extend(group.get('members',[]));pending.extend(group.get('prerequisites',[]))
    return seen
contract_ids=set();c={}
contract_path=a.root/'contract-catalog.json'
if contract_path.exists():
    c=load(contract_path) or {}
    source=c.get('contracts',c.get('families',{}))
    if isinstance(source,dict):contract_ids.update(source)
    elif isinstance(source,list):contract_ids.update(x.get('id') for x in source)
    # Catalog implementations may store endpoint records under separate keys.
    if not contract_ids: warnings.append('Contract catalog shape requires review')
elif a.strict:errors.append('Missing contract-catalog.json')
else:warnings.append('Contract catalog not present; signature readiness not checked')
components=load(a.root/'component-locks.json') or {}
contract_ids.update(components.get('locks',{}))
if (a.root/'surface-manifest.json').exists():contract_ids.add('surface-specs')
elif a.strict: errors.append('Missing surface-manifest.json')
else: warnings.append('Surface manifest not present; route/field/copy readiness not checked')
if a.strict:
    for wid,w in orders.items():
        for dep in w['depends_authoring']:
            if dep['lock'] not in contract_ids:errors.append(f'{wid} unresolved authoring lock {dep["lock"]}')
    for fname in manifest.get('frozen_inputs_required',[]):
        if not (a.root/fname).exists():errors.append('Missing frozen input '+fname)
    if not (a.root/'COMPONENT-CONTRACTS.md').exists():errors.append('Missing COMPONENT-CONTRACTS.md signatures')
    if not (a.root/'component-signatures.ts').exists():errors.append('Missing typed component signature specification')
producer_locks={}
for lock,record in components.get('locks',{}).items():
    producers=record.get('producer',[])
    for producer in producers if isinstance(producers,list) else [producers]:producer_locks[producer]=lock
component_dependency_links=0
for wid,w in orders.items():
    deps=set(w['depends_integration'])|{x['order'] for x in w['consumes'].get('producer_exports',[])}
    for part in w.get('incremental_outputs',[]):deps.update(part.get('depends_integration',[]))
    for dep in deps:
        lock=producer_locks.get(dep)
        if not lock:continue
        component_dependency_links+=1
        groups={'depends_authoring':{x['lock'] for x in w['depends_authoring']},'consumes.contracts':set(w['consumes']['contracts']),'required_reads.contracts':set(w['required_reads']['contracts'])}
        for field,values in groups.items():
            if lock not in values:errors.append(f'{wid} consumes {dep} without {lock} in {field}')
output_nodes={}
for wid,w in orders.items():
    for part in w.get('incremental_outputs',[]):
        oid=part['id']
        if oid in output_nodes:errors.append('Duplicate incremental output '+oid)
        output_nodes[oid]=(wid,part)
        for path in part.get('owns',[]):
            clean=path[:-3] if path.endswith('/**') else path
            if not any(clean==own or own.endswith('/**') and (clean==own[:-3] or clean.startswith(own[:-3]+'/')) for own in w['owns']):errors.append(f'{oid} path outside parent owns: {path}')
        for dep in part.get('depends_integration',[]):
            if dep not in orders:errors.append(f'{oid} missing producer {dep}')
for oid,(_,part) in output_nodes.items():
    for dep in part.get('consumes_outputs',[]):
        if dep not in output_nodes:errors.append(f'{oid} missing incremental dependency {dep}')
pilot_closure=set();pilot_visiting=set()
def visit_pilot(node):
    if node in pilot_visiting:errors.append('Pilot output cycle at '+node);return
    if node in pilot_closure:return
    pilot_visiting.add(node)
    if node in output_nodes:
        _,part=output_nodes[node];deps=part.get('depends_integration',[])+part.get('consumes_outputs',[])
    elif node in orders:deps=orders[node]['depends_integration']
    else:errors.append('Unknown pilot output '+node);deps=[]
    for dep in deps:visit_pilot(dep)
    pilot_visiting.remove(node);pilot_closure.add(node)
for node in manifest.get('pilot',{}).get('work_orders',[])+manifest.get('pilot',{}).get('incremental_outputs',[]):visit_pilot(node)
if manifest.get('pilot') and 'D01' not in pilot_closure:errors.append('Pilot lacks required desktop broker')
surfaces={}
surface_operation_owner_links=0
route_pairs_checked=0
for wid,w in orders.items():
    for sid in w.get('surfaces',[]):surfaces.setdefault(sid,[]).append(wid)
expected={f'CAP{i:02}' for i in range(1,29)}|{f'UI{i:02}' for i in range(29,71)}
if set(surfaces)!=expected:errors.append('Surface coverage mismatch missing='+str(sorted(expected-set(surfaces)))+' extra='+str(sorted(set(surfaces)-expected)))
if (a.root/'surface-manifest.json').exists():
    sm=load(a.root/'surface-manifest.json') or {}
    entries=sm.get('surfaces',[])
    if {s['id'] for s in entries}!=expected or len(entries)!=70:errors.append('Surface manifest does not have exactly the 70 unique IDs')
    for s in entries:
        owner=s.get('primaryOwner')
        if owner not in orders:errors.append(f'{s["id"]} unknown primary owner {owner}')
        elif s['id'] not in orders[owner].get('surfaces',[]):errors.append(f'{s["id"]} primary owner {owner} does not claim surface')
        for contributor in s.get('contributorOwners',[]):
            if contributor not in orders:errors.append(f'{s["id"]} unknown contributor {contributor}')
        family=c.get('families',{}).get(s.get('contractFamily'),{})
        resource=family.get('resources',{}).get(s.get('resource'))
        if resource is None:errors.append(f'{s["id"]} missing family/resource contract {s.get("contractFamily")}/{s.get("resource")}')
        elif not resource.get('operations') and not resource.get('availability'):errors.append(f'{s["id"]} empty resource without explicit producer gate')
        elif owner in orders:
            available=producer_closure(owner)
            for operation_owner in {c.get('operations',{}).get(oid,{}).get('owner') for oid in resource.get('operations',[])}:
                surface_operation_owner_links+=1
                if operation_owner not in available:errors.append(f'{s["id"]} owner {owner} lacks operation producer {operation_owner} in integration closure (explicit atomic groups included)')
    route_path=a.root/'route-signatures.ts'
    if route_path.exists():
        route_text=route_path.read_text();route_map={};current_surface=None
        try:route_block=route_text.split('export type SfResolvedRouteMap = {',1)[1].split('\n}',1)[0]
        except IndexError:errors.append('Missing closed SfResolvedRouteMap declaration');route_block=''
        for line in route_block.splitlines():
            header=re.match(r'\s*readonly ((?:CAP|UI)\d{2}):',line)
            if header:current_surface=header.group(1);route_map[current_surface]={};continue
            kind=re.search(r'kind: "([^"]+)"; params: (.+)',line)
            if kind and current_surface:
                if kind.group(1) in route_map[current_surface]:errors.append(f'Duplicate typed route {current_surface}/{kind.group(1)}')
                params=[] if kind.group(2).startswith('SfNoParams') else re.findall(r'(\w+):\s*SfRef',kind.group(2))
                route_map[current_surface][kind.group(1)]=set(params)
        if set(route_map)!=expected:errors.append('Typed route surface ID set differs from the 70-surface manifest')
        for s in entries:
            expected_routes={route['kind']:set(re.findall(r':([A-Za-z_][A-Za-z0-9_]*)',route['path'])) for route in s['routes']}
            if route_map.get(s['id'])!=expected_routes:errors.append(f'Typed route kind/params mismatch for {s["id"]}')
            route_pairs_checked+=len(expected_routes)
    elif a.strict:errors.append('Missing route-signatures.ts')
operations=c.get('operations',{})
for oid,operation in operations.items():
    if operation.get('owner') not in orders:errors.append(f'{oid} unknown operation owner {operation.get("owner")}')
    if operation.get('family') not in c.get('families',{}):errors.append(f'{oid} unknown family {operation.get("family")}')
    if operation.get('sourceRef') not in c.get('sources',{}):errors.append(f'{oid} unknown sourceRef {operation.get("sourceRef")}')
for family,record in c.get('families',{}).items():
    for resource,value in record.get('resources',{}).items():
        for oid in value.get('operations',[]):
            if oid not in operations:errors.append(f'{family}/{resource} unknown operation {oid}')
registry=manifest.get('operation_registry',{})
registry_pilot_operations=0
if registry:
    if set(registry.get('metadata_operation_ids',[]))!=set(operations):errors.append('Operation metadata key set differs from catalog')
    if set(registry.get('final',{}).get('required_operation_ids',[]))!=set(operations):errors.append('Final operation binding completeness differs from catalog')
    expected_pilot={oid for oid,op in operations.items() if op.get('owner') in registry.get('pilot',{}).get('required_owners',[])}
    registry_pilot_operations=len(expected_pilot)
    if set(registry.get('pilot',{}).get('required_operation_ids',[]))!=expected_pilot:errors.append('Pilot operation registry subset differs from its admitted owners')
    if not set(registry.get('pilot',{}).get('required_owners',[])).issubset({x.split('.')[0] for x in pilot_closure}):errors.append('Pilot registry depends on an owner outside pilot closure')
    for field in ['metadata_path','binding_path']:
        if registry.get(field) not in orders.get(registry.get('owner'),{}).get('owns',[]):errors.append('Registry '+field+' is not owned exactly by its integrator')
    if registry.get('metadata_path')=='packages/schema/src/sucafina/operations.ts':errors.append('Metadata registry collides with the A11 Operations family')
elif a.strict:errors.append('Missing explicit incremental operation registry contract')
for wid,w in orders.items():
    for ref in w['consumes'].get('operation_refs',[]):
        if ref.removeprefix('contract-catalog.json#/operations/') not in operations:errors.append(f'{wid} unresolved consumed operation {ref}')
    for ref in w.get('required_reads',{}).get('source_bindings',[]):
        if ref.removeprefix('contract-catalog.json#/sources/') not in c.get('sources',{}):errors.append(f'{wid} unresolved source read {ref}')
for wid,w in orders.items():
    for e in w.get('entrypoints',[]):
        if not any(e['path']==path or path.endswith('/**') and e['path'].startswith(path[:-3]+'/') for path in w['owns']):errors.append(f'{wid} entrypoint outside owns: {e["path"]}')
canonical_stats=None
if a.canonical:
    d=load(a.canonical)
    trace_path=a.trace or a.root.parent/'criteria-trace.json'
    t=load(trace_path) or {}
    ids=set();resolved=0;matching=0
    for c in t.get('criteria',[]):
        if c['id'] in ids:errors.append('Duplicate canonical index ID '+c['id'])
        ids.add(c['id']);v=d
        try:
            for part in c['canonicalPointer'].split('/')[1:]:
                k=part.replace('~1','/').replace('~0','~')
                v=v[int(k)] if isinstance(v,list) else v[k]
            resolved+=1
            if v.get('id')==c['id']:matching+=1
            else:errors.append('Canonical ID mismatch '+c['id'])
        except Exception:errors.append('Unresolved canonical pointer '+c['id'])
    raw=a.canonical.read_bytes()
    expected_blob=t.get('canonical',{}).get('blob')
    def blob_hash(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    normalization='none'
    canonical_bytes=raw
    if blob_hash(raw)!=expected_blob and raw.endswith(b'\n\n') and blob_hash(raw[:-1])==expected_blob:
        canonical_bytes=raw[:-1];normalization='removed one extra terminal LF from local materialization; exact pinned Git blob verified'
    if blob_hash(canonical_bytes)!=expected_blob:errors.append('Canonical local content does not reproduce pinned Git blob')
    canonical_stats={'indexed':len(ids),'resolved':resolved,'matching':matching,'sha256':hashlib.sha256(canonical_bytes).hexdigest(),'git_blob':blob_hash(canonical_bytes),'local_materialization':normalization}
    if len(ids)!=1610 or resolved!=1610 or matching!=1610:errors.append('Canonical 1610 index mismatch')
    task_keys=set(t.get('taskMappings',{}))
    referenced_tasks=set()
    for wid,w in orders.items():
        for task in w['canonical']['task_refs']:
            referenced_tasks.add(task)
            if task not in task_keys:errors.append(f'{wid} unknown canonical task {task}')
    if referenced_tasks!=task_keys:errors.append('Task coverage mismatch missing='+str(sorted(task_keys-referenced_tasks)))
    canonical_stats['referenced_tasks']=len(referenced_tasks)
result={'status':'PASS_DOCUMENT_STRUCTURE' if not errors else 'FAIL_DOCUMENT_STRUCTURE','strict':a.strict,'product_tests_executed':False,'work_orders':len(orders),'ui_work_orders':sum(w.get('kind')=='ui' for w in orders.values()),'ownership_claims':len(claims),'integration_graph_nodes':integrated,'qualification_graph_nodes':qualified,'atomic_integration_groups':len(integration_groups),'component_dependency_links':component_dependency_links,'surface_operation_owner_links':surface_operation_owner_links,'typed_route_pairs':route_pairs_checked,'incremental_outputs':len(output_nodes),'pilot_closure':sorted(pilot_closure),'contract_operations':len(operations),'pilot_operation_bindings':registry_pilot_operations,'surface_ids':len(surfaces),'canonical':canonical_stats,'errors':errors,'warnings':warnings}
if a.output:a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
