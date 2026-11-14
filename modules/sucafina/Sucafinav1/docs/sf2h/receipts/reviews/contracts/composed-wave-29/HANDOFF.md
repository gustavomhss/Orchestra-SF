# Handoff terminal — missão29 / S3-R3

## Estado e limite

**Revisão delimitada: DONE. Produto: REQUEST_CHANGES / HOLD.**

Este handoff refere-se exclusivamente ao bundle **0ce090d7d1d4399d77b435debd59eb7cc903c202**, tree **f13eadcdf86861982ded1d05ef02e3bdd94adb2f**. Não é aceite de uma branch móvel, novo candidato, envelope D/G8, merge ou GLOBAL_RELEASE.

Revisor sem autoria do produto. Os três auxiliares forneceram leitura para **um único parecer independente S3-R3**. Não contam como os três juízes finais. O aceite específico de AM04 permanece com S2-R2; UX/semântica conservam suas revisões próprias.

A sessão leu integralmente missão/COMMON, AGENTS, START/WORKFLOW, o pack completo por leituras complementares e os quatro anexos. A identidade do pack e o ledger de leituras estão em EVIDENCE.json. As 40 obrigações atribuídas e o escopo canônico de 15WPs/74tasks/17contratos/1.610critérios não foram reduzidos nem marcados como aprovados.

## Entrega na mesma PR51

| Arquivo novo | Conteúdo |
| --- | --- |
| [REVIEW.md](REVIEW.md) | Parecer, findings, matrizes resumidas e limites probatórios |
| [FINDINGS.json](FINDINGS.json) | Três achados estáticos e três disposições agregadas de prova/gate, com impacto e próxima ação |
| [AM-MATRIX.json](AM-MATRIX.json) | Seis AM, requisitos normativos, observações, IDs ausentes, recursos e próximos passos |
| [RESIDENT-MATRIX.json](RESIDENT-MATRIX.json) | Cinco perfis/dezoito skills, hashes, consumers, 39 rotas/handlers/negativas e seis rotinas desconectadas |
| [GATE-MATRIX.json](GATE-MATRIX.json) | Oito receitas, gates estáticos, modos C/S e C/G7 versus D/G8 |
| [EVIDENCE.json](EVIDENCE.json) | SHAs/trees/blobs/digests, logs/runs/jobs/artifacts, observações delimitadas e ledger de leitura |
| [COVERAGE.json](COVERAGE.json) | Os 40 critérios atribuídos preservados, sem concessão de aceite |
| [FINDING-M29-RUNTIME-001.md](FINDING-M29-RUNTIME-001.md) | Achado acionável publicado primeiro em 0490eff57e2cd14b7043377eb5992552b7d529f9 |
| Este HANDOFF.md | Estado terminal, ações por owner e condição de recheck |

Todos pertencem ao namespace autorizado docs/sf2h/receipts/reviews/contracts/composed-wave-29/. O head inicial reconciliado foi **097e545ac8dd53e97cae8c12dec47faab5b3f576**. Seu handoff anterior terminou a janela de escrita precedente; seus recibos permanecem preservados.

O commit que contém este handoff é identificado externamente após a gravação. O resultado do compare/readback é informado no fechamento, sem autoatribuir neste arquivo um SHA futuro ou resultado de verificação posterior.

## Próximas ações concretas

