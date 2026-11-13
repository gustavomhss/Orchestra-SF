#!/usr/bin/env python3
"""Render the plan's mirrors from campaign.json; this never executes the product."""
import argparse
import json
from pathlib import Path

FAMILIES = {
    'dod': 'Definition of Done',
    'invariants': 'Invariants',
    'quality_standards': 'Quality standards',
    'completeness_criteria': 'Completeness criteria',
    'success_criteria': 'Success criteria',
}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def bullet(items):
    return '\n'.join('- ' + str(item) for item in items)


def axioms(entity, depth=3):
    sections = []
    for family, label in FAMILIES.items():
        sections.append('#' * depth + ' ' + label + '\n\n' + bullet(
            f'**{row["id"]}** — {row["text"]}' for row in entity['axioms'][family]))
    return '\n\n'.join(sections)


def window(value):
    return f'T+{value[0]}–{value[1]}'


def wp_markdown(wp):
    text = [
        f'# {wp["id"]} — {wp["title"]}', wp['objective'],
        f'**Sessão:** {wp["session"]}. **Construção alvo:** {window(wp["build_window"])}. '
        f'**Integração:** até T+{wp["integration_deadline"]}.',
        f'**Branch:** `{wp["ownership"]["branch"]}`. **Provas:** ' + ', '.join(wp['evidence_packages']) + '.',
        '## Fronteira de escrita',
        bullet('`' + item + '`' for item in wp['ownership'].get('existing_files', []) + wp['ownership'].get('new_files', []) + wp['ownership'].get('new_prefixes', [])),
        wp['ownership'].get('allowed_purpose', ''),
        '## Escopo', bullet(wp.get('scope_in', [])),
        '**Contratos consumidos:** ' + ', '.join(wp.get('contract_reads', [])) + '.',
        '**Contratos fornecidos:** ' + ', '.join(wp.get('contract_provides', [])) + '.',
        '## Axiomas do WP', axioms(wp),
    ]
    for task in wp['tasks']:
        text += [
            f'## {task["id"]} — {task["title"]}', task['intent'],
            f'**Construção:** {window(task["build_window"])}. **Dependências de construção:** '
            + (', '.join(task['depends_on']) or 'pode iniciar em T0') + '.',
            f'**Provas:** {window(task["proof_window"])}; conjuntos ' + ', '.join(task['evidence_packages']) + '.',
            '**Entradas:** ' + '; '.join(task.get('inputs', [])) + '.',
            '**Requisitos:** ' + (', '.join(task.get('requirements', [])) or 'critérios locais e da campanha') + '.',
            '**Trabalho**', bullet(task['work']),
            '**Saídas:** ' + '; '.join(task['outputs']) + '.',
            '**Consumos reais para concluir:** ' + (', '.join(task.get('integrates_with', [])) or 'os definidos no gate da unidade') + '.',
        ]
        if task.get('acceptance_requires'):
            text += ['**Aceitação exige:** ' + ', '.join(task['acceptance_requires']) + '.']
        details = {key: task[key] for key in ['execution_actor', 'actor', 'allocation_ref', 'checkpoints', 'handoffs', 'resident_deliverables', 'contract_refs', 'execution_steps'] if key in task}
        if details:
            text += ['### Alocação e entregas intermediárias', '```json\n' + encoded(details) + '```']
        text += [axioms(task), '### Verificações', bullet(f'**{row["id"]}** — {row["text"]}' for row in task['checks'])]
    extra = {key: wp[key] for key in ['scope_out', 'handoff', 'risks', 'implementation_readiness', 'contract_notes'] if key in wp}
    text += ['## Handoff e limites da fronteira', '```json\n' + encoded(extra) + '```']
    return '\n\n'.join(part for part in text if part) + '\n'


