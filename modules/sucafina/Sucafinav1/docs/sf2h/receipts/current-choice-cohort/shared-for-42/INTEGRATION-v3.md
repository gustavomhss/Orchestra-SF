# Missão 46 — composição compartilhada v3 para a sessão 42

**Base e corte final observado:** `08ff8221ebfd86e3ae2c55fb4687b3fb0cced87c` (`sf2-stack`). Nenhum estado posterior da lane foi consultado para esta revisão. O patch v3 é completo e requer os três arquivos de produção owned da missão 46. Esta revisão de artefato não altera esses arquivos, seus testes ou os resultados já obtidos por seus checks.

**Estado:** `NOT_APPLIED / NOT_TYPECHECKED / NOT_TESTED`. A revisão estática independente de `cohort_contract_ci` não encontrou novo bloqueio na reconciliação e nas APIs observadas. Isso não constitui execução, sucesso de UI, sucesso do runtime composto ou aprovação da integração. Todos os caminhos compartilhados continuam somente no artefato; a aplicação e qualificação pertencem à sessão 42.

## Artefatos e supersessão

- `mission46-current-choice-composition-v3.patch`: diff completo contra o corte `08ff8221`, contendo somente seis caminhos compartilhados.
- `manifest-v3.json`: base, blobs e SHA-256 dos preimages e outputs completos, hashes do patch e observações das dependências do runtime.
- Este documento: condições e pendências de integração.

O v3 substitui integralmente o v2 de SHA-256 `bff0986db06d756d2bd8a466752ad2f8d179504c3c9359a209f7fb41b3a8211a` e o v1 de SHA-256 `8d7b661b23891ea74814099f84073a5c20623705c7470362479c3889223e659c`. Não aplicar esses patches cumulativamente. Os artefatos anteriores e seus manifests permanecem preservados sem alteração.

## Composição entregue

1. `local/entry.ts` instala o fence owned imediatamente sobre o SQLite real e antes do source lifecycle. O mesmo store chega ao host, produtores e assets, preservando blobs e a proibição de escrita aninhada. Identidade, Request, lease e operação são os do runtime real.
2. `product/contracts/host-context.ts` transporta a capacidade privada opcional. Hosts sem a capacidade não expõem o fluxo.
3. `host-context.ts` cria o serviço com autoridade real e produtores canônicos e monta seu HTTP no processo existente.
4. `current-choice-services.ts` compõe emissor de fontes Planner, simulação, persistência canônica, result-store, baseline/classificação, registro de cobertura, continuidade Atlas e fábricas owned. Fixa fontes das três superfícies e classificação privada, que não é coberta por `sfRunSourceFence`.
5. `current-choice-http.ts` fornece descoberta autorizada, preparação e promoção em POSTs separados. Reutiliza `planner.preview` e `decisions.promote-alternative`, sem novos grants, políticas ou capabilities nativas. A UI apresenta subtotal conhecido, total qualificado ou indisponível, cobertura, condições e restrições. A promoção exige ação humana explícita após revisão. Um 5xx conserva a mesma request e `Idempotency-Key` para consulta segura da mesma operação.
6. `decision-controls.ts` permite a classificação da fonte vigente somente depois de continuidade histórica comprovada e nova resolução fresca. Deduplica referências históricas que convergem para a mesma referência vigente, preservando o registro histórico.

## Reconciliação com Procurement e Decisions 44

Os preimages de `host-context.ts` e `decision-controls.ts` avançaram após a base do v2. O v3 foi reconstruído sobre os preimages exatos de `08ff8221`, sem substituir esses arquivos pelo conteúdo antigo.

A importação, criação e rota de `procurementScenarioHttp` foram preservadas. A cadeia HTTP anterior continua idêntica depois de retirar somente o prefixo acrescentado de `currentChoiceHttp`. O bloco novo de evidências Procurement dos controles foi preservado byte a byte. A alteração do cohort continua limitada ao laço de referências Planner e sua deduplicação.

Os dois arquivos novos de serviço/HTTP e os outputs de `local/entry.ts` e do contrato do host permanecem iguais aos outputs revisados do v2. O v3 não edita business services, cost coverage, Planner product ou local-store: esses arquivos aparecem no manifest somente como dependências observadas.

