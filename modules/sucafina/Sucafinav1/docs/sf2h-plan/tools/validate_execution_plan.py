"""Check declared capacity, output timing and evidence assignments; not estimates."""
from collections import Counter


def validate_execution(plan, require, tasks, definitions, evidence_ids):
    workflow = plan.get('execution_workflow', {})
    if workflow:
        topology = workflow.get('topology', {})
        protocol = workflow.get('event_protocol', {})
        require(topology.get('event_idempotency_key') == ['execution_instance', 'event_id'],
                'EVENT_IDENTITY_DRIFT', 'execution_workflow.topology.event_idempotency_key',
                'Events are deduplicated by execution instance and event ID, never by lane or candidate SHA')
        require(topology.get('events') == protocol.get('events') and bool(protocol.get('events')),
                'EVENT_ROSTER_DRIFT', 'execution_workflow.topology.events',
                'Topology and canonical event protocol must list the same events')
    timebox = plan['timebox']
    slots = timebox['slot_lifecycle']
    by_session = Counter(slot['session'] for slot in slots)
    require(len(slots) == 20 and len({slot['slot'] for slot in slots}) == 20,
            'PHYSICAL_SLOT_COUNT', 'timebox.slot_lifecycle', 'Exactly twenty distinct physical slots')
    require(set(by_session) == {'S0', 'S1', 'S2', 'S3', 'S4'} and all(n == 4 for n in by_session.values()),
            'SESSION_CAPACITY', 'timebox.slot_lifecycle', 'Five sessions with four slots including the coordinator')
    lifetimes = {}
    for slot in slots:
        end = 0
        for occupant in sorted(slot['occupants'], key=lambda row: row['window']):
            actor, (start, stop) = occupant['actor'], occupant['window']
            require(0 <= end <= start < stop <= 120, 'SLOT_OVERLAP', slot['slot'], str(occupant))
            require(actor not in lifetimes, 'ACTOR_MULTIPLE_SLOTS', actor, 'An actor may occupy one physical slot only')
            lifetimes[actor] = (start, stop, slot['slot'])
            end = stop
    allocations = timebox['actor_allocations']
    require(set(allocations) == set(lifetimes), 'ACTOR_ALLOCATION_COVERAGE', 'timebox.actor_allocations',
            'Every actor lifetime needs its own allocation and vice versa')
    for actor, rows in allocations.items():
        if actor not in lifetimes:
            continue
        low, high, _ = lifetimes[actor]
        end = low
        for row in sorted(rows, key=lambda item: item['window']):
            start, stop = row['window']
            require(low <= end <= start < stop <= high, 'ACTOR_OVERLAP', actor, str(row))
            end = stop
    handoffs = {row['id']: row for row in plan['output_handoffs']}
    require(len(handoffs) == len(plan['output_handoffs']), 'HANDOFF_DUPLICATE', 'output_handoffs', 'Unique handoff IDs')
    for ident, row in handoffs.items():
        require(row['producer_task'] in tasks and all(t in tasks for t in row['consumer_tasks']),
                'HANDOFF_TASK', ident, 'All producer and consumer tasks must exist')
        require(0 <= row['ready_minute'] <= row['consume_not_before'] <= 120,
                'HANDOFF_TIME', ident, 'Consumption cannot precede its produced output')
        require(row.get('status') == 'PLANNED_NOT_PRODUCED', 'HANDOFF_FALSE_COMPLETION', ident,
                'A planning handoff has not been produced by the product')
    for interface in plan['resident_handoff_interfaces']:
        matches = [row for row in handoffs.values()
                   if row['producer_task'] == interface['producer_task']
                   and row['ready_minute'] == interface['ready_checkpoint']
                   and interface['path'] in [path.split('::', 1)[0].split('#', 1)[0] for path in row.get('artifacts', [])]]
        require(bool(matches), 'HANDOFF_INTERFACE_DRIFT', interface['export'],
                'The resident interface path, producer and checkpoint must match a canonical output handoff')
    for row in plan['task_output_dependencies']:
        require(row['consumer_task'] in tasks, 'PHASE_TASK', row['consumer_task'], 'Consumer task must exist')
        for refs_key, window_key in [('requires', 'window'), ('full_runtime_requires', 'full_runtime_window')]:
            if refs_key not in row:
                continue
            required = row[refs_key]
            require(isinstance(required, list), 'PHASE_REFS', row['consumer_task'], refs_key + ' must be a list of handoff IDs')
            if not isinstance(required, list):
                continue
            start, stop = row[window_key]
            require(0 <= start < stop <= 120, 'PHASE_WINDOW', row['consumer_task'], str(row[window_key]))
            for ident in required:
                require(ident in handoffs, 'PHASE_HANDOFF', row['consumer_task'], str(ident))
                if ident in handoffs:
                    require(handoffs[ident]['ready_minute'] <= start, 'PHASE_INPUT_LATE', row['consumer_task'],
                            f'{ident} is ready at {handoffs[ident]["ready_minute"]}, but the phase starts at {start}')
    skills = {skill['id']: skill for skill in plan['resident_ai']['skills']}
    leases = plan['ownership']['skill_leases']
    require(len(leases) == 18 and {lease['skill_id'] for lease in leases} == set(skills),
            'SKILL_LEASE_COVERAGE', 'ownership.skill_leases', 'One exact lease per resident skill')
    for lease in leases:
        ident = lease['skill_id']
        require(lease['path'] == skills[ident]['source_path'], 'SKILL_LEASE_PATH', ident, 'Lease must name the actual distributed source')
        require(lease['writer'] in lifetimes and (lease['handoff_to'] is None or lease['handoff_to'] in lifetimes),
                'SKILL_LEASE_ACTOR', ident, 'Both writers need real actor lifetimes')
        low, high, _ = lifetimes.get(lease['writer'], (0, 0, ''))
        end = low
        for start, stop in sorted(lease['active_windows']):
            require(low <= end <= start < stop <= min(high, lease['exclusive_lease_until']),
                    'SKILL_LEASE_TIME', ident, 'Authoring must fit the writer lifetime and precede exclusive transfer')
            end = stop
    proof_ids = {proof['id'] for proof in plan['resident_ai']['integrated_proofs']}
    require({proof['id'] for proof in plan['execution_proofs']} == proof_ids,
            'EXECUTION_PROOF_COVERAGE', 'execution_proofs', 'Execution and resident manifest must cover the same six proofs')
    assigned = set()
    for assignment in plan['proof_assignments']:
        require(all(ident in definitions for ident in assignment['criterion_ids']),
                'PROOF_CRITERION_REF', assignment['entity_id'], 'Criterion IDs must exist')
        require(not assigned.intersection(assignment['criterion_ids']), 'PROOF_DUPLICATE_ASSIGNMENT',
                assignment['entity_id'], 'One authoritative explicit assignment per criterion')
        assigned.update(assignment['criterion_ids'])
        require(set(assignment['proof_packages']) <= evidence_ids and set(assignment['integrated_proofs']) <= proof_ids,
                'PROOF_PACKAGE_REF', assignment['entity_id'], 'Evidence and integrated proof IDs must exist')
    reviews = plan['review_assignments']
    require(len(reviews) == 3 and len({review['actor'] for review in reviews}) == 3,
            'REVIEWER_COUNT', 'review_assignments', 'Three distinct fresh reviewers')
    for review in reviews:
        actor = review['actor']
        require(actor in lifetimes and review['authoring'] == 'none', 'REVIEWER_INDEPENDENCE', actor,
                'Independent reviewers have declared lifetimes and no product authorship')
        if actor in lifetimes:
            start, _, slot = lifetimes[actor]
            require(start == review['start_minute'] and slot == review['physical_slot'],
                    'REVIEWER_SLOT', actor, 'Reviewer allocation must match the vacated physical slot')
    return {'physical_slots': len(slots), 'actor_lifetimes': len(lifetimes),
            'output_handoffs': len(handoffs), 'skill_leases': len(leases), 'fresh_reviewers': len(reviews)}