def campaign_markdown(campaign):
    wps = campaign['work_packages']
    tasks = [task for wp in wps for task in wp['tasks']]
    c = campaign
    sections = [
        '# Orchestra SF — campanha integral de produto, IA e equipe residente',
        '**Implementação: PLANNED / NOT_RUN.** O estado da revisão do planejamento é publicado em [formal-review/README.md](formal-review/README.md).',
        '## Resultado contratado', c['mission'], c['product_promise'],
        f'Repositório: `{c["repository"]}`. Baseline de código: `{c["baseline"]["commit"]}`. '
        f'A campanha tem **{len(wps)} WPs, {len(tasks)} tasks e {len(c["contracts"])} contratos**. '
        'O conjunto mantém as 28 capacidades originais, os 41 requisitos e as 18 capacidades de IA.',
        '## Escopo integral', bullet(c['scope']['included']),
        '### Fronteiras do trabalho', bullet(c['scope']['excluded']),
        '## Paralelização e recursos', c['timebox']['capacity'],
        '| Sessão | Frente | WPs |\n| --- | --- | --- |\n' + '\n'.join(
            f'| {key} | {value["role"]} | {", ".join(value["wps"])} |' for key, value in c['timebox']['sessions'].items()),
        'O escritor e os caminhos de cada frente estão em [ownership.json](ownership.json). '
        'Alocações, checkpoints e condições de capacidade estão em [schedule.json](schedule.json). '
        'A coordenadora não conta como dois agentes quando implementa e integra.',
        c['timebox'].get('wp14_budget', ''),
        '## Relógio e condições de conclusão', c['timebox']['clock_start'], c['timebox']['feasibility'],
        '| Minuto | Gate | Condição |\n| ---: | --- | --- |\n' + '\n'.join(
            f'| {gate["minute"]} | {gate["gate"]} | {gate["condition"]} |' for gate in c['gates']),
        c['timebox']['ci_budget'],
        'O prazo de 120 minutos continua sendo meta condicionada. Caso alguma capacidade, integração ou prova obrigatória permaneça aberta, o escopo completo continua em execução. O relógio não concede aceite.',
        '## Contratos, tarefas e consumo real',
        'A lista normativa é [campaign.json](campaign.json). Os demais artefatos são derivados por '
        '`python tools/render_plan.py`; `--check` detecta divergências. Alterar a fonte canônica e regenerar as cópias no mesmo commit.',
        c['execution']['dependency_meaning'], c['execution']['contract_change'],
        '| Contrato | Responsável pela definição | Nome |\n| --- | --- | --- |\n' + '\n'.join(
            f'| {item["id"]} | {item["definition_owner"]} | {item["name"]} |' for item in c['contracts']),
        'As assinaturas, semânticas, produtores e consumidores ficam em [contracts.json](contracts.json). '
        'A equipe residente possui [manifesto canônico](agents-atlas-mcp.json), [guia técnico](AGENTS-ATLAS-MCP.md) e '
        '[contratos detalhados](specs/resident-runtime.md). Cada entrega adicional precisa de resultado consumido e prova identificada.',
        '## Axiomas da campanha', axioms(c),
        '## WPs e tasks',
        '| WP | Objetivo | Sessão | Tasks |\n| --- | --- | --- | ---: |\n' + '\n'.join(
            f'| [{wp["id"]}](work-packages/{wp["id"]}.md) | {wp["title"]} | {wp["session"]} | {len(wp["tasks"])} |' for wp in wps),
        'Cada task/step é uma unidade com trabalho, entradas, saídas, writer, consumidores, checks e cinco famílias de axiomas próprios. '
        'Subdivisão executável com responsabilidade distinta deve ganhar os mesmos cinco grupos. Os índices não substituem a observação do comportamento.',
        '## Evidência e revisão',
        '| Pacote | Escopo |\n| --- | --- |\n' + '\n'.join(
            f'| {item["id"]} — {item["title"]} | {item["coverage"]} |' for item in c['evidence']['packages']),
        c['evidence']['validity'], c['evidence']['usability'],
        'A matriz [proof-map.json](proof-map.json) vincula cada critério a conjuntos de provas. '
        'Um pacote aprovado não aprova automaticamente todos os seus critérios. Perfis, skills e packs têm vínculos próprios no manifesto residente.',
        '## CI e entrega', c['ci_plan']['mechanism'], c['ci_plan']['request_validation'],
        'As seleções Bun de `src` e `test-browser` têm recibos separados. Provas reais de IA, MCP, Atlas e Relay '
        'mantêm a identidade do candidato e não são substituídas por mocks. Aplicam-se o inventário cumulativo, os typechecks e os guards exigidos em AGENTS.',
        'A entrega é um candidato integrado e commitado, com os gates exigidos, revisões reconciliadas e guias de uso. '
        'A aprovação deste planejamento não certifica a implementação futura.',
        '## Como iniciar',
        'Use [START.md](START.md) e os cinco prompts no mesmo commit do plano. Cada sessão lê suas WPs completas, '
        'os contratos e as restrições comuns antes de escrever. GitHub é acessado pelo MCP existente; não criar novas credenciais.',
    ]
    return '\n\n'.join(str(part) for part in sections if part) + '\n'


