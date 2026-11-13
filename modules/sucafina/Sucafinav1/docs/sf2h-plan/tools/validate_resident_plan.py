"""Structural checks for the resident-agent addendum and cross-artifact coverage."""
import re


PROFILES = {'sf_maestro', 'sf_finance', 'sf_procurement', 'sf_portfolio', 'sf_reviewer'}
SKILLS = {
    'sf-enquadrar-decisao', 'sf-preparar-revisao-executiva', 'sf-coordenar-perguntas',
    'sf-explicar-forecast', 'sf-comparar-cenarios', 'sf-avaliar-sensibilidade',
    'sf-comparar-sourcing', 'sf-revisar-condicoes-contratuais', 'sf-preparar-compra',
    'sf-revisar-dependencias', 'sf-compor-portfolio', 'sf-reavaliar-compromissos',
    'sf-contestar-decisao', 'sf-revisar-evidencias', 'sf-extrair-evidencias',
    'sf-produzir-bi-contextual', 'sf-produzir-material-reuniao', 'sf-consultar-memoria-decisoria',
}


def validate_resident(plan, require, tasks, contract_ids, evidence_ids):
    resident = plan.get('resident_ai', {})
    require(bool(resident), 'MISSING_RESIDENT_MANIFEST', 'resident_ai', 'The full resident-agent addendum must be canonical')
    profiles = resident.get('profiles', [])
    skills = resident.get('skills', [])
    packs = resident.get('mcp_packs', [])
    proofs = resident.get('integrated_proofs', [])
    for items, count, label in [(profiles, 5, 'profiles'), (skills, 18, 'skills'), (packs, 8, 'mcp_packs'), (proofs, 6, 'integrated_proofs')]:
        require(isinstance(items, list) and len(items) == count, 'RESIDENT_COUNT', label, f'Expected {count} items')
        ids = [item.get('id') for item in items]
        require(all(isinstance(ident, str) and ident for ident in ids) and len(ids) == len(set(ids)), 'RESIDENT_ID', label, 'IDs must be nonempty and unique')
    profile_map = {item['id']: item for item in profiles}
    skill_map = {item['id']: item for item in skills}
    pack_map = {item['id']: item for item in packs}
    proof_map = {item['id']: item for item in proofs}
    require(set(profile_map) == PROFILES, 'RESIDENT_PROFILE_COVERAGE', 'resident_ai.profiles', 'All five accepted profile IDs must remain')
    require(set(skill_map) == SKILLS, 'RESIDENT_SKILL_COVERAGE', 'resident_ai.skills', 'All eighteen accepted skills must remain')
    operations = [operation for pack in packs for operation in pack.get('operations', [])]
    operation_map = {item['id']: item for item in operations}
    require(len(operations) == len(operation_map) == 39, 'MCP_OPERATION_COVERAGE', 'resident_ai.mcp_packs', 'Expected 39 unique operations across eight packs')
    for operation in operations:
        reachable = [(profile['id'], skill['id']) for profile in profiles for skill in skills
                     if profile['id'] in operation.get('profiles', [])
                     and profile['id'] in skill.get('profiles', [])
                     and skill['id'] in profile.get('allowed_skills', [])
                     and operation['id'] in profile.get('allowed_operations', [])
                     and operation['id'] in skill.get('allowed_operations', [])]
        require(bool(reachable), 'MCP_UNREACHABLE_OPERATION', operation['id'],
                'Every advertised operation needs at least one positive profile/loaded-skill authority path')
    routes = resident.get('operation_call_routes', [])
    require(len(routes) == len(operation_map) and {row['operation_id'] for row in routes} == set(operation_map),
            'MCP_CALL_ROUTE_COVERAGE', 'resident_ai.operation_call_routes', 'One named positive route per operation')
    for route in routes:
        operation = operation_map.get(route['operation_id'], {})
        profile = profile_map.get(route['profile_id'], {})
        skill = skill_map.get(route['skill_id'], {})
        require(bool(operation) and bool(profile) and bool(skill)
                and profile.get('id') in operation.get('profiles', [])
                and profile.get('id') in skill.get('profiles', [])
                and skill.get('id') in profile.get('allowed_skills', [])
                and operation.get('id') in profile.get('allowed_operations', [])
                and operation.get('id') in skill.get('allowed_operations', []),
                'MCP_CALL_ROUTE_GRANT', route['operation_id'], 'Named profile/skill must actually grant this operation')
        require(route.get('requires_loaded_skill_receipt') is True and route.get('proof_id') == 'AM02',
                'MCP_CALL_ROUTE_AUTHORITY', route['operation_id'], 'Direct proof calls cannot bypass the loaded skill')
        require(route.get('producer_task') == operation.get('producer_task')
                and route.get('input_schema') == operation.get('input_type')
                and route.get('output_type') == operation.get('output_type')
                and set(route.get('consumer_tasks', [])) <= set(skill.get('consumer_tasks', [])),
                'MCP_CALL_ROUTE_CONSUMPTION', route['operation_id'], 'Route must use the real producer, schema and consumer')
        require(route.get('requires_current_c07_admission') is (operation.get('mode') == 'execute_admitted'),
                'MCP_CALL_ROUTE_ADMISSION', route['operation_id'], 'Executable routine route must retain C07 admission')

    def known(values, valid, location, required=True):
        require(isinstance(values, list), 'RESIDENT_REF_SHAPE', location, 'Expected a list of IDs')
        if not isinstance(values, list):
            return
        require(not required or bool(values), 'RESIDENT_EMPTY_REF', location, 'At least one reference is required')
        require(len(values) == len(set(values)), 'RESIDENT_DUPLICATE_REF', location, 'References must be unique')
        for value in values:
            require(value in valid, 'RESIDENT_DANGLING_REF', location, f'Unknown reference {value}')

    def text(item, names):
        for name in names:
            require(bool(item.get(name)), 'RESIDENT_EMPTY_FIELD', item['id'] + '.' + name, 'Required specification cannot be empty')

    assignments = plan['ownership']['work_packages']
    exceptions = {entry['path']: entry['owner'] for entry in plan['ownership'].get('exact_exceptions', [])}

    def path_owner(path, location):
        require(isinstance(path, str) and not path.startswith('/') and '..' not in path.split('/'), 'RESIDENT_PATH', location, 'Path must be repository-relative')
        if path in exceptions:
            return exceptions[path]
        owners = {entry['id'] for entry in assignments
                  if path in entry.get('existing_files', []) + entry.get('new_files', [])
                  or any(path.startswith(prefix) for prefix in entry.get('new_prefixes', []))}
        require(len(owners) == 1, 'RESIDENT_PATH_WRITER', location, f'Expected one writer for {path}, found {sorted(owners)}')
        return next(iter(owners), None)

    def common(item, with_source=False):
        require(item.get('owner_task') in tasks, 'RESIDENT_OWNER_TASK', item['id'], 'A canonical owner task is required')
        known(item.get('evidence_packages', []), evidence_ids, item['id'] + '.evidence_packages')
        known(item.get('proof_ids', []), proof_map, item['id'] + '.proof_ids')
        if with_source:
            text(item, ['version', 'source_path'])
            owner = path_owner(item.get('source_path', ''), item['id'] + '.source_path')
            if item.get('owner_task') in tasks:
                require(owner == tasks[item['owner_task']]['owner'], 'RESIDENT_SOURCE_OWNER', item['id'], 'Shipped source belongs to its declared owner task')

    for profile in profiles:
        common(profile, True)
        text(profile, ['mission', 'output_types', 'model_class', 'resume_policy'])
        require(profile.get('registration_task') in tasks, 'RESIDENT_REGISTRATION_TASK', profile['id'], 'Profile registration needs a concrete task')
        known(profile.get('allowed_skills', []), skill_map, profile['id'] + '.allowed_skills')
        known(profile.get('allowed_operations', []), operation_map, profile['id'] + '.allowed_operations')
        for field in ['context_budget_tokens', 'max_steps', 'max_delegations']:
            require(isinstance(profile.get(field), int) and profile[field] >= 0, 'RESIDENT_BUDGET', profile['id'] + '.' + field, 'Explicit nonnegative execution limit required')
        for skill_id in profile.get('allowed_skills', []):
            if skill_id in skill_map:
                require(profile['id'] in skill_map[skill_id].get('profiles', []), 'PROFILE_SKILL_ASYMMETRY', profile['id'], f'{skill_id} does not admit this profile')

    for skill in skills:
        common(skill, True)
        text(skill, ['input_type', 'output_types', 'workflow', 'limits', 'positive_acceptance', 'negative_acceptance', 'states', 'ui_entry', 'receipt_required_fields'])
        known(skill.get('profiles', []), profile_map, skill['id'] + '.profiles')
        known(skill.get('allowed_operations', []), operation_map, skill['id'] + '.allowed_operations')
        known(skill.get('producer_tasks', []), tasks, skill['id'] + '.producer_tasks')
        known(skill.get('consumer_tasks', []), tasks, skill['id'] + '.consumer_tasks')
        digest = skill.get('digest', {})
        require(digest.get('algorithm') == 'sha256' and all(digest.get(flag) is True for flag in ['build_required', 'source_bytes', 'injected_content']), 'SKILL_LOAD_PROOF', skill['id'], 'Build must verify both source and injected content digests')
        require(skill.get('source_path', '').endswith('/SKILL.md'), 'SKILL_SOURCE_PATH', skill['id'], 'Skill content needs a shipped SKILL.md path')
        for profile_id in skill.get('profiles', []):
            if profile_id not in profile_map:
                continue
            profile = profile_map[profile_id]
            require(skill['id'] in profile['allowed_skills'], 'PROFILE_SKILL_ASYMMETRY', skill['id'], f'{profile_id} does not allow this skill')
            require(set(skill['allowed_operations']) <= set(profile['allowed_operations']), 'SKILL_OPERATION_ESCALATION', skill['id'], f'Tools exceed permissions of {profile_id}')
        covered = [proof_map[proof_id] for proof_id in skill['proof_ids'] if proof_id in proof_map]
        require(any(skill['id'] in proof.get('skills', []) for proof in covered), 'SKILL_PROOF_COVERAGE', skill['id'], 'At least one integrated proof must explicitly exercise the skill')

    for pack in packs:
        common(pack)
        known(pack.get('consumer_tasks', []), tasks, pack['id'] + '.consumer_tasks')
        require(bool(pack.get('operations')), 'MCP_EMPTY_PACK', pack['id'], 'A pack must expose domain operations')
        for operation in pack.get('operations', []):
            require(operation.get('producer_task') in tasks, 'MCP_PRODUCER_TASK', operation['id'], 'The real domain producer must be a task')
            known(operation.get('contracts', []), contract_ids, operation['id'] + '.contracts')
            known(operation.get('profiles', []), profile_map, operation['id'] + '.profiles')
            text(operation, ['mode', 'handler_path', 'handler_export', 'input_type', 'output_type'])
            path_owner(operation.get('handler_path', ''), operation['id'] + '.handler_path')
        covered = [proof_map[proof_id] for proof_id in pack['proof_ids'] if proof_id in proof_map]
        require(any(pack['id'] in proof.get('packs', []) for proof in covered), 'PACK_PROOF_COVERAGE', pack['id'], 'Each pack needs an integrated proof')

    for proof in proofs:
        text(proof, ['title', 'required_receipt_fields', 'positive_checks', 'negative_checks'])
        require(proof.get('owner_task') in tasks, 'INTEGRATED_PROOF_OWNER', proof['id'], 'Integrated proof owner must be a task')
        for key, valid in [('producer_tasks', tasks), ('consumer_tasks', tasks), ('evidence_packages', evidence_ids), ('profiles', profile_map), ('skills', skill_map), ('packs', pack_map)]:
            known(proof.get(key, []), valid, proof['id'] + '.' + key, required=key != 'skills')
        require(proof.get('status') == 'NOT_RUN', 'PLAN_ASSERTS_EXECUTION', proof['id'], 'Plan must not claim a product proof was executed')
    for profile in profiles:
        require(any(profile['id'] in proof.get('profiles', []) for proof in proofs), 'PROFILE_PROOF_COVERAGE', profile['id'], 'Every resident must contribute to a proof')

    ui_skills = {item['id']: item for item in plan.get('resident_ui_consumption', {}).get('skills', [])}
    require(set(ui_skills) == SKILLS, 'RESIDENT_UI_COVERAGE', 'resident_ui_consumption', 'Every skill needs a real product consumer scenario')
    for skill_id in set(ui_skills) & set(skill_map):
        ui, skill = ui_skills[skill_id], skill_map[skill_id]
        for ui_field, runtime_field in [('allowed_profiles', 'profiles'), ('authorized_operations', 'allowed_operations'), ('output_types', 'output_types'), ('consumer_tasks', 'consumer_tasks')]:
            require(set(ui[ui_field]) == set(skill[runtime_field]), 'RESIDENT_UI_CONTRACT_DRIFT', skill_id + '.' + ui_field, 'UI and runtime must share profile, operation, output and consumer contracts')
        require(set(ui.get('required_operations', [])) <= set(skill['allowed_operations']), 'RESIDENT_UI_OPERATION_ESCALATION', skill_id, 'Scenario operations must fit the canonical skill grant')
        text(ui, ['visible_consumption', 'missing_or_failure', 'stale_or_access_change', 'negative_discriminator'])

    required_task_ids = {'WP10.T06', 'WP10.T07', 'WP14.T05'}
    require(required_task_ids <= set(tasks), 'RESIDENT_BUILD_DECOMPOSITION', 'tasks', 'Runtime/MCP, Atlas persistence and Atlas projection require their new explicit tasks')
    packaging = plan['resident_packaging']
    c17 = next(contract for contract in plan['contracts'] if contract['id'] == 'C17')
    exports = {entry['path']: entry.get('exports', []) for entry in c17['exports']}
    scanner_names = {'runScanner', 'detectAvailableScanner', 'KNOWN_SCANNERS', 'NO_SCANNER_NAME'}
    require(not scanner_names.intersection(exports.get(packaging['entry'], [])),
            'ATLAS_SCANNER_IN_NEW_BUNDLE', 'C17.exports', 'Scanner exports must stay in the existing native-memory subpath')
    require(scanner_names <= set(exports.get(packaging['scanner_entry'], []))
            and not {'createMemoryEmit', 'createMemoryRead', 'createDurableMemory'}.intersection(exports.get(packaging['scanner_entry'], [])),
            'ATLAS_NATIVE_BOUND_EXPORTS', 'C17.exports', 'Add scanner exports while preserving the bound memory surface')
    edges = packaging.get('external_edges', [])
    require(len(edges) == 1 and edges[0].get('bundle') == 'business-memory-ports'
            and edges[0].get('importer') == 'modules/atlas/packages/adapter-io/src/memory-emit.ts'
            and edges[0].get('specifier') == './scanner.js'
            and edges[0].get('replacement') == '@orchestra/atlas-boundary/native-memory'
            and edges[0].get('external') is True,
            'ATLAS_SCANNER_EXTERNAL_EDGE', 'resident_packaging.external_edges',
            'The real transitive scanner dependency needs its exact public-module resolution')
    atlas_paths = packaging.get('exact_atlas_paths', [])
    require(len(atlas_paths) == len(set(atlas_paths)) == 9, 'ATLAS_PACKAGING_PATH_COUNT',
            'resident_packaging.exact_atlas_paths', 'Nine exact Atlas paths, including both generated pairs')
    actor = next(row for row in plan['ownership']['actor_boundaries'] if row.get('actor') == 'S0-A' and row.get('task') == 'WP10.T07')
    actor_paths = set(actor.get('existing_files', []) + actor.get('new_files', []))
    require(set(atlas_paths) <= actor_paths and all(path_owner(path, 'resident_packaging') == 'WP10' for path in atlas_paths),
            'ATLAS_PACKAGING_WRITER', 'ownership', 'All exact Atlas files need the same S0-A/WP10.T07 writer')
    require(any(gate.get('command') == 'bun run check:spawn-imports' for gate in plan['ci_plan']['static_gates']),
            'ATLAS_SPAWN_GATE', 'ci_plan.static_gates', 'The actual repository spawn-import gate must remain required')
    return {'profiles': len(profiles), 'skills': len(skills), 'mcp_packs': len(packs), 'mcp_operations': len(operations), 'integrated_proofs': len(proofs)}


