# Addendum WP10 f075e982 — WP14 consumidores

Auditoria incremental somente leitura do commit `f075e9824b7d8aed50b7f42c597528ef198177db`, tree `2751625f28928baf371d39576fe46777aa81f74e`, parent `417038d6b3cfd1817f40ffc60e56f42e505b50a5`. O delta tem134 arquivos. A auditoria histórica permanece intacta. Os sete snapshots usados estão verificados pelos Git blobs publicados; detalhes processáveis em `addendum.json`.

## O que mudou

`business-services.ts` (`14600913fcf85e6311d0d4ec3b90500231444372`) agora fornece `replay: planner` à persistência e passa `withCalculationCase`/`lockedSourceFences` ao Atlas. O retainer de caso admite um callback de egress após sua última releitura, antes de soltar o escopo.

`host-binding/business-context.ts` (`60e23ea586cdfdb961cf084388b47f54ccef84b7`) liga a nova fábrica `atlas-recall-scope.ts` (`30697fcbeee6b7011cc7786a0a3bc64bd0d3449e`) ao resolver de cálculo e à leitura canônica da memória. A fábrica usa AsyncLocalStorage e guarda somente uma prova concluída do produtor real, dentro da mesma invocação. Revalida Request/binding, acesso, C08, caso/incarnação/versão, fontes, coverage e dia UTC. Limpa o holder em finally e verifica o egress após os awaits finais. Não guarda Promise em andamento nem substitui o produtor financeiro.

A otimização é limitada a UI, `planner:scenario`, closure de records Planner, sem assumptions/operations. Native, evidência mista e requests não elegíveis preservam o caminho original. Isso é mecanismo real de composição, mas não produz candidateAccess nativo nem é consumo de `decideSfRecallInvalidation`.

## Situação dos nove findings

| Finding | Situação em f075 |
|---|---|
|01 memória/outcome/revisão|Composição real preservada; `host-context.ts` é exatamente o blob compose `edf6b70a249f9a1bc85d46cd06e5a32a85c8e74b`; execução não ampliada|
|02 C16 workSignals|Continua ausente em `business-services.ts:170–179`|
|03 features Planner|Continua: função local `featuresForCase:359–372` só considera record/prepared-change; função canônica WP14 não consumida|
|04 candidateAccess nativo|Continua sem produtor e sem ligação em `createSfCaseRecall:435–450`; novo scope é UI|
|05 invalidação|Continua sem consumidor da política explícita, agora reconhecendo o novo fence/descarte da prova lexical; nenhuma alegação de vazamento|
|06 revisão material após edição real|Continua: `memory-services`/`decision-materiality-services` não mudaram e exigem evidência original fresh/idêntica|
|07 histórico portfólio/revisão|Composição real preservada; não confundir histórico genérico com outcomes WP14 não vazios|
|08 Atlas real|Composição estendida pelo novo scope; qualificação do desempenho ainda depende da execução exata|
|09 C07/watch|Recibo do owner reafirma ausência de executor/descritores públicos nativos; não resolvido|

## Timeout Planner: mudança presente, resultado pendente

`test/product/wp10/integration/planner-calculation.test.ts` tem blob `2bc069d03fc39cede7635c94e0cf3f09f7f26882`. Mantém105s internos/120s por teste, instrumenta fases/resoluções e adiciona oito negativas após prova concluída (source, membership, capture, coverage, selector, clock, principal, lease) e uma contraprova de isolamento lexical concorrente:16 casos declarados ao expandir o loop.

O teste chama `reopened.atlas.memory.recall` e verifica records. Mesmo um futuro PASS dessa seleção não fecha o finding03 de `business.caseRecall`/features/ranking, nem precedente nativo distinto. Não há resultado demonstrado de correção do timeout nesta captura: o run de produto estava em execução.

## Pins e CI

O novo intake registra202 entradas efetivas,117 outputs admitidos,20 superseded e4 exclusões. As14 entradas alteradas de WP14 continuam fixadas na PR36 `2fb7e9c792327725384d99d656cc44b232ddc485`; a PR38 atual ainda não foi consumida. Assim os11 erros WP14 reapresentados no check vêm do pin antigo.

| Seleção | W / snapshot S | Run / job | Resultado observado |
|---|---|---|---|
|Produto,24 arquivos|W f075 / S `dd648c423ab97fbe6e806b620057a328a5816b5f`|43580252381 /132403235716|IN_PROGRESS; inclui Planner calculation; nenhum resultado final atribuído|
|Check|W f075 / S `5353af73e8bd1300efe631e2e9fbb30e0972de33`|43580267717 /132403281550|FAIL nos três typechecks;137 diagnósticos Sucafina,27 CLI,72 WP10 tests;236 emissões/139 diagnósticos únicos normalizados|

A identidade W→S foi conferida: o snapshot de produto tem parent W e adiciona somente `.ci-run.json`; o snapshot de check referencia W e adiciona somente seu request. Os checks de geração Atlas, tipo Atlas e spawn imports passaram; guards:78 regras,1197 paths,0 gates,44 warnings,0 errors. O arquivo Planner calculation possui seis diagnósticos próprios nas linhas245–248 por união `authorizedProjection` sem narrowing. O raw de check e o inventário completo estão neste diretório.

Artifact14108415696:18891 bytes, digest anunciado `sha256:929c26b569a4d958beb1c96e5c68a1a93058c292ddbff248099f4d277f976932`; somente metadata lida, sem validação dos bytes do ZIP. Nenhuma prova foi transferida entre candidates, nenhum run foi disparado por esta auditoria, nenhum teste local executado.

O comentário do root ao owner foi publicado em PR29#issuecomment-6875345759, preservando o escopo lexical como avanço separado dos findings ainda abertos.
