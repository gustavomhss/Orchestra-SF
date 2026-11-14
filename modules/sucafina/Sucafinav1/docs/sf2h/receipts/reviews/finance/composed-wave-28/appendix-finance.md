> Anexo de leitura independente consolidado por S2-R2. O ID auxiliar FIN28-CALLBACK-PROOF corresponde a R28-COVERAGE-CALLBACK-PROOF em findings.json; não é um finding adicional. Este anexo não constitui outro parecer obrigatório da campanha.

# Missão28 — apoio independente Finance / C09, C10 e C14

## Parecer delimitado

**REQUEST_CHANGES / NEEDS_EVIDENCE no bundle fixo `0ce090d7d1d4399d77b435debd59eb7cc903c202`. FIN-IND-005 permanece aberto.** A revisão estática encontrou suporte real para as correções Finance integradas e para a preservação de cobertura e escolhas históricas. A prova financeira ponta a ponta consultada continua vermelha antes da cauda obrigatória. Existe também uma lacuna temporal específica entre o predicado de autoridade original e resoluções posteriores de cobertura; classifico-a como **REQUIRED_PROOF_GAP**, não como exploração reproduzida.

Sou contexto auxiliar de revisão independente S2-R2. Não tenho autoria dos arquivos de produto examinados e não escrevi produto, testes, fixtures, workflows ou configuração. Esta atuação não é uma identidade de worker/supervisor nativo da campanha e não prova AM01–AM06. Nenhum teste, engine, typecheck, CI ou navegador foi executado ou disparado. Todas as leituras remotas ocorreram pelo GitHub MCP; ferramentas locais apenas leram, organizaram e compararam metadados/documentos em scratch.