def validate_product_oracles(plan, require):
    oracles = {item['id']: item for item in plan['numeric_oracles']}
    required = {'AI-RENEWAL', 'AI-RENEWAL-OMITTED-CATEGORY', 'CONFIRM-SCOPE'}
    require(required <= set(oracles), 'MISSING_PRODUCT_ORACLE', 'numeric_oracles', 'Both cost coverage branches and confirmation scope must be explicit')
    if not required <= set(oracles):
        return
    base, omitted = oracles['AI-RENEWAL'], oracles['AI-RENEWAL-OMITTED-CATEGORY']
    values = base['inputs']
    known = values['bridge'] + values['implementation'] + values['new_solution']
    require(base['expected']['transition'] == known and base['expected']['advantage'] == values['renewal'] - known, 'ORACLE_ARITHMETIC', base['id'], 'Expected sum and difference must match the synthetic input values')
    require(base['expected']['implementation_ceiling'] == values['renewal'] - values['minimum_advantage'] - values['bridge'] - values['new_solution'], 'ORACLE_THRESHOLD', base['id'], 'The declared implementation ceiling must reconcile')
    basis = set(base['coverage_fixture']['basis']['categoryIds'])
    for alternative in ['renewal', 'transition']:
        data = base['coverage_fixture'][alternative]
        entries = data['entries']
        require(len(entries) == len(basis) and {entry['categoryId'] for entry in entries} == basis, 'COST_COVERAGE_FIXTURE', alternative, 'A complete comparison explicitly covers every declared cost category once')
        components = {item['id'] for item in data['components']}
        for entry in entries:
            if entry['state'] == 'included':
                require(bool(entry.get('componentRefs')) and set(entry['componentRefs']) <= components, 'COST_COMPONENT_REF', entry['categoryId'], 'Included categories need existing component identities')
            if entry['state'] == 'not-applicable':
                require(bool(entry.get('justification')) and bool(entry.get('evidenceRefs')), 'COST_APPLICABILITY_REF', entry['categoryId'], 'Inapplicability needs justification and evidence')
    omitted_entries = {entry['categoryId'] for entry in omitted['inputs']['transition']['entries']}
    missing = set(omitted['inputs']['basis']['categoryIds']) - omitted_entries
    require(missing == {'training'} == set(omitted['expected']['derivedMissingCategoryIds']), 'OMITTED_CATEGORY_CONTROL', omitted['id'], 'Training must be wholly absent and detected as missing')
    require(omitted['expected']['total'] is None and omitted['expected']['comparisonStatus'] == 'conditioned', 'INCOMPLETE_COMPARISON', omitted['id'], 'Missing cost cannot become a complete total')
    added = omitted['resolution']['component']['amount']
    require(omitted['resolved_expected']['total'] == known + added and omitted['resolved_expected']['completeDifference'] == values['renewal'] - known - added, 'RESOLVED_COST_ARITHMETIC', omitted['id'], 'The later training quote must reconcile and reverse the stated cost difference')
    require(omitted['resolved_expected']['implementation_ceiling'] == base['expected']['implementation_ceiling'] - added, 'RESOLVED_COST_THRESHOLD', omitted['id'], 'The same minimum advantage must be used after the additional quote')
    branches = {item['id']: item for item in oracles['CONFIRM-SCOPE']['branches']}
    require({'FEB_ONLY', 'JAN_MATERIAL', 'RACE_MATERIAL', 'RACE_IRRELEVANT', 'ACCESS_REVOKED', 'REPLACED'} <= set(branches), 'CONFIRMATION_BRANCH_COVERAGE', 'CONFIRM-SCOPE', 'Material, irrelevant, concurrent, revoked and replaced sources need distinct expectations')
    if 'FEB_ONLY' in branches and 'JAN_MATERIAL' in branches:
        require(branches['FEB_ONLY']['expected']['state'] == 'valid' and branches['FEB_ONLY']['expected']['newReviewRequests'] == 0 and branches['JAN_MATERIAL']['expected']['state'] == 'stale', 'CONFIRMATION_SCOPE_CONTRAST', 'CONFIRM-SCOPE', 'Irrelevant and material edits cannot share invalidation behavior')