| Responsável lógico | Recurso mínimo | Próximo passo exato | Prova de saída |
| --- | --- | --- | --- |
| Owner WP09/C07 + WP10, coordenados por S0 | SfRoutineNativePort real baseado em admissão governada/Relay; composição autorizada | Fornecer o adaptador a createSfRoutineServices e registrar suas seis capacidades no root instalado; conservar autenticação/revalidação | Novo C explicitamente fixado; recheck M29-RUNTIME-001 e AM02/AM06 |
| Owner de configuração/missão26 | Projetos TypeScript canônicos, três specs e fixtures/helpers transitivos | Ligar Operations/Decisions/Reports ao grafo e ao comando hospedado de gate, sem omitir fixtures de processo | Log/exit e lista real de arquivos cobertos no novo C; recheck M29-CI-002 |
| Owner WP14/integrador | Pin f8031d7c… e teste equivalente C0; processo de prova isolado | Reconciliar ou justificar a perda do caller de processo filho, preservando os negativos C17 atuais | Prova com PID distinto no candidato efetivo; não substituir witness nativo AM05 |
| Executor S4/WP12 | Instalação identificada, artefato extraído, modelo configurado, SessionV2 e casos/fontes autorizados | Obter 18 witnesses de skill e cinco perfis com mensagens, modelo, output persistido e ação de consumidor após reload; incluir reviewer distinto | AM01 e linhas RESIDENT-MATRIX completas com digests reais |
| Executor S0-B/S0-A | C16 privado, SkillLoadReceipt/contexto reais, duas sessões/principals e controle de revogação/provider | Exercitar 39 rotas e negativas, paridade por pack, forja/egress/search-detail/generation/restart e canais de dados | AM02/AM03 no mesmo C, call/domain/consumer IDs e ausência de efeitos/vazamento |
| Executor S4-A/S0; juiz S2-R2 | UI/autoridade humana, C09/C12, Planner/Procurement, barrier de perda/falha | Provar escolha/Apply, recibo atômico, perda/retry sem duplicação, conflito, reautenticação e Planner aplicado/Procurement recusado | AM04 integral; C12S2 histórico permanece parcial, processRestarted:false |
| Executor S0-A/S0-C + WP06/WP14 | Atlas real, scanner qualificado, store e processo isolado, resolver original e consumidor de artifact | Provar emit/append/commit/restart/read/consumo; clean/hit/timeout/ausência; perda/falha/idempotência; ACL/canary/revogação; documentos/bytes/hash | AM05 e gates Atlas; cada recurso concreto está em AM-MATRIX |
| Executor S3-C/S4 | Composição C07 corrigida, receita publicada pinada, Relay, resultado factual e Schedule | Obter retorno ao produto com falha/retry/intervenção/retomada, owner/timezone/recorrência/revogação e recusa de recursão routine-result | AM06 completa, sem ledger externo ou resultado autodeclarado |
| Owners Finance/WP13/WP14/WP11 e executor existente | Jornadas originais, budgets e assertivas preservados | Fechar caudas Finance/Memory e recovery composto no candidato final, sem substituir jornada por teste de fase | Runs qualificados das jornadas originais; falhas históricas mantêm identidade |
| S0, único dispatcher/aceitador final | Composição pronta, candidato congelado, runner existente, lease/deduplicação | Executar as oito seleções e adicionais obrigatórias; recolher requested/listed/executed, Omni, IDs, digests, logs e artifacts; executar gates estáticos e guard C | G7 somente após seis AM e três pareceres finais sem achado obrigatório no mesmo C |
| S0/T05 depois de G7 | Lista finita de paths evidenciais admitidos, árvore C/D e executor de guard | Formar D por adições admitidas, verificar diff completo/inputs/hashes e executar guard do próprio D | G8 e fechamento externo; não escrever em D seu próprio SHA/hash ou guard posterior |

Os nomes de atores indicam responsabilidade canônica; não afirmam que uma sessão concreta esteja ativa ou que seu lease atual tenha sido adquirido. S0 deve encaminhar pelos mecanismos já autorizados. Esta revisão não enviou mensagens a autores, não criou dispatcher e não solicitou credenciais.

## Provas que devem permanecer com sua identidade

- C12S2: W0b483fbf… / Sf4a1e6e2…, run43636531401, 7/7 no recorte HTTP/UI/C08/SQLite. Não é AM04 inteira nem restart de processo; apply.ts difere no C0.
- FinanceS3: W5a029e77… / S5b82d9de…, run43636137688, FAIL0/1. Histórico/replay/limites finais não alcançados. Os 43 verdes de S2 não substituem essa jornada.
- MI07: run43637227753, FAIL0/1 e cauda não alcançada. MI08: run43638160793, PASS3/3 de componente com nativeExecution:false. Um não apaga o outro.
- Operations: run43633572790 aprova um helper de listagem; cinco jornadas têm executions=0. Decisions: run43632217395 falha3/3 antes da UI em outro W/S; C0 já contém o perfil corrigido, ainda sem jornada qualificada. Reports: quatro casos NOT_RUN.
- Os recibos de integração em C0 fixam historicamente b62c3294… e se declaram não-D/G8. Não devem ser rebatizados como execução de C0.

As consultas de Actions foram encerradas no recorte documentado; não haverá polling desta sessão por resultados futuros. Dados não expostos nesta superfície não autorizam inferir indisponibilidade global de host, modelo, scanner ou CI. As ferramentas GitHub de run/log/artifact responderam; os recursos nativos precisam ser observados pelo executor autorizado.

## Regras para o recheck

1. Identificar o **mesmo C** proposto para aceite, com tree e todos os inputs de produto/teste/configuração/skill.
2. Mapear cada delta aos achados e às provas afetadas. Corrigir qualquer desses inputs cria novo C; manter os resultados antigos nos seus W/S.
3. Entregar recibos originais, IDs/digests e consumers efetivamente observados. Não substituir execução por catálogo, captura, listagem ou XML autodeclarado.
4. Completar as seis AM, oito receitas mais adicionais, typechecks/gates e três pareceres independentes. Nenhum requisito obrigatório vira opcional por terminar a revisão.
5. Verificar C/G7 e, separadamente, o envelope e guard D/G8. Este commit de review não é D.

**Fim da janela de escrita desta sessão:** após publicação e readback destes novos recibos. Não há autoridade residual para alterar produto, acompanhar indefinidamente heads móveis, executar testes/CI, fazer merge ou emitir GLOBAL_RELEASE. Uma nova solicitação de recheck deverá trazer o candidato e os deltas/provas correspondentes.