def prompt_markdown(c, session_id, session):
    local = c['prompt_sections'][session_id]['body']
    shared = '\n\n'.join('### ' + title + '\n\n' + body for title, body in c['prompt_sections']['shared'].items())
    launch = ('Você é a sessão supervisora. Execute o workflow para iniciar, atribuir, acompanhar e integrar as sessões S1–S4. Primeiro confira as capacidades de criação/retomada e o limite global; depois lance/reconheça instâncias, receba ACKs e admita o preset observado.' if session_id=='S0' else 'Sua identidade e frente já estão atribuídas. Responda à supervisora S0 com seu ACK real; não escolha outra fatia. Inicie seus três builders somente nos slots efetivamente admitidos.')
    return f"""# Orchestra SF — {session_id}: {session['role']}

Você executa **{session_id}** na campanha **{c['id']}**, repositório **{c['repository']}**. WPs: **{', '.join(session['wps'])}**. Baseline de código: `{c['baseline']['commit']}`. Use o mesmo SHA de planejamento informado no lançamento para todos os documentos.

{launch}

## Leitura suficiente e obrigatória

1. Leia [COMMON](../execution/COMMON.md) e [o pack completo de {session_id}](../execution/actors/{session_id}.json). Eles preservam axiomas, critérios e contratos da sua atribuição; não releia quinze representações integrais da mesma fonte.
2. Leia [WORKFLOW](../WORKFLOW.md) e as seções pertinentes de [execution-workflow.json](../execution-workflow.json). Confirme a revisão do plano em [formal-review/README.md](../formal-review/README.md).
3. Leia AGENTS e o código real da baseline nos paths que vai alterar, com instruções locais e dependências. Os anexos obrigatórios do pack continuam aplicáveis. Amplie a leitura diante de uma dependência/risco concreto.
4. Envie a cada auxiliar seu [pack atribuído](../execution/manifest.json), identidade, branch, lease/epoch, inputs, outputs, provas e checkpoint. Nenhum ator recebe um menu de fatias.

## Missão e autoridade

Entregue toda a frente, seus consumidores, provas e correções. Use somente GitHub MCP para operações remotas, sem gh/login/token novo. Preserve limites de Azure/deploy, acessos corporativos, comunicação a terceiros e alçadas da campanha. O workflow não cria novas permissões.

## Sua orquestração

{local}

{shared}

## Loop de trabalho

Mantenha o mesmo writer para seus jobs e tarefas contínuas. Publique incremento consumível por SHA, faça o consumidor confirmar o recebimento e encaminhe solicitações de validação ao dispatcher vigente. Receba achados e corrija sua fronteira enquanto outras seguem. Use contratos e produtores existentes; não duplique cálculo, parser, UI compartilhada ou bridge.

Atualize o checkpoint em mudança material: head, outputs prontos/consumidos, critérios/provas pendentes, lease, blocker e próxima ação. Retome pelo delta e pelo restante, sem recomeçar trabalho aceito. Silêncio não prova morte e não autoriza dois writers.

## Término

READY_FOR_INTEGRATION não é DONE. A coordenadora conserva obrigação de retomada até GLOBAL_RELEASE; builders só liberam slots com handoff aceito ao writer de correções. Aprovação exige critérios completos, consumo real, evidência atual e revisão independente. C é o produto testado; D contém somente o envelope evidencial validado. T120 incompleto exige ETA observado e continuação integral, sem encerrar por prazo ou reduzir escopo.
"""

