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
    own = session['wps']
    builders = [wid for wid in own if not (session_id == 'S4' and wid == 'WP14')]
    if session_id == 'S0':
        local = ('Comece WP00 e WP10 em T0. Use três auxiliares reais conforme as alocações de schedule.json. '
                 'Atribua os arquivos de cada task de host, MCP, Atlas e harness a um único writer; só você integra a branch final. '
                 'Revisores novos usam slots liberados por builders das sessões S1/S2/S3, com encerramento e transferência explícitos. Quem escreveu uma parte não aprova essa parte; '
                 'use a rotação independente prevista, com recibo de não autoria. Preserve checkpoints e handoffs do adendo. '
                 'Em T+10, congele contratos, ownership e seleção cumulativa. Em T+20, verifique o caminho nativo exigido no gate, incluindo perfil, skill carregada e MCP.')
    else:
        local = ('Spawne três subagentes reais, um por WP: **' + ', '.join(builders) + '**. '
                 'Você coordena a sessão, contratos e handoffs; os builders escrevem suas fronteiras disjuntas. '
                 'Siga as alocações e rotação de revisão em schedule.json. Não conte sua coordenação como capacidade extra simultânea.')
        if session_id == 'S4':
            local += ' Você implementa a frente parcial WP14 nos intervalos reservados. ' + c['timebox'].get('wp14_budget', '')
    sections = c.get('prompt_sections', {})
    for group in [sections.get(session_id, {}), sections.get('shared', {})]:
        if isinstance(group, dict):
            local += ''.join('\n\n### ' + title + '\n\n' + str(content) for title, content in group.items())
    return f'''# Orchestra SF — {session_id}: {session['role']}

Você executa a sessão **{session_id}** da campanha **{c['id']}**, no repositório **{c['repository']}**. Sua frente é **{', '.join(own)}**. Baseline de código: `{c['baseline']['commit']}`. Use o mesmo SHA de planejamento fornecido pela integradora para todas as leituras.

## Missão e autoridade

Entregue integralmente os resultados da sua frente, incluindo consumo real e provas. A campanha reúne 28 capacidades, 41 requisitos originais, decisões com IA, agentes residentes, skills, MCP Sucafina e Atlas empresarial, além de BI, imports, reuniões, exportações e rotinas. Preserve todos os axiomas da campanha, de cada WP e de cada task.

Use exclusivamente GitHub MCP para operações remotas. A execução permite branches de trabalho, commits, draft PRs, integração e os checks previstos. Preserve as fronteiras de Azure/deploy, acessos corporativos, comunicação a terceiros e alçadas definidas na campanha. Este prompt não autoriza novos acessos nem envios a pessoas.

## Leitura obrigatória

Leia integralmente `CAMPAIGN.md`, `campaign.json`, `contracts.json`, `agents-atlas-mcp.json`, `AGENTS-ATLAS-MCP.md`, `specs/resident-runtime.md`, `ownership.json`, `schedule.json`, `output-handoffs.json`, `resident-proof-plan.json`, `resident-ui-consumption.json`, `evidence-plan.json`, `proof-map.json`, `coverage.json` e `ci-recipes.json`, todos nesta pasta e no mesmo commit. Leia também AGENTS.md da baseline e os WPs atribuídos:

{bullet(f'[{wid}](../work-packages/{wid}.md)' for wid in own)}

Cada arquivo de WP inclui suas tasks completas. Nenhuma página privada ou histórico de conversa é dependência de execução. Se o SHA de código mudou, S0 deve reconciliar o impacto antes de liberar a baseline.

## Sua orquestração

{local}

## Construção e integração

T0 é o horário publicado por S0 e inclui setup. WP00.T02 libera construção por contratos em T+10. WP00.T04 qualifica os serviços nativos; não bloqueia o início de frentes determinísticas que já têm contratos. Verifique checkpoints intermediários das tasks longas, não apenas seus prazos finais.

Use isolamento de checkout/worktree e branches declaradas em ownership.json. Um arquivo tem um writer. Para arquivo compartilhado entregue patch à sua dona; não tome ownership. Registre transferências antes de editar. Publique incrementos consumíveis e acompanhe a integração; fixtures de contrato permitem construir, mas não fecham aceite.

Domínios continuam fontes de verdade. Planner calcula valores. IA interpreta e propõe; pessoas escolhem e aprovam. Atores e permissões vêm do host confiável. Mutação e recibo são atômicos em cada domínio. O caso reconcilia aplicação parcial. Custos omitidos continuam pendentes, confirmações seguem o escopo material, e memória revalida acesso atual.

## Provas e recibos

Use os pacotes e critérios mapeados; não rode um teste por frase. Testes do repositório rodam no GitHub Actions. Typechecks e guards seguem AGENTS. Registre candidato, snapshot, request, run e seleção; uma execução antiga não prova uma mudança nova. Perfis/skills precisam de carga e resultado consumido, MCP de identidade por chamada, Atlas de módulos reais e persistência verificável.

Publique recibos no namespace `docs/sf2h/receipts/WPxx/` da branch do WP: tasks, head observado, arquivos, exports, contratos, consumidores, provas, observado versus esperado, achados, pendências e efeito no prazo. Subagentes usam colaboração local; entre conversas o Git é a fonte comum.

## Quando pode terminar

Conclua apenas com a frente commitada, integrada, verificada e sem achados obrigatórios, com DoD, invariants, quality standards, completeness criteria e success criteria satisfeitos. READY_FOR_INTEGRATION não é DONE. Registre bloqueio concreto e continue o restante autorizado. O prazo T+120 não relaxa o escopo ou o aceite.
'''


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
    out['START.md'] = '''# Iniciar a campanha integral

O plano e os cinco prompts estão versionados no mesmo diretório. Use o SHA do candidato de planejamento aprovado indicado em formal-review/README.md; não misture documentos de commits diferentes.

1. Leia [CAMPAIGN.md](CAMPAIGN.md) e o [estado da revisão](formal-review/README.md).
2. Abra cinco conversas e entregue o link fixado no SHA do prompt de cada sessão.
3. S0 registra T0, confirma a capacidade real e integra; S1–S4 confirmam sua identidade e iniciam seus três builders.
4. Siga os gates e alocações de schedule.json. As cinco famílias de axiomas valem na campanha, em cada WP e em cada task.

| Sessão | Prompt |
| --- | --- |
| S0 — integração | [S0.md](prompts/S0.md) |
| S1 — interface, Dashboard, Planner | [S1.md](prompts/S1.md) |
| S2 — Procurement, BI, documentos | [S2.md](prompts/S2.md) |
| S3 — reuniões, colaboração, rotinas | [S3.md](prompts/S3.md) |
| S4 — decisões, IA, portfólio, memória | [S4.md](prompts/S4.md) |

As páginas de origem em pages.json são histórico opcional. O conjunto executável está neste repositório. A publicação do plano não inicia a implementação automaticamente.
'''
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
