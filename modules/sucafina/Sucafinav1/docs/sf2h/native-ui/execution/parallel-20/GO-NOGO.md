# GO / NO-GO de UX nativa SF — única fila, 20 slots máximos

**Decisão neste pacote: DESIGN RECONCILED, EXECUTION NO-GO enquanto faltar autorização observada.** Um plano com contratos normativos revisados pode estar pronto para despacho técnico sem ter uma autoridade vigente para editar produto, sem permissão de 20 sessões e sem ter qualificado o C. O operador nunca converte "design frozen" em "test passed".

## 0. Estado factual e fontes
- Baseline normativa desta revisão: `ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1` (o arquivo `dispatch.json.source.commit` é o pin de decisões; atualizações posteriores deste diretório são documentos de delegação).
- PR76 `sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a` e PR91 review77 `native-plan-review@16712630025cad3de647f2ea49ecbcdb2cc854fa` são histórico e evidência de findings, não uma autoridade concorrente de contrato.
- Canônico imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`, 15 WPs, 74 tasks, 17 contratos, 1.610 critérios.
- `sf2-stack`, release waves/ACK72–74, integrador71, runner45 e S0 permanecem **móveis e externos**. O SHA histórico de fonte não é autoatualizado.
- `GLOBAL_RELEASE=false`. Nenhum novo produto, teste instalado, codegen, CI, merge, deploy ou 20 sessões foram criados por esta PR.

## 1. Preflight C00 — todos os itens são necessários

1. [ ] **Autoridade e custódia:** ler por GitHub SHA os ACKs vivos S0/71/45/72/73/74 e quaisquer outros owners de runtime/application, personal-views e planner; confirmar release explícito de paths, única stack e único CI dispatcher. Silêncio/timeout não encerra lease.
2. [ ] **Candidato real:** fixar `sf2-stack` material C + tree e os blobs por família consumida, confrontar preimage do dono e comparar apenas closure relevante dos 78 outputs; documentar drift causal e revalidar somente os consumidores afetados.
3. [ ] **Contrato único:** validar HEAD normativo desta branch e `execution/manifest.json`/305 operações/70 superfícies/ASSINATURAS/component locks, run `validate_dispatch.py` + `../validate_plan.py --strict --canonical <campaign.json>`; registrar outputs/run efetivos. Nenhum dos dois dá GO por si só. Resolver F01–F08 no corpus/contratos e registrar parecer independente do novo head (PR91 antigo não aprova este delta).
4. [ ] **Risco de segurança e produtor:** verificar que 72/73/74 e 85/86/94, se correntes, liberaram composição da autenticação, privacidade e body/abort/POST. Checar original Request, fence na transação, roleMap ausente vs vazio, return-intent e isolamento desktop. Falha => bloquear somente consumers afetados, **não** relaxar auth.
5. [ ] **Slots reais:** observar 1 integrador C00 e `0..19` autores independentes realmente admitidos; runners de CI são pool separado. Ordenar READY por contratos congelados, maior número de consumidores desbloqueáveis, prioridade, ID. Nunca abrir 20 leases por conveniência.
6. [ ] **Lease por output:** branch existente/preparada, ator/modelo/sessão REAL, owner atual, owns normalizados sem colisão, commit/base/tree, source-family/contract/copy digests, prazo/terminal explicitado e ACK de S0/71; registrar cada um. Nenhuma branch extra por micro-output, sem force, reset ou cherry-pick de árvore não examinada.
7. [ ] **Dispatcher 45:** conferir workflow real, seleção de specs, config, runner, fixture, capacidade e voo anterior; chave canônica inclui C/tree, request-normalized hash, workflow/config/runtime/fixture; dedupe somente se identidade completa igual. No empty/skip/expired artifact = PASS.
8. [ ] **Launch record:** preencher campos de `launch-record.template.json` somente a partir de provas, sem dados pessoais/segredos. Guardar o template no repo; publicar recebimentos em controle canônico autorizado (não transformar o template da PR99 em prova autossuficiente).

**Admissão**: todos os itens específicos da família do output precisam de GO explícito e contrato hash FROZEN. A falta de um serviço para prova instalada não precisa bloquear autoria independente contra contrato fechado. A falta de auth/binding legítimos bloqueia qualquer teste e mutação daquele consumidor.

## 2. 20 lanes em execução — rápida sem retrabalho

- C00 integra e registra todos os produtores e aliases compartilhados uma vez; W01–W19 escrevem unicamente seus paths na carta; o mesmo arquivo não tem dois writers. Um writer **não altera** norma, ACL, persistência ou CI em paralelo; manda patch inerte com preimage.
- Ordem de integração antecipada: F01/F02/S03 + F03 sob I00; discovery por IDs A sem directoryB; auth/fence; D01 Session; A03; U10.queue; U11.title-save (P0); U13.pr-approval (P1). Outras famílias A/S/U disjuntas avançam enquanto autores têm locks FROZEN.
- **P0:** edição title de draft PR pela operação fonte, CAS por linha de request, principal e host reais; sem C12 receipt nem aprovação. **P1:** submissão/holder e aprovação de PR persistida, segundo ator negado, M31/MI07 separados; browser e desktop REAL. Não usar sucesso P0 para fechar P1.
- Sem produção em massa de PRs: reusar lane após `ARTIFACT_READY` + receipt/consumer ACK, I00 integra outputs CAS no C. Início de uma nova microtask exige HEAD e preimages novos, mesmo branch somente se lease anterior terminal.
- F06: UI32/U43 só salva views nativas depois de implementação v2 no produtor real, CAS e migração; entrada preferida F01/U01 reautoriza. F07: OPEX/CAPEX TSV/partial por host mensal real com preview, 0–11→1–12 uma vez; sem reimplementar números.
- Runner é gargalo distinto: test request mínimo por causa, dedupe e guard; testes do componente compartilhado uma vez, teste de binding específico por UI, suites completas na cadência canônica. Falha idêntica sem mudança causal não pode ser repetida.

## 3. Terminais de cada unidade

| Estado | Evidência mínima | Pode autor seguir para próxima unidade? |
| --- | --- | --- |
| `BLOCKED_AUTHORIZATION` | autoridade/lease ausente, caminho exato, owner necessário | sim, somente leitura de outras unidades |
| `BLOCKED_CONTRACT` | divergência exata pin + blob + caso; I00 resolve centralmente | sim, outras saídas disjuntas |
| `ARTIFACT_READY` | commit/tree, pre/post blobs, type exports, specs/NOT_RUN claros, receipt e handoff aceito | sim, após release explícito; não significa C compilado |
| `INTEGRATED` | I00 aplicou output exato em C, ACK consumidor e deps materiais | sim |
| `QUALIFIED` | teste instalado real/CI com identidade completa + expected/observed | sim, somente no escopo comprovado |
| `CLOSED` | todos os gates da ordem e ACK terminal canônico | sim |
| `GLOBAL_RELEASE` | decisão exclusiva S0, C/G7, D/G8, três FINAL novos, mesma evidência/C | não é estado que autores possam declarar |

## 4. FINAL e parada global

R01 revisa produto/UX/native/a11y/15 chapters/70 superfícies/desktop; R02 finanças/autoridade/privacidade/números/C03/C06/C12/persistência; R03 IA real/MCP oito packs/39 ops/Atlas/scanner/Relay/Schedule/documentos/WP14/shipping. Sem autor revisar seu próprio código, todos no mesmo C corrigido. Encontrando defeito, feedback imediato ao writer original e revalidação por causa, não abrir nova execução caótica de tudo. `GLOBAL_RELEASE=false` até S0 e provas completas.

**NO-GO automático** para: desconhecimento de owner, SHA/source mismatch, auth fence ausente, view v2 apresentado antes de produtor, paste substituído por célula única, 200 de HTML interpretado como JSON, body limit burlado, POST travado sem prova, C12 falsificado, dublê do scanner, tentativa de retry de comando incerto, test/run não atribuível ao C, mismatch de PR/branch/lease, reviewer com autoria ou qualquer critério obrigatório aberto.

## 5. Métricas reais do fator 10×

Não afirmar aceleração numérica sem observação. Medir por output `queue_wait`, `authoring_duration`, `integration_wait`, `CI_queue+runtime`, `rework_count`, `cold_review_fixes`, e throughput de outputs **QUALIFIED** por dia no mesmo conjunto e qualidade de casos. Instrumentação só com timestamps/receipts autorizados; sem novo scheduler/telemetria com dados privados. Ganho real virá de contratos congelados, trabalho disjunto, integração por output, sem polling ocioso e nenhuma suite repetida sem delta causal.