A identidade fixada é produto `0ce090d7d1d4399d77b435debd59eb7cc903c202`, tree `f13eadcdf86861982ded1d05ef02e3bdd94adb2f`; plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`. Conclusões posteriores exigem recheck independente. Não há aprovação global, merge ou declaração GLOBAL_RELEASE.

## Leitura e limites de autoria

Foram lidos integralmente AGENTS, missão 28/COMMON, COMMON de execução e, dentro do pack S2-R2 exato, os contratos C09/C10/C14, numeric_oracles, proof_bindings, evidence, ci_plan e selection_pointers. Foi lido integralmente o apêndice `specs/execution-reconciliation.md`. Foram lidos os handoffs Finance da entrega de performance e da sessão 18, além do histórico anterior estritamente como proveniência. A cobertura dos outros contratos e apêndices pertence ao parecer consolidado do revisor principal; não a reivindico neste anexo.

Fontes de referência imutáveis:

- [Pack S2-R2](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/execution/actors/S2-R2.json).
- [Execution reconciliation](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/execution-reconciliation.md).
- [Handoff Finance closure no alvo](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/docs/sf2h/receipts/finance-journey-closure/HANDOFF-FINAL.md), blob `aff4a6ce54f550ad742c1d8f8b8534d38916f21a`.
- [Handoff Finance performance no alvo](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/finance-resume-performance/HANDOFF-FINAL.md), blob `976b71bc150fa5810a60ff5917e17bfd18701bc9`.

## Separação entre fonte, consumo e execução

A fonte Finance sessão 18 W2 é `5a029e77bfd9d8ba19494966a95c908e3f05043d`, tree `a736cd370da6081c6010ffb26d66130fea94736f`. A entrega documental é `d8d586e19c824f75a88494a9c3677faac617e81d`. A leitura de arquivos nessa fonte e o inventário da árvore fixada confirmaram os mesmos blobs abaixo. O consumo é real; os runs continuam identificados pela fonte que efetivamente executaram.

Todos os paths da tabela estão sob `modules/sucafina/Sucafinav1/`.

| Path | Blob no bundle e na fonte W2 | Conclusão restrita |
| --- | --- | --- |
| product/portfolio/coverage-preview.ts | 9f7e12113b38e73befb64f99a94fb8ca28d05eee | O predicate original precoce foi preservado; shortcut PR56 não foi aplicado. |
| product/portfolio/planner-sensitivity.ts | fe4ab56201fd1898905ac7bc810f0495a64f8602 | Busca inicial e recertificação final por witnesses atuais; não reutiliza número como autorização. |
| product/portfolio/verification.ts | 46a04597df74205add4531465f35d8a55ca1f8dd | Recompõe resultado/evidências e conserva finalizador de scope, Request, publicação e limpeza. |
| product/portfolio/threshold-proof.ts | ce7d267d126992bc1a0796e2b64e5dc1c87bb12b | Certificado de fronteira é comparado à estrutura e aos witnesses atuais. |
| product/planner/sensitivity-units.ts | 29ef0758be90aa2851a2631de8ed3aff5e0cc332 | Pares canônicos usam envelopes compartilhados por fase, mantendo identidade e callbacks explícitos. |
| product/planner/stored-scenarios.ts | d39d52bc2b04d7b4864539c78a002232628ad2c7 | Observações inicial e final independentes. |
| product/decisions/result-store.ts | 23a90b2e44e8bf7f50ff41f6f1622f77a5c9dd85 | Recibo compacto vincula envelope canônico; leitura/replay permanecem autorizados. |

A consulta de runs com `head_sha=0ce090d7d1d4399d77b435debd59eb7cc903c202` retornou zero runs diretos. Essa consulta não exclui snapshots CI filhos; portanto não é prova de inexistência de todo CI do bundle. A conclusão é que **as evidências Finance consultadas não demonstram a jornada completa nem o conjunto obrigatório de provas no bundle fixo**.

### Execuções recuperadas e conferidas

| Prova | Identidade efetiva | Resultado real | O que permite afirmar |
| --- | --- | --- | --- |
| S2 Finance sessão 18 | W2 5a029e77; snapshot `8bf015c999750c26a721749cfca9372891d3cec3`; run [43635340065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635340065), job 132570795422; push, attempt1, branch ci-run-linux-finance-closure-5a029e77-0cf38dfb-s2 | **43 pass /0 fail /350 expect calls** | Fonte afetada passou; vários negativos de autoridade e persistência passaram. Não é run do bundle composto. |
| S3 jornada integral sessão 18 | W2 5a029e77; snapshot `5b82d9de8e329bdf2656ab8785c8d7ed2d7841a8`; run [43636137688](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43636137688), job 132573236668; push, attempt1, branch ci-run-linux-finance-closure-5a029e77-40edbce1-s3 | **0 pass /1 fail /18 expect calls**,180016,75 ms | Falha da guarda de180000ms durante confirmed.exact. Não fecha FIN-IND-005. |

Os compares recuperados W2→S2 e W2→S3 têm um commit e um arquivo adicional, somente `.ci-run.json`, respectivamente blobs `31d1cb62b1295a7e5aa869b7dd8e3d4b4fbec0a9` e `9c4c5e2cd8e06becbd335ea9fb90af2e712f6802`. Os logs reais, não apenas a narrativa da PR, foram lidos. Não executei os testes.

## FIN-IND-005 — P1 / NEEDS_EVIDENCE / OPEN_IMPLEMENTED_NOT_CLOSED

**Owner:** Finance/WP11 e WP13 para a jornada e consumidores financeiros; WP10/S0 para composição e qualificação do candidato. **Alvo:** `0ce090d7d1d4399d77b435debd59eb7cc903c202`. **Execução nova nesta revisão:** NOT_RUN.

O contrato exige ausência diferente de zero, recomposição na mesma identidade, limiar financeiro correto, manutenção da escolha histórica e reabertura com autorização atual. A fonte W2 melhorou e foi consumida no alvo. O último run de jornada recuperado ainda termina antes das provas que fechariam a obrigação. Não classifico o timeout como bug aritmético.

[O teste existente](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/journey-phase.test.ts), blob `6395a5dc529acadfb0d9c1e2d8dca0664f40a39e`, delimita exatamente:

| Etapa | Linhas | Observado no S3 recuperado |
| --- | --- | --- |
| Baseline240000, subtotal210000, treinamento omitido pending, totalnull | 18–20 | Assertions alcançadas.240000 é custo baseline, não receita independente. |
| Teto conhecido~55000 condicionado e missing-category:training | 24–29 | Assertions alcançadas; não é cobertura completa. |
| Escolha humana persistida com alternativa/basis/coverage originais | 31–34 | Alcançada na versão4. |
| Mesma identidade/incarnation; treinamento40000; total 250000; vantagem−10000; critério failed | 35–44 | Assertions alcançadas na versão6. |
| Resultado confirmado completo, teto 15000 | 48–53 | **Não alcançado**. |
| Witnesses15000/15001 e mínimo 20000 | 54–64 | **Não alcançado**. |
| Releitura histórica preservando escolha, estado reconsidering, sem preparedChanges/receipts | 66–72 | **Não alcançado**. |
| Retry autorizado sem ledger/choice duplicados | 73–77 | **Não alcançado**. |
| Fechamento/reabertura real de SQLite/UI, nova autoridade, colaborador/outsider/revogação | 79–94 | **Não alcançado**. |

O checkpoint confirmado da linha44 reimprime `originalChoice`, variável retida desde a linha32. Isso não é a releitura persistida da linha66.

O S3 atual ultrapassa o S6 histórico: coverage.issue retornou ok em 28504 ms, **ambos** coverage.qualify retornaram ok em 18914 e19446ms, e **duas** escritas de amostra confirmada concluíram. Em 178956 ms começou confirmed.exact; units.issue→stored-scenarios→Planner.compareForecast encontrou a guarda em 180006 ms. Os logs contêm `WP11_FIXTURE_DEADLINE_EXCEEDED`; não demonstram uma nova revogação de negócio. As durações são inclusivas/aninhadas e não podem ser somadas. Não repetir o diagnóstico antigo de que o último run parou no primeiro qualifier, sem escritas.

O teste tem orçamento próprio300000ms (linha98), a fixture guarda180000ms; request CI tem --timeout120000. Esses três números não são intercambiáveis. Nada nesta revisão altera budgets, testes ou assertions.

**Ação exigida para fechamento:** owner entrega mudança material e provas afetadas preservando os callbacks e as duas observações necessárias; executa depois a jornada original completa, sem omitir a cauda, e compõe o output em candidato identificado. Revisor independente confere os blobs consumidos e a evidência daquele novo candidato. Os negativos e o reopen isolado do recibo em S2 são contraprovas válidas de regressão; não substituem o histórico/replay/reabertura desta mesma jornada. Mesmo um futuro PASS dessa jornada não prova sozinho replay de sensibilidade persistida depois do restart, UI completa ou execução nativa; a fixture usa grants/seleção sintéticos e o teste declara esse limite.

## FIN28-CALLBACK-PROOF — P1 / REQUIRED_PROOF_GAP

**Owner:** WP13/Finance, com WP10 para o produtor instalado. **Classificação:** NEEDS_EVIDENCE; observação estática, reprodução executada NOT_RUN. **Não é declaração de exploração remota, vazamento ou Apply indevido.**

### Fronteira precisa

[coverage-preview.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/product/portfolio/coverage-preview.ts), blob `9f7e12113b38e73befb64f99a94fb8ca28d05eee`:

- `issue` resolve autoridade **A** na linha107, destaca dados109, calcula digest110 e invoca **A.isStillValid** na111. Conserva também a checagem do objeto bruto original nesse ponto.
- Depois espera `prove` na123. O retorno não-ok da124 não executa uma verificação tardia adicional de A.
- Grava intervalo131, chama `current`133 e limpa o intervalo em caso de recusa134.
- `current`, linhas92–104, resolve autoridade nova **B**96, calcula digest99 e invoca **B.isStillValid**100. Não retém nem reinvoca o predicado de A depois de `prove`.
- `revalidate`137–142 e `qualify`144–165 têm observações antes/depois, mas cada `current` usa seu próprio callback novo.

O `authorityDigest` da linha85 contém decision, selection, scenario, storedResult, rule, basis, classification, baseline e evidência reduzida a ref/state/accessRevision. A igualdade desses dados não demonstra equivalência temporal dos callbacks.

### Contrafactual discriminante e produtor real

O traço frio mínimo é: A retorna dados D e seu predicado aceita inicialmente; durante o await de prove, a condição fechada por A passa a recusar; uma resolução posterior B retorna o mesmo D com predicado válido. O caminho atual pode aceitar segundo B sem observar a recusa tardia de A. Uma mutação no objeto bruto de A depois da checagem precoce também não é reinspecionada como o mesmo objeto pelo `current`. Esses traços não foram executados.

Há motivo concreto para não presumir equivalência no produtor instalado. [portfolio-coverage-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/apps/cli/src/sucafina-product/portfolio-coverage-authority.ts), blob `03a4a0d82676423c76b8055e2e7efeb9bfe9a973`, gera um digest interno mais forte nas linhas119–121. Ele inclui, além dos dados devolvidos, **fences das três surfaces, envelopes completos stored/baselineStored, scenarioProjection/baselineProjection e a identidade de evidência com currentRef/differences**. A função isStillValid129–133 compara observação atual a esse digest capturado.

[source-fence-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/apps/cli/src/sucafina-product/source-fence-read.ts), blob `5f1c4b43162aa2ba3eae9a7c57862cd41df0af18`, linhas53–54, calcula fences Dashboard/Planner/Procurement. Uma mudança de Procurement fora do cenário Planner pode mudar a fence guardada por A sem alterar os dados de negócio do digest público. A então recusaria seu snapshot antigo; B pode capturar a fence nova e aceitar com o mesmo digest público. Isto identifica uma diferença real omitida, **não demonstra que a diferença seja material para um cálculo ou que atravesse os finalizadores posteriores**. O owner precisa provar a lei de equivalência pertinente ou conservar a recertificação de A na fronteira correta.

A montagem é alcançável: [portfolio-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/apps/cli/src/sucafina-product/portfolio-services.ts), blob `881ce4672d9d0e641d1cc849663c0980c118774d`, instancia o resolver real71, coveragePreview78, verifier80–83 e produto100–105. [product/portfolio/product.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/product/portfolio/product.ts), blob `d4c5d9c9aabcf70bb71739d3952776517dc55923`, cria coveragePreview49 e PlannerSensitivity50; sua rota sensitivity107 usa a contribuição real. Portanto não é somente uma interface órfã.

### Contraprovas e guardas existentes

O shortcut PR56 que eliminaria a validação original precoce **não foi aplicado**. [original-authority.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/test/product/finance-journey-closure/original-authority.test.ts), blob `1a6989101c47f36ff21d8495780b179ceb595357`, força Afalse logo no primeiro callback27 e verifica ausência de previews39. O S2 real observou resolutions1/originalChecks1/replacementChecks0/previews0 e stale/coverage-authority-changed. Essa contraprova preserva a recusa precoce e **não observa a transição Atrue→Afalse durante prove**.

Há verificações substanciais além do intervalo: interval-proof valida units antes/depois; planner-sensitivity revalida unidades, resultados, amostras, cobertura e witnesses finais104–122; verification retém Request, fingerprint de headers, binding, métodos/store/scope e staged publication191–263. Revogação após witness final, troca de scalar/store façade, fonte mutada, scope falho e inputs mutados foram negativos PASS na fonte S2. Não inferir bypass de Apply nem reduzir essas contraprovas a uma conclusão genérica de insegurança.

**Prova pedida ao owner em trabalho futuro:** Atrue→Afalse durante prova estrutural e durante replay, Btrue com dados iguais, original bruto mutado, revogação imediatamente antes da última observação, falhas antecipadas/fallback e limpeza após recusa. Identificar o produtor efetivo e o motivo que faz cada callback recusar. Ou preservar explicitamente A na fronteira final, ou demonstrar que a reconstrução B implica todas as condições materiais e temporais de A. Dados iguais, hash próprio ou função canônica isoladamente não satisfazem a obrigação. Esta revisão não criou nem executou esses testes.

## C09/C10/C14 — estado e contraprovas estáticas

| Contrato | Suporte presente no alvo fixo | Limite / estado |
| --- | --- | --- |
| C09 | choice.ts, linhas 28–34 destaca cenário, resultado, coverage/basisVersion, condições e valores. mutations.ts, linhas 180–210 exige UI, autorização e confirmação humana, depois acrescenta choice e ledger. saveCase263–277 tem CAS de cases+outbox, commandDigest, incarnation e verificação no snapshot. portfolio-selection90–98 mantém história e ponteiro ativo em namespaces/versionamentos explícitos. | **PARTIAL_STATIC_SUPPORT / NEEDS_EVIDENCE**. Não demonstrado pela jornada S3 o histórico após confirmação, replay e reopen. Sem nova autoria, sem transformar suporte estático em aprovação. |
| C10 | cost-coverage.ts19 fixa inventário;25–28 deriva omissão pending;32–46 exige evidência, moeda/horizonte e componentes únicos. validate51–59 impede complete com amountnull, fontes ausentes ou componentes não confirmados. reassess63–85 conserva missing-category e totalnull condicionado. | **PARTIAL_STATIC_SUPPORT / NEEDS_EVIDENCE**. Nenhum novo erro numérico demonstrado; FIN-IND-005 aberto e todos os consumidores reais ainda exigem prova. |
| C14 Finance/Portfolio | port.ts, linhas 70–78 agrega restrições de cenário e candidatos, evidências, categorias omitidas, componentes e análise.87–88 só produz eligible-complete com cobertura/analyses/constraints completas e costCoverageRefs.97–104 revalida avaliação e relê candidatos. production reconsulta evidência/classificação e comparação canônica. | **PARTIAL_STATIC_SUPPORT / NEEDS_EVIDENCE**. Montado de fato no alvo; não repetir “Portfolio não instalado”. Documentos/exportação e demais partes de C14 estão no parecer principal. Nenhum certificado fonte equivale ao consumidor composto provado. |

Blobs adicionais: choice.ts `ac65bdd3445113f00b643b72dfaa2a8840826a99`; mutations.ts `3f31dd52babca16249fb04fec29abbf74e7a5da4`; portfolio-selection.ts `64deee2c7570d718686eb2181ff197f4347e6764`; cost-coverage.ts `09097eaba2e0eae71d33d88077a2f86e83e1dde9`; portfolio/port.ts `452877ad2c82835fe883ea05dbf15f80f84f51c5`; portfolio/production.ts `a1765988434920f8dc9c71eaea2427b6ecac59cb`.

O `amount ?? 0` em cost-coverage.ts57 aparece no somatório condicionado pela recusa de null/unconfirmed58; não é, isoladamente, “desconhecido vira zero”. A comparação canônica usa diferença alternativa−baseline; a apresentação de economia inverte para baseline−alternativa. Portanto custo 250000 contra baseline240000 implica métrica+10000 e vantagem−10000 sem contradição. [planner/comparison.ts](https://github.com/gustavomhss/Orchestra-SF/blob/0ce090d7d1d4399d77b435debd59eb7cc903c202/modules/sucafina/Sucafinav1/product/planner/comparison.ts), blob `459b94f2da3b4ea9e7addf7b2fed1d13015a2c84`, linhas18–22 e30–36.

current-choice-preview.ts, linhas 34–97 cria resultado e binding de promoção sem modificar a escolha; read100–127 reautoriza namespace privado depois dos callbacks e observa caso, resultados e binding juntos ao final. Blob `c27e908140ba34ffea39078a78626f47943a8444`. result-store93–118 conserva observações antes/depois dos callbacks; lote126–206 mantém callbacks explícitos por ocorrência, Request/headers/binding/lease e observação final. SQLite reopen/corrupção/revogação foram provados isoladamente em S2. A prova de novo formato não qualifica rollback/mistura de versões e não fecha o fluxo de escolha completo.

## Delta posterior — LATER_DELTA_NOT_REVIEWED

A consulta da PR42 observou draft aberto com head **`1a656f1f7251de8c104e5b03a43b457e80437181`**, tree `1ebd1ee9d0e95253526d0ee73cf2353a71ccbe58`; o corpo da PR ainda descrevia a sessão 18, portanto não foi tomado como prova desse head.

O compare desde d8d586e19c824f75a88494a9c3677faac617e81d mostra três commits posteriores, incluindo mudanças em case-port e state-provider. Blobs posteriores: case-port `2bbcf63bb0fa56dd3a93190f7711f99aef2efb74`, state-provider `e7810b956073fa83a977109cfdea4735493b8aa3`. No bundle fixo, respectivamente `d43849ba101000eb9eb2a6ddc9a04830b004ccc6` e `2fd55c7304add0829d7434917c80664fe86356b9`. Foram observados também intake finance-state-read-performance e testes novos. **Esses deltas não estão qualificados por esta revisão, não foram transferidos ao alvo e não mudam o parecer do SHA fixo.**

## Handoff ao revisor principal

Manter FIN-IND-005 aberto com o último terminal correto; registrar suporte de fonte e consumo sem repetir findings já corrigidos. Incorporar FIN28-CALLBACK-PROOF como lacuna de prova temporal delimitada, com contraprovas e outros finalizadores explícitos. C09/C10/C14 não recebem aprovação integral.

O ci_plan exige no mesmo candidato as oito seleções mínimas mais gates adicionais aplicáveis, AM01–AM06 e pareceres independentes. Prova antiga de fonte não recebe o SHA do bundle. Alteração posterior exige candidato identificado, invalidação por impacto e recheck independente. A nova documentação do revisor não satisfaz a execução desses gates. Esta análise não requisita nem autoriza merge ou GLOBAL_RELEASE.

## Complemento normativo: WPs originais lidos integralmente

A leitura foi completada no pin do plano, sem usar os índices do pack como substituto do texto: WP02 blob `d65a7b62e14bffd149670fa65f8a982932ce4ec9`; WP06 `1aacabdc304f9e298084960a52a5fe55fd8fe98a`; WP12 `941b5e86c6a0ff9fc5125f93f298535c7418cd34`; WP13 `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`. Paths `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP02.json`, `WP06.json`, `WP12.json`, `WP13.json`.

O texto original não reduz os gates. **WP13.T03.CHK.20** exige teto 15000 e witnesses15000/15001 depois de training40000 na mesma base. **WP13.T02.CHK.20** exige que UI/BI/critique usem a mesma versão sem ocultar categoria; **WP13.T03.DOD.01** exige consumo de sensibilidade pelos UI/BI reais. **WP12.T03.CHK.20** exige revisor real com training inteiramente ausente e sem indício roteirizado, mantendo conditioned e depois usando a evidência40000; **WP12.T03.CHK.10** impede crítica na mesma sessão/run do autor. Os43 testes da fonte não comprovam essas obrigações de inferência/consumo. WP02 mantém números reconciliáveis e ausência distinta de zero; WP06 exige preview/apply/recibo pelos adapters reais, privacidade, incarnation e confirmação de evidência documental. Nenhum desses textos autoriza aprovação por composição somente estática. Veredicto permanece REQUEST_CHANGES.


