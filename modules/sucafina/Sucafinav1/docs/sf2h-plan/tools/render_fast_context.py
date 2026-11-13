#!/usr/bin/env python3
"""Deterministic execution-context projections. Never runs the product or launches agents."""
import argparse
import hashlib
import json
from pathlib import Path
import re

VERSION = '1.0.1'
FAMILIES = ('dod', 'invariants', 'quality_standards', 'completeness_criteria', 'success_criteria')


def ids(wp, *numbers):
    return [f'{wp}.T{n:02}' for n in numbers]


# This is an explicit responsibility map, not permission inference from prose.
# A task may have support/correction roles. Those roles never receive its entire WP grant.
ACTORS = {
    'S0': {'primary': ids('WP00', 1, 2) + ids('WP10', 1, 5), 'branches': ['sf2-contracts', 'sf2-integrate', 'sf2-control'], 'team': ['S0-A', 'S0-B', 'S0-C'], 'sessions': ['S1', 'S2', 'S3', 'S4']},
    'S0-A': {'primary': ids('WP00', 3) + ids('WP10', 7), 'branches': ['sf2-fixtures', 'sf2-atlas']},
    'S0-B': {'primary': ids('WP10', 6), 'support': {'WP00.T04': 'Somente preflight e suporte do runtime nas alocações canônicas; S3 qualifica o gate.'}, 'branches': ['sf2-native-preflight', 'sf2-runtime']},
    'S0-C': {'primary': ids('WP10', 2, 4) + ids('WP14', 3, 4), 'correction': {'WP14': 'Somente após transferência S4→S0-C no head e lease aceitos; respeitar janelas de harness/CI.'}, 'branches': ['sf2-harness', 'sf2-memory']},
    'S1': {'primary': [], 'support': {'WP12.T01': 'Somente fonte sf-explicar-forecast no lease declarado; nenhuma edição de manifest.', 'WP12.T02': 'Somente cinco demais fontes Finance/Portfolio nos leases declarados; entrega por hash a S4-B.'}, 'correction': {'WP02': 'Somente depois do encerramento S1-B e aceite do lease no checkpoint canônico.'}, 'branches': ['sf2-skills-finance', 'sf2-dashboard'], 'team': ['S1-A', 'S1-B', 'S1-C'], 'reviewer': 'S1-R1'},
    'S2': {'primary': ids('WP06', 5), 'support': {'WP10.T04': 'Somente controle e recibos CI nos intervalos delegados; não editar harness/workflows.'}, 'correction': {'WP05': 'Somente depois do encerramento S2-B e aceite do lease no checkpoint canônico.'}, 'branches': ['sf2-documents', 'sf2-ci-receipts', 'sf2-analytics'], 'team': ['S2-A', 'S2-B', 'S2-C'], 'reviewer': 'S2-R2'},
    'S3': {'primary': ids('WP00', 4), 'support': {'WP12.T02': 'Somente cinco fontes Maestro/Revisor nos leases declarados; nenhuma edição de manifest.'}, 'correction': {'WP07': 'Somente depois do encerramento S3-A e aceite do lease no checkpoint canônico.'}, 'branches': ['sf2-native-proof', 'sf2-skills-maestro', 'sf2-reviews'], 'team': ['S3-A', 'S3-B', 'S3-C'], 'reviewer': 'S3-R3'},
    'S4': {'primary': ids('WP14', 1, 2, 5), 'branches': ['sf2-memory'], 'team': ['S4-A', 'S4-B', 'S4-C'], 'read_only_after': 'Após o handoff canônico para S0-C, WP14 somente leitura até eventual nova transferência válida; provas AM01/AM06 seguem alocações próprias.'},
    'S1-A': {'primary': ids('WP01', 1, 2, 3, 4, 5), 'branches': ['sf2-ui']},
    'S1-B': {'primary': ids('WP02', 1, 2, 3, 4), 'branches': ['sf2-dashboard'], 'release_to': 'S1', 'slot_successor': 'S1-R1'},
    'S1-C': {'primary': ids('WP03', 1, 2, 3, 4, 5), 'branches': ['sf2-planner']},
    'S2-A': {'primary': ids('WP04', 1, 2, 3, 4, 5), 'branches': ['sf2-procurement']},
    'S2-B': {'primary': ids('WP05', 1, 2, 3, 4, 5), 'branches': ['sf2-analytics'], 'release_to': 'S2', 'slot_successor': 'S2-R2'},
    'S2-C': {'primary': ids('WP06', 1, 2, 3, 4), 'support': {'WP06.T05': 'Somente consumo antes do handoff canônico; manutenção/correção documental depois do recebimento do head e lease de S2.'}, 'branches': ['sf2-imports']},
    'S3-A': {'primary': ids('WP07', 1, 2, 3, 4), 'branches': ['sf2-reviews'], 'release_to': 'S3', 'slot_successor': 'S3-R3'},
    'S3-B': {'primary': ids('WP08', 1, 2, 3, 4, 5, 6), 'branches': ['sf2-collaboration']},
    'S3-C': {'primary': ids('WP09', 1, 7, 2, 3, 4, 5, 6), 'branches': ['sf2-routines']},
    'S4-A': {'primary': ids('WP11', 1, 2, 3, 4), 'branches': ['sf2-decisions']},
    'S4-B': {'primary': ids('WP12', 1, 2, 3, 4), 'branches': ['sf2-ai'], 'skill_source_rule': 'Manifest é próprio. Fontes com outro writer somente após transferência por hash/lease; ler/empacotar não transfere autoria.'},
    'S4-C': {'primary': ids('WP13', 1, 2, 3, 4), 'branches': ['sf2-portfolio']},
    'S1-R1': {'primary': ids('WP10', 3), 'review_part': 'RUN-REVIEW-UX', 'branches': ['sf2-review-ux'], 'review_wps': [f'WP{i:02}' for i in range(1, 15)]},
    'S2-R2': {'primary': ids('WP10', 3), 'review_part': 'RUN-REVIEW-INTEGRITY', 'branches': ['sf2-review-integrity'], 'review_wps': [f'WP{i:02}' for i in range(15)]},
    'S3-R3': {'primary': ids('WP10', 3), 'review_part': 'RUN-REVIEW-NATIVE', 'branches': ['sf2-review-native'], 'review_wps': ['WP00', 'WP01', 'WP03', 'WP06', 'WP08', 'WP09', 'WP10', 'WP11', 'WP12', 'WP13', 'WP14']},
}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def criteria(entity):
    result = []
    for family in FAMILIES:
        assert entity['axioms'][family], (entity['id'], family)
        result.extend((r['id'], family, r['text']) for r in entity['axioms'][family])
    result.extend((r['id'], 'check', r['text']) for r in entity.get('checks', []))
    return result


