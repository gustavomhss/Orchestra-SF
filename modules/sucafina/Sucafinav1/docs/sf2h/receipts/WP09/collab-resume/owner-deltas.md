# WP09 — deltas delimitados por owner

Este registro usa o produto de retomada `2784daafbb0d3b58b6019822288a07fa38e5c5b0`, o incremento próprio `ff557552936197b6734e57f0ecea0c44b19139b1` e a leitura delimitada de `astra-compose` em `9048e0e65351a5bd80768458a79fed94a4993db7`. O avanço de Finance foi reconciliado em `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3`; o de WP12, em `812f8427423dc143cefc2731edc3485eeb8d1f04`. As afirmações de fonte se limitam a esses pins. As referências a outro owner são propostas de integração, sem edição das fontes alheias. O inventário está em [source-reconciliation.json](source-reconciliation.json) e os resultados em [evidence.json](evidence.json).

## F09-01 — ligar o produtor C07 real ao host existente

**Owners: WP10 e S0/C07-C08; consumidor WP09. Estado: bloqueio externo.**

O host avançou desde a PR #30: `routine-services.ts` já implementa `createSfRoutineServices`, usa os preparadores WP09, confirma publicação e digests, verifica autoridade atual e chama o leitor autenticado de resultado. `routine-inputs.ts` e `routine-publication.ts` também existem. Não se deve recriar esses adapters nem repetir o finding antigo de factory ausente.

Em `host-context.ts` no pin externo acima, a composição chama `createSfRoutineServices` com `authority`, `publication`, `resolveCase`, `prepareWatch` e os leitores de entrada, mas não fornece `native`. O comentário da própria composição registra que as portas C07 de execução/publicação nativas não estão instaladas e conserva leitores de indisponibilidade sem anunciar rotinas chamáveis. Isso impede o caminho positivo, mesmo que os consumidores próprios estejam presentes.

O delta solicitado ao owner é fornecer um `SfRoutineNativePort` real ao hook já existente. Esse port declara `resolvePlan`, `resolveRecipe`, `prepare`, `readAdmission`, `readRun`, `start`, `listRunRefs`, `readExecution` e `readArtifact`. Cada método deve usar o serviço nativo que efetivamente produz a admissão, o run e o artefato; identificadores/digests não podem ser montados por fixture. Os descritores só devem aparecer quando a contribuição real estiver instalada. Não adicionar ledger de runs, autoaprovação, endpoint proibido ou espera humana fictícia.

O recibo necessário é uma execução governada que amarre principal/recorte atuais, receita publicada, admissão C07, input digest, run, estado terminal e output digest. Também precisa negar acesso revogado antes do início e na recuperação do resultado. Publicação no AuthoringStore e prompt durável do Schedule permanecem evidências diferentes da execução.

Critérios afetados incluem `WP09.DOD.01/.03`, `WP09.T01.CHK.02`, `WP09.T01.DOD.01` e os critérios residentes. A correspondência completa está no mapa de 112 critérios.

## F09-02 — consumir o resultado autenticado na experiência real

**Owner: WP10; consumidores WP07/WP09 e, para decisões, WP11. Estado: composição e witness externos.**

`analysis-verifier-routines.ts` no mesmo pin ainda recusa `factualRoutineResults` no verificador de prévia e recusa `factualRoutineResults`, `routinePreparation` e `admittedRun` no verificador da revisão. Essa recusa protege a composição incompleta, mas não fecha a entrega positiva. O delta é ligar os leitores reais já definidos pelos domínios e preservar a mesma autoridade e versão entre catálogo, preparação, admissão, status e resultado.

O WP09 já fornece o leitor `createRoutineReviewResultReader`. Na origem #33, ele conserva a pauta completa sem depender de uma seleção transitória, inclui comentários e gráficos, valida associação de comentários C05 por digest, rejeita campos inesperados e fontes não admitidas, e revalida separadamente evidência C17 e acesso à revisão. O W07 executou 29 casos desse leitor e um consumidor Planner → seleção WP07 → preservação humana → C05. Esses resultados sustentam o consumidor próprio; não demonstram a experiência residente/native/MCP ou a entrega de um run real.

