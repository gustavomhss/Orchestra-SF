# WP09 — deltas de integração para S0 / proprietários

## Estado e fronteira

Os produtores em `product/routines/` e os consumidores em `test/product/wp09/` são próprios de WP09. Fontes publicadas de WP03, WP04, WP06, WP07 e WP08 são compostas como blobs exatos, com origem em `dependency-provenance.json`. Esta composição não transfere a autoria nem modifica as branches desses WPs.

O factory `createSfRoutineProduct` está exportado em `product/routines/factory.ts`. Ele expõe `routines`, `descriptors`, `discoverRuns` e `openResult`. O dossiê consome as portas reais de Procurement e a seleção documental de WP06 em `createSourcingDossierPreparation`; não contém parser.

A existência desses exports resolve a ausência estrutural reportada, mas não comprova que o host montou o ciclo Relay. Os testes de publicação usam AuthoringStore/RelayWorkflowBinding reais; os testes de consumidores usam os produtores empresariais reais e SQLite. Os runs/recibos de Maestro injetados em testes de fronteira não são prova GNATIVE.

## D1 — composição governada C07, proprietário WP10 / S0

### Evidência observada

- No seed `f18d5819bec7848664772c77d7501e7c25d578bf`, `apps/cli/src/sucafina-product/host-context.ts` constrói `BusinessPorts["routines"]` com os cinco métodos indisponíveis no host de análise. A inspeção do produtor WP10 publicado na PR29, head `d02c64430d459d183eeb9e467e1c35d9a6b958f8`, confirma o mesmo comportamento (blob `b6a20eea9051f472e56e96609dfc3387362776d8`).
- Nesse mesmo WP10, `analysis-verifier-routines.ts` (blob `4a7b561a42ad340c86244c671cb95b1492d514b6`) recusa entradas de revisão executiva com `factualRoutineResults`, `confirmations`, `routinePreparation` ou `admittedRun` como `review-result-link-unavailable`. Esse consumidor precisa ser composto com a leitura/validação real WP09, mantendo as cercas de evidência do verificador.
- `apps/cli/src/sucafina-product/business-services.ts` compõe os descritores de dashboard, Planner, Procurement, decisões e extras; não instancia o factory WP09.
- `modules/maestro/coordination/package.json` publica validadores de admissão/approval e autoridade de sessão, mas não publica o host workflow C07 como API do módulo. Os arquivos de workflow/arm/governance internos são dos engines e estão fora do ownership WP09.
- O contexto de execução desta entrega oferece GitHub MCP, mas não uma Session Orchestra residente com SkillLoadReceipt, aprovação humana vinculada a uma apresentação Maestro, provider e autorização de Task nativos.

### Delta concreto solicitado

No composition root mantido por WP10, fornecer ao factory as implementações reais existentes de `prepareAdmission`, `readAdmission`, `run` e `readRun`. O adapter deve resolver a sessão solicitante e o principal SF atual, vincular publicação/planRevision/writeScope/params/inputRefs/caso/versão e devolver somente recibos lidos do armazenamento nativo. O início permanece condicionado ao receipt nativo de aprovação, autorização de Task e arm correspondente.

Instanciar `createSfRoutineProduct` com a publicação nativa e a autoridade do mesmo host; anexar seus descritores à coleção usada por `dispatchSfCapability` e fornecer `discoverRuns` ao consumidor do índice de rotinas. Não adicionar aprovação automática, chamada direta ao engine sem C07, identidade por nome de agente ou ledger paralelo.

Qualificação necessária: uma solicitação real da skill de revisão executiva, SkillLoadReceipt, apresentação/aprovação C07, arm/authorization/task/childSession correlacionados, run completo e resultado autenticado; negativo sem admissão, recursive routine-result, republish, retry e revogação.

## D2 — resultado terminal/artefato C08, proprietários WP00 + WP10

`product/contracts/ports.ts` oferece `readRun`, mas seu `RoutineResult` não carrega estado terminal, versão do registro de execução nem digest imutável do conteúdo de saída. Uma referência não permite deduzir conclusão ou autorizar um arquivo.

WP09 entrega `createRoutineResultAccess` com os seguintes requisitos explícitos do host:

