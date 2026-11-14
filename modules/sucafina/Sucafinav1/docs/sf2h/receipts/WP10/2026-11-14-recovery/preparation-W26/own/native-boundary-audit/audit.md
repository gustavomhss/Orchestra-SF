# W25 — fronteira nativa C07 e conhecimento Atlas

## Conclusão

**Não há um patch próprio legítimo que complete as nove operações de `SfRoutineNativePort` e os cinco callables C07 usando apenas as APIs públicas e os contextos confiáveis atualmente entregues ao host W25.** A composição pública de publicação e skills já existe. Permanecem ausentes o contrato público que liga o produto à admissão/execução governada real e a leitura autenticada da autoria Archie dos anchors de conhecimento.

Essa conclusão é sobre implementação e contratos. Uma instalação com modelo e execução nativa disponíveis continuaria sem esses vínculos; a disponibilidade do ambiente não resolve a composição ausente. Depois da entrega das interfaces e do adapter, a execução nativa real e seus recibos continuam sendo uma prova separada.

Base: `3d59829e5d9e438cbb443428a9479d7f63b5bf31`, árvore `ee95a2e3d0f02efabe6a4442fcf59479265a9f61`. O manifesto verifica 47 fontes contra a árvore completa W25. Quatro arquivos de owners foram baixados por MCP em pins explícitos, arquivados e comparados. Nenhuma fonte do produto foi alterada; nenhum teste, import executável, build, typecheck, browser, CI ou mutação remota foi executado por esta auditoria.

Esta é assistência de builder. Não substitui nenhum dos três revisores independentes e não declara aceite nativo ou global.

## O que o host compõe hoje

`routine-installed-publication.ts` abre o `AuthoringStore` real do projeto autenticado por meio da `LocationServiceMap`, restringe o leitor a `get/version/documents` e consulta o catálogo `SkillV2` real. Confere a identidade da Location, do provider e da publicação; verifica o conteúdo de skill em duas leituras. `routine-publication.ts` conserva essa contribuição no lifetime do host. Esse é um limite público útil e já implementado.

O `host-context.ts` W25 cria `routineServices` sem `native`, injeta seus `routines` no analysis host e expõe `routineRuns.discoverRuns`. **Não incorpora `routineServices.descriptors` à lista anunciada.** Logo, a presença dessas funções não demonstra que os cinco callables funcionem. Sem adapter, a descoberta não tem índice nativo e os métodos internos retornam as indisponibilidades explícitas de plano, admissão, execução e artefato.

`createRoutineCapabilities` define cinco operações `sf_routine_*`, mais `sf_watch_prepare`. A sexta operação pertence ao fluxo de watch. O host entrega `memory.prepareWatch` como callback, mas isso, sozinho, não prova que seu descriptor foi anunciado. A auditoria não amplia a contagem C07 para seis nem declara watch operacional.

## Nove operações: API disponível e prova ausente

O mapeamento estruturado completo está em [operation-map.json](operation-map.json).

| Operação do adapter | API pública útil já existente | Vínculo ou recibo que falta para implementar a operação completa |
|---|---|---|
| `resolvePlan` | `RelayWorkflowBinding.catalog`, leitor público `AuthoringStore`, `SkillV2.get` | Revisão de plano nativa autorizada para aquela publicação, `writeScope` ordenado, parâmetros e digest do `RoutineAdmittedInput` completo, ligados ao principal/caso/fontes SF. |
| `resolveRecipe` | `RelayWorkflowBinding.acquire/revalidate` materializa publicação selecionada | Resolução canônica da referência de receita ao plano exato; a referência do modelo não concede essa autoridade. |
| `prepare` | Hooks públicos `TaskGovernance.Interface`, ferramenta `Task` canônica e verificadores puros de aprovação | Aprovação/validação reais, arm nativo da mesma sessão/placement e recibo de admissão durável ligado ao input SF; os hooks isolados não são uma entrada de execução. |
| `readAdmission` | Leitores genéricos de Session e schemas/verificadores públicos | Leitor de admissão nativa com referência/versão, aprovação, plano, arm e input, associado ao proprietário SF. |
| `readRun` | `SessionStore`; `RelayWorkflowSession.current` para uma Session que já possua binding nativo de Task | Associação C07 entre run, admissão, child, workflow e input completo. A existência da Session não demonstra essa associação. |
| `start` | Settlement canônico da ferramenta `task`; governança dentro desse caminho | Invocação real de Task, input gravado idêntico, plano governado aprovado, arm e revalidação SF no dispatch; retry precisa conservar child/run e versão de admissão. |
| `listRunRefs` | Infraestrutura genérica de leitura nativa | Índice autorizado de runs C07 que conserva as associações anteriores. Varredura de sessões arbitrárias não é descoberta C07. |
| `readExecution` | Leitura pública de workflow já ligado a Task | Recibo terminal imutável do run exato, com revisão, estado, `resultRef` e `outputDigest` emitido pela conclusão; `currentStep` ou resposta do modelo não o substituem. |
| `readArtifact` | Armazenamento nativo e validador `createRoutineResultAccess` | Artefato real vinculado ao recibo terminal, com os digests, correlação, proprietário e fontes corretos, sob acesso atual. |