## Observações sobre o runtime no novo corte

`business-services.ts` e `planner/product.ts` agora compõem um produtor independente de Procurement. O `calculations.persist` exposto contém a restrição de promoção explícita desse produtor e continua delegando os casos Planner ao produtor canônico. O cohort utiliza essa função exposta e não contorna sua restrição. O emissor de fonte do cohort continua ligado a `planner-version`; o predicate do produtor Procurement observado seleciona somente `baseRef` iniciado por `sf-procurement:`.

`cost-coverage.ts` acrescenta aceitação restrita de estimativas Procurement condicionadas, mantendo a regra de fontes Planner. Nenhuma dessas regras é modificada pelo patch da missão 46.

`local-store.ts` agora conserva uma memoização de strings imutáveis do decoder e materializa cada snapshot no escopo da transação. A leitura de SQL permanece sob o lock; `currentSnapshots` continua devolvendo cópias das três superfícies. A rejeição de escrita aninhada, o controle de leitores e o limite de commit/rollback permanecem no código observado. O fence da missão volta a ler `currentSnapshots` depois da reautorização; não compara uma cópia antiga consigo mesma e não depende de uma autorização cacheada. Esta é uma observação estática de compatibilidade, sem execução do fence composto sobre essa versão do store.

## Fence da descoberta e da publicação

A correção v2 está integralmente retida. Para cada opção pronta, `options()` captura cópias de request, fonte original, fonte vigente e digest da cobertura. Antes de emitir a opção, `captureSources` reemite a fonte exata, comprova novamente a continuidade por Atlas, relê o baseline canônico selecionado pela fonte e compara referência, digest e request. Fontes das três superfícies e classificação privada ficam fixadas antes da releitura final do caso e do pin privado. Os guards continuam vivos durante o egresso de `withCase` e a última verificação de `fence.run`.

Uma prova pronta que muda torna a resposta indisponível com `current-choice-options-changed`. Opções inicialmente indisponíveis continuam sem request; não são substituídas ou promovidas silenciosamente. Uma lista sem opção pronta não afirma que uma fonte está pronta.

A base da cobertura é fixada em `coverageEvidence.entries` depois das emissões necessárias e antes do observer owned e da primeira leitura do registry. Os observers são síncronos e não registram outros observers ao executar. A comparação de caso/projeção exclui somente `preparedChanges` e `receipts`, transformados pelo case-port e não emitidos nesta UI; em seguida o caso bruto completo é fixado para a verificação final.

O serviço reutiliza o `operationIdentity` real sem prefixo adicional. Replay chama a leitura owned com o recibo exato, sem simular suporte histórico no registry que exige a versão original do caso. Classificações retidas de não aplicabilidade são aceitas somente por `supportsCoverageClassification`; o patch não cria produtor novo de aplicabilidade.

## Pendências de integração e limites da evidência

1. A sessão 42 precisa reconciliar os seis preimages do corte informado antes de aplicar o patch. Uma mudança posterior exige nova reconciliação pelo integrador; não deve causar edição concorrente pela missão 46.
2. A qualificação composta de instalação, serviço, HTTP e UI continua pendente em GitHub Actions cirúrgico. Checks source-only e revisões estáticas não validam este patch não aplicado nem o novo runtime junto com ele.
3. Continuidade histórica exige capturas e permissões reais de Atlas/C12. Fonte revogada ou captura ausente continua indisponível.
4. Nova classificação de cobertura exige a ação humana canônica. O host observado não emite novas provas de não aplicabilidade; classificações canônicas retidas com prova continuam aceitas.
5. Etapas privadas autorizadas de preparação são duráveis independentemente. Não se afirma rollback global de resultados intermediários quando uma etapa posterior falha. A promoção final permanece uma transação canônica atômica, preservando a escolha histórica.

Todas as leituras remotas desta reconciliação usaram GitHub MCP. Não houve mutação remota, execução de produto, typecheck ou teste local, merge, deploy ou alteração de engine/política. As comparações de texto e hashes usadas para gerar o artefato não são resultados de checks de produto.