1. `expectedInputDigest(run, context)`: ler do registro admitido o digest de **todos** os parâmetros, recorte, plano, publicação, principal/projeto e caso/versão; nunca reconstruir apenas dos metadados do resultado.
2. `readExecution(runRef, context)`: ler um `RoutineExecutionSnapshot` nativo atual com `runRef`, `revision`, estado e, somente em conclusão válida, `resultRef` e `outputDigest` registrado na conclusão.
3. `readArtifact(resultRef, context)`: abrir o artefato imutável autorizado pelo host, preservando todos os vínculos e sem transformar uma URL em autorização.
4. `revalidateArtifact` e `authorize`: revalidar identidade, recorte, origem e arquivo no início e na saída.

O retorno autorizado é `{ run, execution, output }`; o digest do output precisa coincidir com o pin terminal nativo e com o envelope. Failed/cancelled não abrem artefatos; resultado ausente permanece pendência; mudança de registro/digest durante a recuperação invalida o retorno.

O descriptor `sf_routine_result` continua limitado ao schema C08 atual de metadados. Seu recibo não é contabilizado como recibo dos bytes. `openResult` e os consumidores de decisão devolvem também o snapshot terminal e seu digest. WP00 deve admitir o contrato de saída completo e WP10 deve montar a leitura nativa antes da qualificação UI/MCP equivalente de bytes.

Não preencher esses requisitos com um map em memória, com um digest recalculado da mesma resposta do reader, com callback permissiva ou com o armazenamento de análise/contribuições usado como ledger de rotina improvisado.

## D3 — Schedule e identidade da ocorrência, proprietários WP10 / S0

`ScheduledTaskCapability.Interface` real já oferece get/create/update/pause/resume/runNow. A identidade `Capability.Owner` vincula projeto/sessão/agente; não é, por si, um principal SF autorizado.

O adapter próprio de leitura `readNativeRoutineSchedule` consome `ScheduledTaskCapability.get`. Native `started` significa admissão durável de prompt e continua `admission-pending` sem o vínculo C07. Só mostra `reviewable` quando a execução está concluída e `RoutineResultAccess` entrega o artefato autorizado com o mesmo pin terminal. Falha/cancelamento são preservados.

O host deve fornecer `RoutineOccurrencePort` de `product/routines/schedule.ts` e resolver:

- proprietário explicitamente registrado com permissões correntes, sem herdar privilégio de serviço;
- condição, receita publicada e principal/projeto antes da admissão e no início;
- recibo de ocorrência nativo, vínculo C07, pendências autorizadas e idempotência de executar-agora;
- estado native paused/failed/missed/no-new-information;
- versão esperada e atomicidade de update/pause/resume.

A API nativa observada de update não recebe `expectedVersion`. Fazer `get` seguido de `update` não demonstra CAS. A solução deve ser qualificada pelo proprietário na superfície de composição permitida; WP09 não altera o engine ou cria contador paralelo para simular essa garantia. Sem esse seam, comandos retornam indisponível/negado.

## D4 — receitas e verificação de domínio, proprietários WP09 + WP10

As cinco receitas v1 de `recipes.ts` registram a ordem linear de preparação e as refs de implementação. Publicação/materialização não executa essas funções: as instruções de etapa e `implementationRefs` não constituem tool bindings.

Os checks nativos `package-verification` e `cold-review` pertencem ao gate de código/worktree; não certificam por si cálculos empresariais ou um judge de domínio. Não foram substituídos nem alterados.

WP10 deve vincular as etapas às capabilities SF autorizadas e ao contexto/skill nativo. WP09 já entrega os produtores determinísticos de revisão, forecast, dossiê, handoff e decisão. A síntese opcional só pode consumir a saída factual autorizada. Um judge, quando usado, precisa de execução/provider/resultado reais; nenhuma fixture é considerada avaliação.

## Integração e próxima ação

S0 pode compor esta PR sem importar a antiga branch snapshot, usando os pins registrados. Os deltas D1–D6 requerem revisão e implementação pelo proprietário da composição/contrato antes dos critérios nativos. Após isso, executar a seleção afetada e capturar os recibos reais. A qualificação global C/G7, D/G8, AM01–AM06 e as oito seleções finais continuam pertencendo ao bundle integrado.

Esta entrega não autoriza merge em dev, deploy, mudanças financeiras/alçadas, mudança dos engines ou ampliação de acesso.

## D5 — lacunas de produtores observadas nos consumidores