O owner deve abrir o artefato autenticado do mesmo run na tela responsável e exercer revogação em página, prévia, recibo, link direto e arquivo persistido. Deve manter o snapshot histórico intacto ao recalcular acesso atual. Não preencher a lacuna exibindo como execução nativa um resultado construído no teste.

Critérios afetados: `PRODUCT_UI`, `RESULT_ROUTES` e `RESIDENT_SKILL` no mapa. O witness residente requer Session/binding/profile, skill carregada e `SkillLoadReceipt`, concessão e consumidor real, incluindo os negativos pertinentes a AM02/AM06.

## F09-03 — concluir a ligação da ocorrência à execução, sem confundir estados

**Owners: WP10 e S0/C08; consumidor WP09. Estado: parte própria implementada, cadeia nativa externa ainda incompleta.**

O `readNativeRoutineSchedule` herdado já separa Schedule ativo/pausado/perdido, prompt admitido, admissão C07, execução e resultado autenticado. O CI04 tem 22 casos PASS desse arquivo, incluindo SQLite/ScheduledTask/SessionInput reais para criação, pausa, retomada, alteração e deduplicação de prompt. O executor de provider é explicitamente substituído no teste; esse recibo não prova conclusão Relay.

O incremento `ff557552` completa a fronteira própria em `createRoutineSchedule`: cada invocação fixa os objetos e métodos de autorização, resolução de owner, recorrência, C08, ocorrência e leitura de resultado; checa identidade antes/depois de cada await; preserva métodos de prototype e receiver original. Troca de provider retorna `schedule-provider-changed`. Antes do efeito, não há dispatch; se a troca só é observada depois de um efeito, o consumidor não anuncia sucesso nem rollback e conserva o input/key original para a recuperação idempotente pelo produtor.

O delta externo é ligar a ocorrência durável ao proprietário SF explicitamente identificado, reautenticar antes de admissão/início/leitura e guardar referências nativas reais. São necessários testemunhos de pausa impedindo futuras ocorrências, perda com `catchUp=skip` sem replay em massa, retomada/manual, ausência de novidade, falha e aviso interno deduplicado. Um `readRun` ou `readExecution` injetado com `completed` não fecha essa cadeia.

O contrato nativo de atualização conhecido não expõe compare-and-swap por `expectedVersion`. Um `get` seguido de `update` não demonstra sozinho atualização atômica sob concorrência. Cabe ao owner publicar a garantia disponível e qualificá-la; WP09 não altera engine nem cria controle paralelo para inventar atomicidade. Caso o contrato avance, reconciliar somente o delta necessário.

Critérios afetados: `WP09.T06`, especialmente `.CHK.01/.02/.03/.04`, `.DOD.01`, `.CMP.01/.02` e os critérios de entrega recorrente. O run [43615514065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615514065), job `132509571848`, terminou com **42 PASS, 0 FAIL e 111 asserts**, nos três arquivos cirúrgicos. Produto W `ff557552936197b6734e57f0ecea0c44b19139b1`; snapshot S `6f73befe7414d08cf882ef0b125d8857ad69ec4f`, com somente `.ci-run.json` adicional. O controle Omni foi **não aplicável**, nonce `611300de1451a68088c085171e82befd`, zero spawns. Esse resultado qualifica o delta próprio de Schedule; não promove todo o head, não prova Omni/Relay e não fecha os critérios de execução/entrega nativa.

## F09-04 — manter a continuação de decisão no produtor WP11

**Owners: WP11 e WP10; consumidor WP09. Estado: execução/continuação real externa.**

O consumidor próprio responde à pergunta usando o comando versionado do caso e exige nova admissão; isso preserva versão, idempotência e ausência de espera humana no Relay. Ainda falta o run real produzir a alternativa ou pergunta, encerrar e, após a resposta, iniciar outro run admitido com nova versão e retornar à mesa sem copiar saída.