def exact_actor(actor, combined):
    return actor in str(combined or '').split('/')


def touch(row, task_ids, wp_ids):
    values = []
    for key in ('producer', 'consumer', 'producer_task', 'consumer_task', 'acceptance_task', 'owner_task', 'execution_task', 'task', 'owner'):
        if key in row:
            values.append(row[key])
    for key in ('consumers', 'producers', 'producer_tasks', 'consumer_tasks', 'owner_tasks', 'tasks'):
        values.extend(row.get(key, []))
    return bool(set(values) & (task_ids | wp_ids))


def contract_references(value):
    """Select read dependencies only; never infer write authority from prose."""
    if isinstance(value, dict):
        return set().union(*(contract_references(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(*(contract_references(v) for v in value))
    if not isinstance(value, str):
        return set()
    references = set(re.findall(r'\bC\d{2}\b', value))
    for first, last in re.findall(r'\bC(\d{2})\s*[-–—]\s*C?(\d{2})\b', value):
        assert int(first) <= int(last), ('Reversed contract range', value)
        references.update(f'C{i:02}' for i in range(int(first), int(last) + 1))
    return references


def validate_contract_selection(pack, catalog):
    selected = {row['id'] for row in pack['contracts']}
    required = contract_references(pack)
    assert required <= selected, (pack['actor'], 'Missing contract definitions', sorted(required - selected))
    assert selected <= set(catalog), (pack['actor'], 'Unknown contract definitions', sorted(selected - set(catalog)))
    assert all(row == catalog[row['id']] for row in pack['contracts']), (pack['actor'], 'Contract definition drift')
    if selected & {'C15', 'C16', 'C17'}:
        assert 'specs/resident-runtime.md' in {x['path'] for x in pack['mandatory_appendices']}, (pack['actor'], 'Missing resident runtime appendix')


def validate_dependency_selection(pack):
    handoffs = {row['id'] for row in pack['incoming_outgoing_handoffs']}
    required = {ident for row in pack['task_output_dependencies'] for key in ('requires', 'full_runtime_requires') for ident in row.get(key, [])}
    assert required <= handoffs, (pack['actor'], 'Missing phase handoffs', sorted(required - handoffs))
    skills = {row['id'] for row in pack['resident']['skills']}
    profiles = {row['id'] for row in pack['resident']['profiles']}
    proofs = {row['id'] for row in pack['execution_proofs']}
    resident_proofs = {row['id'] for row in pack['resident']['integrated_proofs']}
    for route in pack['resident']['operation_call_routes']:
        assert route['skill_id'] in skills, (pack['actor'], route['operation_id'], 'Missing route skill')
        assert route['profile_id'] in profiles, (pack['actor'], route['operation_id'], 'Missing route profile')
        assert route['proof_id'] in proofs & resident_proofs, (pack['actor'], route['operation_id'], 'Missing route proof')


def _sources(c):
    return {'provenance': 'Static receipts identify the code source that was read; not proof of implementation or live access.',
            'baseline': c['baseline'], 'receipts': c.get('source_receipts', []),
            'resident_api_receipts': c.get('resident_source_evidence', []),
            'code_policy': 'Read AGENTS and actual files/dependencies before editing. Recheck changed hashes. Never reuse authorization/model/scanner/capacity observations as immutable code facts.'}


def branch_sources(c, actor, assignment):
    """Validate explicit branches against structured ownership; never parse role prose."""
    evidence = []
    boundaries = [(i,b) for i,b in enumerate(c['ownership']['actor_boundaries']) if b['actor'] == actor]
    for i,b in boundaries:
        if b.get('branch'):
            evidence.append({'branch':b['branch'], 'source_pointer':f'/ownership/actor_boundaries/{i}/branch'})
    for i,lease in enumerate(c['ownership']['skill_leases']):
        if lease['writer'] == actor:
            evidence.append({'branch':lease['branch'], 'source_pointer':f'/ownership/skill_leases/{i}/branch'})
    for i,entry in enumerate(c['ownership'].get('technical_allocations', [])):
        if entry.get('branch') and actor in (entry.get('actor'), entry.get('writer')):
            evidence.append({'branch':entry['branch'], 'source_pointer':f'/ownership/technical_allocations/{i}/branch'})
    default_wps = {tid.split('.')[0] for tid in assignment['primary']} | set(assignment.get('correction', {}))
    for i,wp in enumerate(c['work_packages']):
        if wp['id'] in default_wps and not any(b.get('logical_owner') == wp['id'] and b.get('branch') for _,b in boundaries):
            evidence.append({'branch':wp['ownership']['branch'], 'source_pointer':f'/work_packages/{i}/ownership/branch'})
    assert set(assignment['branches']) == {e['branch'] for e in evidence}, (actor,assignment['branches'],evidence)
    return evidence


def artifacts(c):
    """Return UTF-8 artifact strings; source dict is not mutated."""
    wps = {w['id']: w for w in c['work_packages']}
    tasks = {t['id']: t for w in wps.values() for t in w['tasks']}
    assert len(wps) == 15 and len(tasks) == 74
    assert set(ACTORS) == set(c['timebox']['actor_allocations']), 'Actor roster changed: update the explicit map.'
    claims = {}
    for actor, assignment in ACTORS.items():
        branch_sources(c, actor, assignment)
        for tid in assignment['primary']:
            assert tid in tasks, tid
            claims.setdefault(tid, []).append(actor)
            expected = tasks[tid].get('execution_actor')
            if expected:
                assert exact_actor(actor, expected), (tid, actor, expected)
        assert set(assignment.get('support', {})) <= set(tasks)
        assert set(assignment.get('correction', {})) <= set(wps)
    assert set(claims) == set(tasks), sorted(set(tasks) - set(claims))
    assert {t for t, actors in claims.items() if len(actors) > 1} == {'WP10.T03'}
    assert set(claims['WP10.T03']) == {'S1-R1', 'S2-R2', 'S3-R3'}

    campaign_hash = digest(encoded(c))
    provenance = {'canonical_path': 'campaign.json', 'canonical_sha256': campaign_hash,
                  'compiler': 'render_fast_context.py', 'compiler_version': VERSION,
                  'planning_commit': 'Use the immutable planning SHA supplied at launch for every artifact; the source cannot embed its own future commit SHA.',
                  'code_baseline': c['baseline']['commit'], 'implementation_test_status': 'NOT_RUN'}
    common_sections = [
        '# Orchestra SF — regras comuns de execução',
        'Leia este documento uma vez e o pacote JSON do ator atribuído. Os pacotes são seleções exatas do canônico; não é necessário ler também todos os seus espelhos. Expanda fontes/dependências sempre que necessário para implementar ou julgar corretamente.',
        f'Fonte SHA256: `{campaign_hash}`. Compilador: `{VERSION}`. Plano e código são SHAs distintos; fixe ambos no lançamento.',
        '## Missão', c['mission'], c['product_promise'],
        '## Escopo e semântica', '```json\n' + encoded({'scope': c['scope'], 'axiom_semantics': c['axiom_semantics'], 'semantic_decisions': c['semantic_decisions']}) + '```',
        '## Regras universais', '```json\n' + encoded(c['execution']) + '```',
        '## Gates e relógio', '```json\n' + encoded({'gates':c['gates'], 'clock_start':c['timebox']['clock_start'], 'scope_policy':c['timebox']['scope_policy'], 'feasibility':c['timebox']['feasibility']}) + '```',
        '## Axiomas da campanha',
    ]
    for family in FAMILIES:
        common_sections += ['### ' + family, '\n'.join(f'- **{r["id"]}** — {r["text"]}' for r in c['axioms'][family])]
    common_sections += [
        '## Capacidade e identidade',
        'S0 é supervisora e integradora dentro de sua alocação. S1–S4 recebem identidade e jobs fixos. Não escolha uma fatia. A árvore de collaboration com quatro slots globais não se multiplica por aninhamento. O preset de vinte slots exige cinco sessões independentes realmente admitidas. O Git registra entrega e não cria sessões.',
        '## Receber, retomar e concluir',
        'A fonte é imutável por SHA; nenhum pack concede escrita além do lease. Coordenação não é trabalho simultâneo adicional. Silêncio não prova encerramento: feche ou cerque o writer anterior por capacidade realmente suportada antes de transferir. Retome pelo checkpoint/head/contratos e pelo restante, sem reiniciar descoberta concluída. READY_FOR_INTEGRATION não é DONE. Critério sem observação válida permanece NOT_RUN.',
        'O protocolo operacional completo está em [execution-workflow.json](../execution-workflow.json). O índice de jobs, hashes e critérios está em [manifest.json](manifest.json). As fontes de APIs estão em [sources.json](sources.json). Leia AGENTS da baseline e o código real de sua fronteira antes de editar.',
    ]
    out = {'execution/COMMON.md': '\n\n'.join(common_sections) + '\n',
           'execution/sources.json': encoded(_sources(c)),
           'execution-workflow.json': encoded(c.get('execution_workflow', {}))}
    common_hash = digest(out['execution/COMMON.md'])
    proof_overrides = {criterion: a for a in c.get('proof_assignments', []) for criterion in a['criterion_ids']}
    all_packages = {p['id']: p for p in c['evidence']['packages']}
    all_criteria = {row[0] for entity in [c, *wps.values(), *tasks.values()] for row in criteria(entity)}
    actor_results, assigned_criteria = [], set(row[0] for row in criteria(c))
    all_handoff_ids, all_skill_ids, all_operation_ids = set(), set(), set()

    for actor, assignment in ACTORS.items():
        task_ids = set(assignment['primary']) | set(assignment.get('support', {}))
        for wid in assignment.get('correction', {}):
            task_ids.update(t['id'] for t in wps[wid]['tasks'])
        own_wp_ids = {tid.split('.')[0] for tid in task_ids}
        read_wp_ids = own_wp_ids | set(assignment.get('review_wps', []))
        own_entities = [wps[wid] for wid in sorted(own_wp_ids)] + [tasks[tid] for tid in sorted(task_ids)]
        criterion_ids = {row[0] for entity in own_entities for row in criteria(entity)}
        assigned_criteria.update(criterion_ids)
        contract_ids = {ref for wid in read_wp_ids for ref in wps[wid]['contract_reads'] + wps[wid]['contract_provides']}
        phase_dependencies = [x for x in c['task_output_dependencies'] if touch(x, task_ids, own_wp_ids) or x.get('task') in task_ids]
        required_handoffs = {ident for row in phase_dependencies for key in ('requires', 'full_runtime_requires') for ident in row.get(key, [])}
        assert required_handoffs <= {h['id'] for h in c['output_handoffs']}, (actor, 'Unknown phase handoff')
        relevant_handoffs = [h for h in c['output_handoffs'] if h['producer_task'] in task_ids or task_ids.intersection(h['consumer_tasks']) or h['id'] in required_handoffs]
        all_handoff_ids.update(h['id'] for h in relevant_handoffs)
        relevant_skill_leases = [x for x in c['ownership']['skill_leases'] if x['writer'] == actor or x.get('handoff_to') == actor]
        resident_task_ids = task_ids - set(assignment.get('support', {})) if actor in {'S1','S3'} else task_ids
        relevant_skills = [s for s in c['resident_ai']['skills'] if touch(s, resident_task_ids, {x.split('.')[0] for x in resident_task_ids}) or s['id'] in {x['skill_id'] for x in relevant_skill_leases}]
        if actor in {'S0', 'S0-B', 'S4-B', 'S3-R3'}:
            relevant_skills = c['resident_ai']['skills']
        skill_ids = {s['id'] for s in relevant_skills}
        operation_ids = {op for s in relevant_skills for op in s['allowed_operations']}
        operation_ids.update(op['id'] for p in c['resident_ai']['mcp_packs'] for op in p['operations'] if op['producer_task'] in task_ids)
        # Route bindings are required read context even for a domain producer
        # that does not own the resident skill or execute the integrated proof.
        while True:
            routes = [r for r in c['resident_ai']['operation_call_routes'] if r['operation_id'] in operation_ids]
            referenced_skills = {r['skill_id'] for r in routes}
            expanded_skills = skill_ids | referenced_skills
            if expanded_skills == skill_ids:
                break
            assert expanded_skills <= {s['id'] for s in c['resident_ai']['skills']}, (actor, 'Unknown route skill')
            skill_ids = expanded_skills
            relevant_skills = [s for s in c['resident_ai']['skills'] if s['id'] in skill_ids]
            operation_ids.update(op for s in relevant_skills for op in s['allowed_operations'])
        all_skill_ids.update(skill_ids)
        packs = []
        for pack in c['resident_ai']['mcp_packs']:
            operations = [op for op in pack['operations'] if op['id'] in operation_ids or op['producer_task'] in task_ids]
            if operations:
                packs.append({**{k:v for k,v in pack.items() if k != 'operations'}, 'operations': operations})
                operation_ids.update(op['id'] for op in operations)
        all_operation_ids.update(operation_ids)
        profile_ids = {p for s in relevant_skills for p in s['profiles']}
        profile_ids.update(p for pack in packs for op in pack['operations'] for p in op['profiles'])
        evidence_ids = {e for entity in own_entities for e in entity.get('evidence_packages', [])}
        bindings = []
        for entity in own_entities:
            for cid, family, expected in criteria(entity):
                override = proof_overrides.get(cid)
                packages = override['proof_packages'] if override else entity.get('evidence_packages') or list(all_packages)
                evidence_ids.update(packages)
                binding = {'criterion_id': cid, 'entity_id': entity['id'], 'family': family, 'proof_packages': packages, 'status': 'NOT_RUN'}
                if override:
                    binding['integrated_proofs'] = override['integrated_proofs']
                bindings.append(binding)
        integrated_ids = {p for b in bindings for p in b.get('integrated_proofs', [])}
        integrated_ids.update(p['id'] for p in c['execution_proofs'] if exact_actor(actor, p.get('execution_actor')) or p.get('reviewer') == actor or touch(p, task_ids, own_wp_ids))
        integrated_ids.update(p for s in relevant_skills for p in s.get('proof_ids', []))
        integrated_ids.update(r['proof_id'] for r in routes)
        integrated_ids.update(ident for pack in packs for ident in pack.get('proof_ids', []))
        evidence_ids.update(ident for proof in c['execution_proofs'] if proof['id'] in integrated_ids for ident in proof['proof_packages'])
        evidence_ids.update(ident for proof in c['resident_ai']['integrated_proofs'] if proof['id'] in integrated_ids for ident in proof['evidence_packages'])
        dependency_ids = {d for tid in task_ids for key in ('depends_on', 'integrates_with') for d in tasks[tid].get(key, []) if d in tasks and d not in task_ids}
        dependency_ids.update(h['producer_task'] for h in relevant_handoffs if h['id'] in required_handoffs and h['producer_task'] not in task_ids)
        boundaries = [b for b in c['ownership']['actor_boundaries'] if b['actor'] == actor or b.get('transfer_to') == actor]
        other_boundaries = [b for b in c['ownership']['actor_boundaries'] if b['actor'] != actor and b.get('logical_owner') in own_wp_ids]
        wp_sections = [{**{k:v for k,v in wps[wid].items() if k != 'tasks'},
                        'tasks': [t for t in wps[wid]['tasks'] if t['id'] in task_ids]} for wid in sorted(own_wp_ids)]
        annexes = ['specs/product-acceptance.md']
        if contract_ids & {'C15', 'C16', 'C17'}:
            annexes.append('specs/resident-runtime.md')
        if actor in {'S0','S0-A','S0-C','S2','S2-C','S4','S4-B','S2-R2','S3-R3'}:
            annexes.append('specs/atlas-packaging.md')
        if actor in c['timebox']['sessions'] or 'review_part' in assignment:
            annexes.append('specs/execution-reconciliation.md')
        source_paths = sorted({'AGENTS.md'} | {f for wid in own_wp_ids for f in wps[wid]['ownership'].get('existing_files', [])})
        source_links = [{'path': path, 'url': f'https://github.com/{c["repository"]}/blob/{c["baseline"]["commit"]}/{path}',
                         'rule': 'Read the actual file; lookup missing local instructions on its path before editing.'} for path in source_paths]
        resident = {k: c['resident_ai'][k] for k in ['schema_version','server_name','profile_name','engine_baseline','skill_bundle_policy','operation_coverage_rule']}
        resident.update(profiles=[p for p in c['resident_ai']['profiles'] if p['id'] in profile_ids], skills=relevant_skills, mcp_packs=packs,
                        operation_call_routes=routes,
                        output_aliases=c['resident_ai']['output_aliases'],
                        integrated_proofs=[p for p in c['resident_ai']['integrated_proofs'] if p['id'] in integrated_ids])
        actor_pack = {
            'provenance': provenance, 'job_id': f'{c["id"]}/{actor}', 'actor': actor, 'session': actor.split('-')[0],
            'assignment': assignment, 'branch_provenance': branch_sources(c,actor,assignment), 'common': {'path':'execution/COMMON.md','sha256':common_hash},
            'write_authority': {'rule': 'Only explicit primary/support/correction part and current actor/skill lease. WP ownership below is context, never a blanket actor grant. Reviewer writes only its review receipts.',
                                'actor_boundaries': boundaries, 'skill_leases': relevant_skill_leases, 'other_writers_in_same_wps': other_boundaries,
                                'resolution_order': c['ownership']['resolution_order'], 'excluded_prefixes': c['ownership']['excluded_prefixes'],
                                'exact_exceptions': [x for x in c['ownership']['exact_exceptions'] if x['owner'] in own_wp_ids]},
            'allocation': c['timebox']['actor_allocations'][actor],
            'physical_slot': [x for x in c['timebox']['slot_lifecycle'] if any(o['actor']==actor for o in x['occupants'])],
            'work_packages': wp_sections,
            'contracts': [x for x in c['contracts'] if x['id'] in contract_ids],
            'incoming_outgoing_handoffs': relevant_handoffs,
            'task_output_dependencies': phase_dependencies,
            'consumer_edges': [x for x in c['consumption_map'] if touch(x, task_ids, own_wp_ids)],
            'coverage': {k:[row for row in rows if not isinstance(row,dict) or touch(row, task_ids, own_wp_ids)] for k,rows in c['coverage'].items()},
            'dependency_context': [{k:tasks[tid][k] for k in ['id','title','inputs','outputs','build_window','depends_on','integrates_with'] if k in tasks[tid]} for tid in sorted(dependency_ids)],
            'proof_bindings': bindings,
            'evidence': {**{k:v for k,v in c['evidence'].items() if k not in ('packages','judge_assignments')}, 'packages':[all_packages[e] for e in sorted(evidence_ids)]},
            'execution_proofs': [p for p in c['execution_proofs'] if p['id'] in integrated_ids],
            'review_assignment': [r for r in c['review_assignments'] if r['actor']==actor],
            'review_sources_read_only': [{'wp':wid,'path':f'work-packages/{wid}.json','criterion_ids':[r[0] for e in [wps[wid],*wps[wid]['tasks']] for r in criteria(e)]} for wid in assignment.get('review_wps', [])],
            'resident': resident,
            'reference_context_rule': 'Contract, route, skill and proof definitions are read dependencies. They do not transfer task ownership, write permission or proof execution. Execute only assigned primary/support/correction parts and current leases; the canonical execution_actor retains each integrated proof.',
            'resident_handoff_interfaces': [h for h in c.get('resident_handoff_interfaces', []) if touch(h,task_ids,own_wp_ids)],
            'resident_gate_requirements': c.get('resident_gate_requirements', {}),
            'resident_ui': {**{k:v for k,v in c['resident_ui_consumption'].items() if k not in ('profiles','skills')},
                            'profiles':[p for p in c['resident_ui_consumption']['profiles'] if p.get('profile_id',p.get('id')) in profile_ids],
                            'skills':[s for s in c['resident_ui_consumption']['skills'] if s.get('skill_id',s.get('id')) in skill_ids]},
            'mandatory_appendices': [{'path':name,'rule':'Read the portions applying to assigned outputs and their dependencies; headings or links never waive a requirement.'} for name in annexes],
            'code_sources': source_links,
            'source_receipt_index': 'execution/sources.json',
            'workflow': 'execution-workflow.json',
            'coverage_source': 'coverage.json',
            'numeric_oracles': c['numeric_oracles'],
            'selection_pointers': [f'/work_packages/{list(wps).index(wid)}' for wid in sorted(own_wp_ids)] + ['/execution','/ownership','/proof_assignments','/resident_ai','/resident_ui_consumption'],
            'criterion_ids': sorted(criterion_ids),
            'completion': 'All assigned primary outcomes, explicit support/correction parts, consumers and proofs must be delivered. No early DONE on a commit or a green unrelated check. Full task acceptance belongs to the owner plus all required contributors. Product proof status remains NOT_RUN until observed.'
        }
        if actor in {'S0','S0-C','S2','S1-R1','S2-R2','S3-R3'}:
            actor_pack['ci_plan'] = c['ci_plan']
        # WP summary lists alone omit dependencies stated in selected tasks,
        # criteria, handoffs and proofs. Preserve their complete read closure.
        catalog = {row['id']: row for row in c['contracts']}
        required_contracts = contract_ids | contract_references(actor_pack)
        while True:
            assert required_contracts <= set(catalog), (actor, 'Unknown contract references', sorted(required_contracts - set(catalog)))
            expanded = required_contracts | contract_references([catalog[ident] for ident in sorted(required_contracts)])
            if expanded == required_contracts:
                break
            required_contracts = expanded
        actor_pack['contracts'] = [row for row in c['contracts'] if row['id'] in required_contracts]
        if required_contracts & {'C15', 'C16', 'C17'} and 'specs/resident-runtime.md' not in annexes:
            actor_pack['mandatory_appendices'].append({'path': 'specs/resident-runtime.md', 'rule': 'Read the portions applying to assigned outputs and their dependencies; headings or links never waive a requirement.'})
        if 'C17' in required_contracts and actor in {'S0','S0-A','S0-C','S4','S4-B','S2-R2','S3-R3'}:
            actor_pack['resident_packaging'] = c['resident_packaging']
        validate_contract_selection(actor_pack, catalog)
        validate_dependency_selection(actor_pack)
        path = f'execution/actors/{actor}.json'
        out[path] = encoded(actor_pack)
        actor_results.append({'actor':actor,'job_id':actor_pack['job_id'],'path':path,'sha256':digest(out[path]),'bytes':len(out[path].encode()),
                              'primary_tasks':assignment['primary'],'support_tasks':list(assignment.get('support',{})),
                              'correction_wps':list(assignment.get('correction',{})), 'criteria':len(criterion_ids)})
        role = 'revisor independente' if 'review_part' in assignment else 'supervisora' if actor=='S0' else 'coordenadora' if actor in c['timebox']['sessions'] else 'builder'
        team = assignment.get('team', [])
        startup = f'Você é **{actor}**, {role}, job `{actor_pack["job_id"]}`. Sua identidade já está atribuída. Não escolha outra fatia.'
        if actor == 'S0':
            startup += ' Confira primeiro capacidades e limites do host; lance ou reconheça S1–S4 com seus prompts fixos; recolha ACKs e o roster observado; só então admita o preset e libere a escrita. Não invente sessões nem capacidade.'
        if team:
            startup += ' Seus builders atribuídos são ' + ', '.join(team) + '; use somente slots realmente admitidos.'
        if 'review_part' in assignment:
            startup += ' Comece somente após liberação real do slot. Não escreva produto, não reutilize a sessão de um autor e não leia conclusões de outros juízes antes de emitir a sua.'
        out[f'execution/actors/{actor}.md'] = '\n\n'.join([
            f'# Orchestra SF — {actor}', startup,
            f'Leia [COMMON](../COMMON.md) e [seu pacote completo]({actor}.json), no mesmo SHA de planejamento. Digest do pacote: `{digest(out[path])}`. Leia AGENTS e código real da sua fronteira. Não repita a leitura integral da campanha e dos quinze espelhos.',
            '**Tasks primárias:** ' + (', '.join(assignment['primary']) or 'as atribuições de coordenação, suporte e correção do pacote') + '.',
            '**Branches:** ' + ', '.join('`'+b+'`' for b in assignment['branches']) + '. Os leases/partes do pacote delimitam a escrita; a lista não permite concorrência sobre os mesmos arquivos.',
            'Publique incrementos consumíveis e checkpoint com head, contrato, lease/geração, outputs, provas, bloqueio e próximo passo. Consuma dependências pelo SHA recebido, sem reinterpretar contratos ou recriar produtores.',
            'Retome pelo checkpoint e pelo trabalho remanescente. Silêncio não autoriza takeover. Finalize somente com integração, consumidores e provas válidas; o relógio de 120 minutos não reduz escopo ou aceite.',
        ]) + '\n'

    assert assigned_criteria == all_criteria, ('Criteria missing', sorted(all_criteria-assigned_criteria))
    assert all_handoff_ids == {h['id'] for h in c['output_handoffs']}
    assert all_skill_ids == {s['id'] for s in c['resident_ai']['skills']}
    assert all_operation_ids == {o['id'] for p in c['resident_ai']['mcp_packs'] for o in p['operations']}
    out['execution/manifest.json'] = encoded({
        'provenance': provenance, 'common_sha256':common_hash, 'actors':actor_results,
        'coverage':{'work_packages':len(wps),'tasks':len(tasks),'actors':len(ACTORS),'criteria':len(all_criteria),'handoffs':len(all_handoff_ids),'skills':len(all_skill_ids),'operations':len(all_operation_ids)},
        'task_primary_actors':claims,
        'delegation_rule':'Primary actors are explicit; WP10.T03 has three disjoint review parts. Support, transferred corrections and skill files are limited by explicit actor/path/time leases.',
        'counts_are_not_proof':'Coverage validates document selection only; no product code, runtime, authority or 120-minute duration is proven.',
        'pack_bytes_total':sum(x['bytes'] for x in actor_results),
        'pack_bytes_min':min(x['bytes'] for x in actor_results),
        'pack_bytes_max':max(x['bytes'] for x in actor_results),
    })
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    results = artifacts(json.loads(args.plan.read_text()))
    root = args.out or args.plan.parent
    drift = []
    for name, text in results.items():
        path = root/name
        if not path.exists() or path.read_text()!=text:
            drift.append(name)
            if not args.check:
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(text)
    manifest=json.loads(results['execution/manifest.json'])
    print(encoded({'artifacts':len(results),'coverage':manifest['coverage'],'pack_bytes_min':manifest['pack_bytes_min'],'pack_bytes_max':manifest['pack_bytes_max'],'pack_bytes_total':manifest['pack_bytes_total'],'drift':drift if args.check else None}))
    return 1 if args.check and drift else 0


if __name__ == '__main__':
    raise SystemExit(main())
