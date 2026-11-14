# WP12 — incremento publicado e handoff para S0

**Estado: IMPLEMENTED_SCOPED_VERIFIED; aceite integral BLOCKED.** O PR39 contém correções próprias publicadas e evidência cirúrgica. Não é declaração de WP12 integralmente concluído.

- Branch: astra-wp12; PR: https://github.com/gustavomhss/Orchestra-SF/pull/39; base preservada: 6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0.
- Produto final: ac3b5b53e65fbf251b6d3a95d6abef98d46a272a; tree: 432fcdbd97cc6e653be3af32554c63f2d1ae6e5e.
- Produto submetido aos 50 testes: b284a1c4fb54536b54bd4c2eb2adf2d947504725; tree: 58d8b9f59cf206fecea78c55d05b57c1bfdce8db.
- A única diferença de código posterior é tipagem Scope no fixture. JavaScript transformado idêntico: 54ae52fac404d7b4df27c5a8f1bd86a6394d1c561755726b86c07a2475889725; nenhum teste equivalente foi repetido.
- O commit de entrega acrescenta apenas os recibos deste diretório; head/tree da entrega e seu check ficam no corpo do PR.

## Resultado verificado

[Run 43580716747](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580716747), job 132404670331: **50 PASS, 0 FAIL, 302 assertions, 10 arquivos explícitos**. Omni positive control pass, nonce ac1588a3c86a5106539c3f2725625658, 111 spawns observados.

Os cinco perfis registram AgentV2 e as 18 fontes carregam por SessionV2.skill em 18 Sessions e mensagens distintas, com recibos e hashes no JSON. A contribuição por Location usa APIs públicas reais. Isso prova carga; os runIds de carga do teste não são admissões duráveis nem inferências do provider.

Passaram os negativos de homônimo, grants alterados, bytes alterados após registro, revogação, manifesto externo/symlink, perfis/skills duplicados ou incompletos, autoridade após espera, case/incarnation/version histórico, mutation callbacks, cancelamento concorrente e settlement tardio. Os testes C08 usam SQLite real; os callbacks de autorização injetados permanecem identificados como limites.

Typecheck/guards: [run 43580980934](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580980934), job 132405442055, snapshot f7e70a2dccc82567a901b646be64695251392d5b. bun typecheck em modules/sucafina: **FAIL**, 140 diagnósticos externos e 0 em paths próprios. check:spawn-imports PASS; check:guards --base origin/dev PASS com 0 gates, 11 warnings e 0 errors. Não interpretar ausência de erro próprio como typecheck verde.

## O que mudou

- Recuperação seletiva do trabalho próprio PR36, preservando AlternativeDraft em sf_portfolio e sf-compor-portfolio; grants efetivos são a interseção perfil/skill/operação. sf_watch_prepare não é concedido a sf_maestro sem skill correspondente e continua no fluxo permitido de portfólio.
- Histórico nativo exige case, incarnation e versão selecionados antes de replay; reabertura mantém ACL e validação de fontes atuais.
- Digests de inputs ficam presos antes da primeira espera de autorização; callbacks de preflight/commit e autorizações finais não podem trocar run/output/capture devolvidos ou persistidos.
- Cancelamento do reviewer mantém seu alvo independente. Falhas/indisponibilidade na publicação pedem settlement sob autoridade fresca; C08 impede substituir cancelled/ready por falha tardia.
- Fixture nativo exporta SessionExecution e registra fontes/perfis em cada Location adquirida pelo runner; não substitui SessionV2, SkillV2, mensagens ou execution runner.

## Escopo canônico

campaign.json foi conferido no pin dbf9547211d9b0fade619790de7c19c0869b7c7d; SHA256 703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba. Os textos/ponteiros de todos os 108 critérios são literais e o plano não foi alterado.