- WP03/C02: `FinancialAnalysis` e `ForecastInsights` não publicam `sec/el` da linha do Planner. WP09 mostra linhas novas/removidas, valores, moeda, FX e HR, mas não inventa uma reclassificação sem esse dado. Para fechar `WP09.T03.CMP.01`, WP03 deve publicar a dimensão/classificação e sua evidência, preservando escopo e versão.
- WP06: o host documental publicado oferece admit/extract/search/confirm/list, mas não uma ação pública de rejeição. O teste próprio usa um candidato realmente extraído e marca rejected por fixture explícita no state port para verificar seu consumo. Isso não prova uma jornada humana de rejeição.
- WP07: `selection.ts` remove `observedAt` do digest, mas mantém `ageDays` calculado por Procurement. Uma agenda de Request pendente pode ficar stale pelo avanço do relógio sem mudança material. O teste próprio de preservação usa Planner e não é apresentado como prova desse caso de Procurement.
- WP06 `documents/runtime-e2e.test.ts`: o run de WP09 `43536732467` passou a carregar o consumer antes bloqueado por falta de `routines/dossier.ts`, mas excedeu 120000 ms (144662,94 ms observados). O log não localiza o await; não há prova de deadlock ou de regressão sobre uma execução anteriormente verde. O intake WP06 registrava bloqueio de importação nesse arquivo. A qualificação isolada mantém o finding visível; não se altera timeout nem teste estrangeiro para obter green.



## D6 — idade autoritativa e reconciliação de tipos compartilhados

- WP03/WP07: C02 e a seleção de revisão não expõem a data da última atualização material do tópico. `SourceRef.observedAt` é a data de observação; `ageDays` de Procurement é idade da etapa. O output próprio agora apresenta `lastUpdate.state: unknown` e explica essa distinção. Para fechar `WP09.T02.CHK.02`, o produtor deve publicar `updatedAt`/idade com semântica e evidência corretas; o consumer WP09 precisa testá-la sem transformar confirmação ou leitura em edição.
- A auditoria W5 também encontrou falta de próximos passos específicos e de texto curto no dossiê. O delta W7 em `review.ts`/`dossier.ts` adiciona essas apresentações determinísticas, preservando os valores/evidências de WP04 e a confirmação humana. A revisão estática está em `criterion-audit.md`; o status executado consta do mapa e do recibo CI.
- O último check de tipos será registrado em `shared-typecheck-findings.json`. No candidato W6, `bun typecheck` falhou com 79 diagnósticos fora dos caminhos próprios de produto/teste WP09. Há consumidores antigos incompatíveis com assinaturas de produtores publicados; isso não é classificado automaticamente como preexistente nem como aprovação parcial do package. O arquivo lista path, posição, mensagem, pin e encaminhamento proposto. S0/proprietários devem reconciliar esses consumers e repetir o check integrado.

A matriz C16 verifica 36 casos no dispatcher real com portas nativas explicitamente injetadas. Ela não fecha `WP09.T06.DOD.18` nem a parte de admissão/execução real de `WP09.T06.CHK.01`. Ambos permanecem parciais até um witness nativo da ocorrência.

A proposta concreta de correção da barreira do teste WP06, sem alteração do arquivo estrangeiro, está em `independent-review.md`. O resultado da execução isolada deve ser lido no recibo CI; a hipótese de barreira não é apresentada como causa do timeout sem evidência.

## Atualização de intake durante o CI

Após o primeiro parecer, WP00 publicou `1e09268b53e08fa4190c3969424973def7e1327e`, WP06 publicou `de761a3bb01dfc7c0e54e27dd7bf82f5ef635643` e WP10 publicou `87f7317d5f983adb255a5707b65d6f07bfa5a0d4`. Os pins anteriores continuam identificando os blobs efetivamente testados em cada candidato; não são substituídos retroativamente.

No WP10 atualizado, `host-context.ts` (blob `c02776411a3eafe6070b088ed284575071be9e0c`) ainda retorna indisponível nos cinco métodos de rotina. `analysis-verifier-routines.ts` (blob `68905e46890ae489669e0efaca00826f21cbae6f`) ainda recusa os campos de resultado/admissão WP09. D1 permanece aberto.

**Pin obsoleto de WP09 no consumidor WP10:** o `composition-pins.json` desse head (blob `db7d40e1601b3b9b3d741eb5251af48f4f271184`) fixa 42 paths WP09 em `115326b1337b73c5e275624a8d401b41e8ed1c9e` (W1), anterior às correções de segurança R1–R8. S0/WP10 devem consumir o candidato de produto final desta PR, identificado em `ci-evidence.json`, preservando o conjunto atualizado de rotinas/testes. Não importar o pack antigo por cima dele.