Os leitores e mutadores autoritativos encontrados — `GovernanceRecordsV2`, `WorkflowAdmissionV2`, `MaestroWorkflowHostV2`, `WorkflowRecordsV2` e a liquidação de workflow — permanecem internos ao pacote Maestro. O `package.json` público não os exporta. Os exports `governed-task` e `approval` examinados fornecem tipos e verificações puras sobre fatos recebidos; não produzem fatos nativos nem recuperam uma admissão aprovada do runtime.

O serviço público `TaskGovernance` existe, mas seus hooks são executados **dentro** das verificações de Task. Invocar `admit` diretamente não executa as verificações de parent, placement, modelo, permissão e chamada gravada; envolver ou substituir o serviço também não cria a correlação C07 ausente. `RelayWorkflowSession.current` é um leitor legítimo de um binding nativo já armazenado. Não é um escritor de admissão, índice C07 ou contrato completo de artefato.

## A identidade de Task não pode ser construída pelo adapter

`Tool.Context` exige `sessionID`, `agent`, `assistantMessageID` e `toolCallID`. `TaskTool.requireParent` recupera o parent real, exige a mesma Location e lê a mensagem assistant real. Ela precisa pertencer ao parent/agent e conter uma parte `task` com o call ID esperado e input gravado exatamente igual ao executado. A aprovação é seguida por nova leitura desse parent e outras revalidações.

O `TrustedDomainContext` SF não entrega essa entrada de Task. No caminho UI, sequer carrega Session. No caminho nativo, a registry mantém os IDs reais do assistant e da ferramenta em uma lease privada, vinculada à operação SF e ao digest. `operationIdentity` retorna um digest da identidade, não uma capacidade para transformar a chamada em outra ferramenta. Uma chamada real de `sf_routine_run` também não é uma chamada gravada de `task`.

Consequentemente, nenhum adapter proposto deve criar mensagens/partes de ferramenta, construir `Tool.Context` a partir de campos de payload, relabelar a chamada existente, chamar governança isoladamente ou substituir o caminho por `SessionV2.resume`. Esses caminhos mudariam o contrato, em vez de compô-lo.

Precisão em relação à nota histórica: o texto W12 falava em chamada “running”. O código W25 de `requireParent` exige literalmente input gravado decodificável **não `pending`**; não contém um teste isolado `status === "running"`. A nota anterior foi preservada. Esta auditoria não inventa uma recusa de retry somente por um estado de ferramenta concluído: a exigência relevante continua sendo a proveniência canônica real e a igualdade do input.

## Conhecimento: falta o resolvedor público e a autoria canônica

O ponto público aceito por `RelayWorkflowBinding.PublicationPort` é:

```ts
knowledge(reference, authorSessionID) -> Effect<AtlasKnowledge.Anchor, Held>
```

O resolvedor real `WorkflowKnowledgeV2.resolve(services, { projectID, authorSessionID, reference })` exige `SessionStore`, seats e a fonte Atlas, além de:

- Session autora do mesmo projeto, com `agent === "archie"` e seat Archie nativo;
- exatamente uma chamada `atlas_context` concluída, não executada pelo provider, na história desse autor;
- ação `anchor`, target, units, assistant message e call ID idênticos ao anchor;
- digests e limite de bytes válidos, seguidos de nova leitura dos units na fonte Atlas atual.

`WorkflowKnowledgeV2.resolve` e `WorkflowRelayV2.publication` não são exports públicos do pacote Maestro. O provider próprio W25 devolve `SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE` de forma explícita.

**Exportar apenas a função ainda não basta.** O `authorSession` próprio atual retorna a Session do binding SF e exige `session.agent === binding.profileId`. Os cinco IDs de `ResidentProfile` são `sf_maestro`, `sf_finance`, `sf_procurement`, `sf_portfolio` e `sf_reviewer`; nenhum é `archie`. O caminho UI retorna ausência de autor. Falta a associação canônica, derivada do plano/upstream real, à Session autora Archie. Não é legítimo usar qualquer Session Archie encontrada, receber seu ID do modelo ou trocar o actor do binding.

## Cinco callables e consumidores