| Bloco | Critérios | Estado da task |
|---|---:|---|
| WP12 | 23 | Aceite integral não provado |
| T01 | 21 | Registro/carga provados; GNATIVE/inferência pendentes |
| T02 | 28 | 5 perfis/18 fontes/39 operações mapeados; 18 missões e consumidores pendentes |
| T03 | 21 | Negativos/proveniência provados; crítica real e efeito humano/C10 pendentes |
| T04 | 15 | C08/races/histórico testados; terminal host e C07 positivos pendentes |

Classificação estrita dos critérios: BLOCKED 22; PARTIAL 78; NOT_RUN 5; PASS_SCOPED 3. PASS_SCOPED só fecha enunciados estreitos de catálogo/carga; S0 ainda revisa. Os 50 axiomas herdados e qualificações globais permanecem separados.

## Consumidores e pendências precisas

O mapa de 18 skills identifica input/schema, produtor/função/blob, verifier, outputs, grants, consumidor concreto e campos de testemunho exigidos. Fonte externa revisada não é automaticamente fonte composta no candidato. Só os 20 blobs exatos de astra-wp12-intake.json foram consumidos.

| Fronteira | Owner / ação necessária |
|---|---|
| 18 inferências reais | WP10 + WP12: observar provider configurado, caso/principal admitidos, Session/receipt/modelo/toolcall reais, output persistido e consumerRef/ação após reload para cada skill. Disponibilidade atual do provider não foi aferida; antigo 402 não é diagnóstico atual. |
| Terminal com fonte stale/indisponível | WP10: caminho de autoridade atual para metadata terminal, preservando principal/caso/incarnation/run/session e sem liberar publicação com fence antigo. O preflight atual pode impedir markStale/settle e manter running. |
| AlternativeDraft histórico | WP10/WP11: captura C16 original verificável e replay somente leitura sob ACL atual. Recusa segura preservada; não reconstruir captura do modelo nem promover stale. |
| C07/Relay | WP10/WP09: instalar porta nativa governada e provar publicação/plano/admissão/run/version/corpo factual/digest/consumo. O host revisado chama routine-services sem native. |
| AnalysisPlan standalone | WP10/WP00: confirmar outra rota pinada ou completar validação/consumo no par sf-enquadrar-decisao; verifier observado aceita IntentFrame. |
| UnresolvedCondition standalone | WP10/WP00: confirmar rota ou implementar validação/consumo no par sf-contestar-decisao; condições aninhadas em CritiqueReport já são suportadas. |
| Typecheck da composição | Owners indicados no recibo: reconciliar contratos/consumidores. 137 diagnósticos recaem em arquivos preservados da base e 3 em inputs consumidos; isso não prova preexistência. |

Consumidores publicados identificados: QuestionProposal → createQuestionConsumer; DecisionBrief/MeetingMaterialProposal → createReviewContributionConsumer; AlternativeDraft → createAnalysisAlternativePromotion com captura/replay/C10; renderização tipada → handleSfAnalysis/contributionBody. Existência do consumidor não substitui efeito observado de inferência.

Os deltas foram encaminhados aos PRs32,35 e40; links e pins no recibo de owner deltas. Não houve mudança de branch alheia, sf2-stack, plano, engines, Azure/deploy/identidade/política financeira, restart ou reativação de workers antigos.

## Arquivos de evidência

- astra-wp12-criteria.json: 108 critérios, 50 axiomas herdados, testes observados, fontes próprias/externas e limites.
- astra-wp12-criteria.md: tabela literal dos 108 critérios.
- astra-wp12-skills-consumers.json: mapa completo 5/18/39 com recibos de carga e consumidores.
- astra-wp12-evidence.json: W/S distintos, requests, hashes, runs/jobs, recibos e equivalência de tipagem.
- astra-wp12-owner-deltas.json: fronteiras externas, triagem e encaminhamento.
- astra-wp12-typecheck.txt: diagnósticos do último package typecheck, sem omitir o FAIL.

S0 deve revisar e compor os outputs pinados. Nenhum epic, merge em dev ou deploy foi feito.