A composição seletiva do novo consumidor documental WP06 será discriminada em `dependency-provenance.json` e no recibo hospedado, sem restaurar seu `routines/dossier.ts` histórico. O parecer detalhado de portas atuais consta de `latest-host-intake.md`.

### Consumidor documental atual composto seletivamente

O candidato `cb8b79b4695127c1fe846c041b9c1d53c63ac238` compõe seis blobs exatos do WP06 `de761a3bb01dfc7c0e54e27dd7bf82f5ef635643`: `dossier-services.ts`, `dossier-workbench.ts`, `business-services.ts`, `documents/scenario-inputs.ts`, o fixture runtime WP06 e `documents/dossier-runtime.test.ts`. O teste novo percorre o serviço HTTP real em TXT/DOCX/PDF; seus resultados, quando concluídos, constam do recibo CI. O `dossier.ts` histórico presente no head WP06 não foi importado.

**Conflito de composição para S0/WP10:** o business-services publicado por WP06 (blob `49f9e7824edb25443f48a2035ebfa698554de87e`) exporta `resolveProcurement`, exigido por esse serviço. O head WP10 atual usa `e8e9fb1a5eea0e5af05519ad92c220ba000d635d`, que não exporta esse método e exige `dashboardHostWrites`. Esses blobs não são substitutos verbatim. A composição desta PR registra o primeiro para qualificar o consumidor documental; S0 deve reconciliar o método e os descritores/autoridades adicionais no root mantido por WP10. Não foi editado qualquer desses blobs.

**Limites da rota composta:** o teste chama o HTTP do serviço real, não inicia o composition root inteiro. A versão corrente do workbench renderiza Request/documentos, mas ainda não apresenta `explanation`, `nextSteps` ou comparação comercial WP09 e converte rejeição sem `evidence` em indisponibilidade. O serviço também omite o bloco opcional de fatos `sourcing`. Esses são deltas de apresentação/composição do proprietário, não prova de jornada integral nem de Relay.

A alteração no fixture WP06 acrescenta grants opcionais; o consumidor amplo `runtime-e2e.test.ts` e sua barreira permanecem iguais. Não se atribui a essa atualização uma correção do timeout.

### Finding executado e adapter canônico de Procurement

O run `43539704710`, produto `cb8b79b4695127c1fe846c041b9c1d53c63ac238`, executou 175 casos em 31 arquivos: 172 pass e 3 fail. Os três casos novos de `documents/dossier-runtime.test.ts` passaram pela leitura pendente e apresentação documental, mas interromperam na linha 77 ao emitir a referência individual do Request (`unavailable` em vez de `ok`). As asserções posteriores nesses três casos não são consideradas executadas.

O emissor WP04 inclui `approvalStage`, enquanto a projeção de integração antiga mantinha uma lista divergente. Foi composto, sem edição, o blob WP10 `3e8830c3dddc8b9609f583f877b2fe7458eccd28`, em `integration/procurement-projections.ts`, que delega a projeção ao produtor WP04 já usado na emissão. Essa composição está no produto `a3dcbb62c88231f95a7c57afb32e975404a3b59c`; a conclusão hospedada está no recibo CI. Não houve ampliação de grants nem desativação de cerca.

## Resultado final dos consumidores no mesmo produto

Produto `a3dcbb62c88231f95a7c57afb32e975404a3b59c`: a seleção principal [43540247856](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540247856) passou com **175/0 em 31 arquivos**, inclusive os três formatos do novo dossiê HTTP após a correção publicada do projector.

O consumidor amplo WP06 foi executado sozinho no [run 43540684025](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540684025), snapshot `d713781f6f9a867eef264135b1eeebb960f7d4e4`, sem mudar o produto. Repetiu timeout: **0 pass, 1 fail, 57 expect calls**, limite 120000ms, duração informada do teste 132734,06 ms / suíte 133,45 s. Isso comprova a reprodução isolada, não a causa interna. Classificação permanece `INTEGRATION_TIMEOUT_NOT_LOCALIZED`; a proposta da barreira no recibo independente não foi aplicada ao arquivo estrangeiro.

O check [43540252662](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43540252662) registra guards PASS e typecheck FAIL com **78 diagnósticos compartilhados, zero próprios**. O novo erro de tipo em `documents/scenario-inputs.ts:112` pertence ao blob WP06 composto; o conflito de `business-services` e os demais consumidores estão discriminados no JSON de findings. Nenhuma dessas falhas é marcada como resolvida.