| Callable | Cadeia necessária | Situação de composição W25 |
|---|---|---|
| `sf_routine_catalog` | Publicação real + `resolvePlan` | Publicação existe; planos nativos e descriptor permanecem indisponíveis. |
| `sf_routine_prepare` | `resolveRecipe` + `prepare` | Sem adapter de plano/admissão; preparação não deve fabricar estado admitted. |
| `sf_routine_run` | `readAdmission` + `start` | Sem handoff autorizado para Task real. |
| `sf_routine_status` | `readRun` | Sem leitor C07 nativo; discovery adicional exige `listRunRefs`. |
| `sf_routine_result` | `readRun` + `readExecution` + `readArtifact`, com releituras | Sem prova terminal/artefato; referência sozinha não autoriza resultado. |

O Workbench admite uma lease UI para descoberta e revalida a leitura; isso não substitui o índice ausente. Os produtores de resultado, decisão e revisão exigem o artefato autenticado, o digest do input admitido e o recibo terminal, com novas leituras após awaits. O schedule conserva `started` como admissão de prompt e exige um mapeamento C07 e conclusão real para apresentar resultado. Os verifiers próprios de reunião/revisão executiva recusam os campos de resultado factual de rotina enquanto falta o adapter.

O símbolo literal `routineReconcile` não foi encontrado nos paths de host/analysis hidratados, nos dois arquivos W25 `analysis-port.ts`/`analysis-host.ts` enumerados pela árvore completa ou nos dois arquivos exatos PR36 consultados. A cadeia equivalente examinada é `readSfAnalysisRoutine → readDecisionRoutine → readDecisionRoutineOutput → binding/readAdmission/readRun/resultAccess`. Não foi inventada uma API nem feita uma afirmação sobre texto arbitrário não inspecionado.

## Pins de owners e limites de consumo

- PR33 `2784daafbb0d3b58b6019822288a07fa38e5c5b0`: `capabilities.ts` blob `b8adcb574a84c213bfdec0659c7cc074a543564c` e `result-access.ts` blob `098a92920857926f117e266f5b63325f6ad112ca` são byte iguais ao W25. O body permanece draft/implementing e não declara execução Relay nativa.
- PR36 `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9`: `analysis-host.ts` blob `79bc5b933253daf8db73171d20e84f77436f5bbe` é byte igual. `analysis-port.ts` blob `f1127503cf3d25a44d76c766d6d52fcd3c41bd1d` contém deltas de cancel/read em relação ao W25; não fornece o seam C07. Foi apenas arquivado, sem admissão nem cópia para o repo. Seu body distingue skills carregadas de inferência/execução real.

As observações de metadata confirmaram os dois heads explicitamente fornecidos. Nenhum resultado de CI dos owners foi transferido ao W25 ou a esta auditoria.

## Ação concreta por responsabilidade

1. **S0 / owner upstream Maestro-Core-Atlas:** disponibilizar uma fronteira pública documentada para os leitores de plano/admissão/arm/run/terminal e o handoff que continua usando a invocação Task real. Expor a resolução autenticada de knowledge junto com a autoria upstream canônica. Os engines estão fora do escopo de escrita WP10/WP09; não copiar sua implementação para `apps/cli`.
2. **WP09 / astra-collaboration:** acordar e publicar a associação entre esses recibos e `RoutineAdmittedInput`, `RoutineResult`, `RoutineExecutionSnapshot` e `RoutineArtifact`, incluindo versão, digests, proprietário, case e fontes. O contrato público de resultado SF já exige tais fatos.
3. **WP10 / astra-compose:** implementar o adapter próprio sobre a fronteira publicada, fixar pins e providers e injetá-lo no host. Só então anunciar os cinco descriptors e ligar leitores de resultado/discovery/consumidores com as revalidações atuais. Nenhum patch C07 completo é aplicado nesta auditoria porque a fronteira necessária ainda falta.
4. **WP12 / astra-intelligence e S0:** após composição, executar a prova de Session/inferência e do ciclo nativo real que toca esses callables. Carregamento de skills, fixture de publicação ou hosted CI de adapters não satisfazem essa prova.

[counterproof-plan.json](counterproof-plan.json) detalha oito grupos de prova futura: positivo nativo completo e reload; identidade Task; placement/permissão; revisão/arm/retry; revogação SF no dispatch; terminal/artefato; autoria Archie e drift Atlas; consumidores/schedule/recursão. Todos estão marcados como não executados. Nenhum budget ou assertion foi alterado.

## Arquivos de evidência

- [audit.json](audit.json): decisão e seis findings com IDs estáveis.
- [source-manifest.json](source-manifest.json): commits, blobs, SHA256, caminhos e URLs dos bytes examinados.
- [operation-map.json](operation-map.json): nove operações, cinco callables e onze pontos de consumo.
- [static-checks.json](static-checks.json): somente hashes, JSON e contagem textual do contrato.
- [seal.json](seal.json): hashes do pacote; não é recibo de execução.

Os bytes MCP e os arquivos W25 estão arquivados abaixo deste diretório. A nota C07 anterior foi preservada em `support/`, sem alterar seu original.