Há um delta concreto de API a reconciliar quando S0 compuser WP11. A fonte Finance atual inspecionada, [`product/decisions/case-port.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/88b9b6bff53a4f64d37d04ddc868f1443cecf5b3/modules/sucafina/Sucafinav1/product/decisions/case-port.ts), tem blob **`d43849ba101000eb9eb2a6ddc9a04830b004ccc6`**, substituindo o pin anterior `67203e058f6e08d9e32e0c51e0b1a01e5fadf322`. Ela exige `verifyScenarioOperations` e chama o verificador antes de devolver evidência/acesso do caso. O documento de integração anterior não descreve esse head inteiro. A versão presente em `collab-resume` no início não declara esse campo; a composição WP10 inspecionada já usa `createSfScenarioOperationAccess`.

O teste próprio `decision-answer-consumer.test.ts` deve receber esse verificador canônico real quando o produtor compatível entrar. Não adicionar callback permissivo, cast para encobrir incompatibilidade ou import de API inexistente no candidato. O [recibo de avanço Finance](../../WP08/collab-resume-20261114/finance-advance-reconciliation.json) conserva os pins e o compare delimitado. Este é um finding de composição futura; não houve intake de Finance, edição do CasePort ou promoção de prova financeira no incremento WP09.

Se judge for usado, a crítica precisa de provider/model/sessão/recibo reais e alvo identificado. Ausência explícita é válida como ausência; stub não qualifica avaliação.

Critérios afetados: `WP09.T07` e `DECISION_CONTINUATION`/`JUDGE_IF_USED`.

## F09-05 — preservar lacunas sem inventar metadados de domínio

**Owners: WP03/C02; consumo WP07/WP09. Estado: pendências históricas de produtor, sem promoção por suposição.**

Para `WP09.T02.CHK.02`, o consumidor mostra `lastUpdate: unknown` com `source-update-time-unavailable` quando o produtor não publica a data da última alteração material. O consumidor real executado no W07 verifica esse estado. `observedAt`, data de confirmação ou falta de edição não podem virar idade da fonte. O delta pedido é a referência temporal material real no contrato/porta do owner e seu consumo delimitado; a confirmação material já preserva janeiro após mudança isolada de fevereiro.

Para `WP09.T03.CMP.01`, os contratos FinancialAnalysis/ForecastInsights conhecidos no candidato de origem não expõem os campos necessários para classificar mudança de seção/elemento (`sec`/`el`). Os testes herdados cobrem novas/removidas, HR agregado, FX/faltantes, meses e stale. Reclassificação fica explícita como lacuna, sem inferir significado ausente. Revalidar o produtor antes de implementar o consumo caso avance; este registro não afirma inspeção de um head novo WP03.

## Reconciliação WP12 — evidência nova e limites preservados

O avanço `dc8f3b19d40f52c19aabd219544c291460592b99` → `812f8427423dc143cefc2731edc3485eeb8d1f04` acrescentou 46 documentos e um teste; nenhuma implementação C17/histórico/período/ACL ou C07 mudou. Não há código desse avanço a transplantar para WP09.

O run [43615955284](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615955284), job `132510939072`, terminou com **2 PASS, 1 FAIL e 446 asserts** no produto `6880666b15dc18bf400c908a8457580526b70f4d`, snapshot `89799ce8ca1d9a78e25695353879dfe2bd0c229a`. Passaram os consumidores de seleção/revisão/relatório/download UI e o percurso executivo Meu Trabalho/Hot Topic/reabertura/recusa após remoção. O caso de pergunta Meu Trabalho falhou por timeout de 360000 ms; markers parciais não alteram esse resultado. Os títulos e blobs exatos estão no recibo de evidência.

Sete observações de catálogo vazio e quatro missões indisponíveis registram zero inferência, saída ou consumidor nativo. C07 não foi executado. A recusa após remoção da solicitação não é prova positiva de histórico de fonte removida. Também não fecha captura C06, rollover de período, lease independente de destinatário, fontes não record ou confirmação de resposta. O seletor público Procurement existe; a ausência de `workSignals` continua limitada ao caminho distinto de seleção por caso. Esses PASS externos acrescentam suporte UI delimitado a WP07/WP08; não substituem resultado autenticado de uma rotina WP09.

## Próxima ação de S0

Revisar o incremento próprio com o resultado **42 PASS / 0 FAIL** já anexado ao seu W/S e os checks estáticos do SHA final. Reanexar os casos externos equivalentes com seus limites, sem novo run. Compor somente os deltas externos aceitos por seus owners, incluindo o verificador Finance real quando entrar o CasePort compatível, preservando a árvore e os recibos anteriores. Então qualificar o encadeamento positivo nativo e os negativos descritos no candidato integrado. Nenhum critério que exige UI, skill, admissão ou execução real deve ser marcado concluído apenas pelo green cirúrgico.