def artifacts(campaign):
    c = campaign
    wps = c['work_packages']
    tasks = [task for wp in wps for task in wp['tasks']]
    entities = [c] + wps + tasks
    out = {}
    for filename, value in [
        ('contracts.json', c['contracts']), ('ownership.json', c['ownership']),
        ('coverage.json', c['coverage']), ('schedule.json', c['timebox']),
        ('evidence-plan.json', c['evidence']), ('ci-recipes.json', c['ci_plan']),
        ('agents-atlas-mcp.json', c.get('resident_ai', {})),
        ('resident-ui-consumption.json', c.get('resident_ui_consumption', {})),
        ('output-handoffs.json', {'outputs': c.get('output_handoffs', []), 'task_output_dependencies': c.get('task_output_dependencies', [])}),
        ('resident-proof-plan.json', {'proofs': c.get('execution_proofs', []), 'criterion_assignments': c.get('proof_assignments', []), 'review_assignments': c.get('review_assignments', [])}),
    ]:
        out[filename] = encoded(value)
    for wp in wps:
        out[f'work-packages/{wp["id"]}.json'] = encoded(wp)
        out[f'work-packages/{wp["id"]}.md'] = wp_markdown(wp)
    out['task-dag.json'] = encoded({
        'build_edges': [{'from': dep, 'to': task['id']} for task in tasks for dep in task.get('depends_on', [])],
        'consumer_edges': [{'producer': dep, 'consumer': task['id']} for task in tasks for dep in task.get('integrates_with', [])],
        'note': 'Arestas de consumidor são prova de integração; não são bloqueio artificial ao início da construção.',
    })
    index, proofs = [], []
    assignments = {criterion: assignment for assignment in c.get('proof_assignments', []) for criterion in assignment['criterion_ids']}
    for entity in entities:
        packages = entity.get('evidence_packages') or [item['id'] for item in c['evidence']['packages']]
        for family in FAMILIES:
            for row in entity['axioms'][family]:
                index.append({'id': row['id'], 'entity': entity['id'], 'family': family, 'text': row['text'], 'status': 'NOT_RUN'})
                proofs.append({'criterion_id': row['id'], 'entity_id': entity['id'], 'family': family, 'proof_packages': packages, 'expected': row['text'], 'status': 'NOT_RUN'})
        for row in entity.get('checks', []):
            proofs.append({'criterion_id': row['id'], 'entity_id': entity['id'], 'family': 'check', 'proof_packages': packages, 'expected': row['text'], 'status': 'NOT_RUN'})
    for proof in proofs:
        assignment = assignments.get(proof['criterion_id'])
        if assignment:
            proof['proof_packages'] = assignment['proof_packages']
            proof['integrated_proofs'] = assignment['integrated_proofs']
    out['axiom-index.json'] = encoded(index)
    out['proof-map.json'] = encoded({
        'purpose': 'Correspondência planejada de todos os critérios e conjuntos de provas. Cada critério exige observação específica; passar um pacote não concede PASS automático a todas as linhas.',
        'entries': proofs,
        'resident_manifest': 'agents-atlas-mcp.json',
        'status': 'NOT_RUN',
    })
    out['CAMPAIGN.md'] = campaign_markdown(c)
    for key, session in c['timebox']['sessions'].items():
        out[f'prompts/{key}.md'] = prompt_markdown(c, key, session)
    out['START.md'] = """# Iniciar pela supervisora

Entregue à sessão **S0** o [prompt da supervisora](prompts/S0.md), fixado no mesmo commit aprovado de todos os artefatos. Ela controla o [workflow S0+N](WORKFLOW.md), distribui os jobs, acompanha outputs, integra e fecha a campanha.

O preset de duas horas usa **S0 + N=4 sessões S1–S4**, até vinte slots contando cinco coordenadoras. Sua admissão exige capacidade real: a árvore collaboration de quatro slots globais não se multiplica por nesting. Criação/retomada automática usa somente capacidades efetivamente expostas. Sem launcher, o modo assistido exige iniciar as conversas atribuídas; Git mantém o ledger e não as desperta.

| Sessão | Entrada atribuída |
| --- | --- |
| S0 — supervisão, integração, runtime e Atlas | [S0.md](prompts/S0.md) |
| S1 — interface, Dashboard e Planner | [S1.md](prompts/S1.md) |
| S2 — Procurement, BI e documentos | [S2.md](prompts/S2.md) |
| S3 — reuniões, colaboração e rotinas | [S3.md](prompts/S3.md) |
| S4 — decisões, IA, portfólio e memória | [S4.md](prompts/S4.md) |

Cada ator lê [COMMON](execution/COMMON.md) e seu [pack completo com hash](execution/manifest.json). A fonte continua canônica; os packs preservam as tarefas, axiomas e contratos pertinentes e dispensam a releitura integral de seus espelhos. Fontes e dependências reais continuam obrigatórias antes da alteração de código.

S0 registra T0 antes do setup e do lançamento. Os checkpoints são cumulativos, não barreiras: outputs, provas e achados fluem assim que prontos. Não reinicie o relógio nem reduza o escopo se120 minutos não bastarem. A implementação só começa quando este workflow for executado; a publicação do plano não a inicia.
"""
    from render_fast_context import artifacts as fast_context_artifacts
    out.update(fast_context_artifacts(c))
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, default=Path(__file__).resolve().parent.parent / 'campaign.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = artifacts(json.loads(args.plan.read_text()))
    changed = []
    for name, content in outputs.items():
        path = args.plan.parent / name
        if not path.exists() or path.read_text() != content:
            changed.append(name)
            if not args.check:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
    print(encoded({'mode': 'check' if args.check else 'render', 'artifacts': len(outputs), 'drift' if args.check else 'written': changed}).strip())
    return 1 if args.check and changed else 0


if __name__ == '__main__':
    raise SystemExit(main())
