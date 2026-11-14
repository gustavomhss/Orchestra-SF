# WP14 → WP10/WP11: recall de precedentes e Planner

## Pin e estado

Estas propostas são arquivos de revisão, não mudanças aplicadas a código alheio.

- Repositório: `gustavomhss/Orchestra-SF`.
- Produtor examinado: PR29, commit `417038d6b3cfd1817f40ffc60e56f42e505b50a5`.
- Arquivo: `apps/cli/src/sucafina-product/business-services.ts`.
- Blob: `34a491f859f7b57b0883a122f816803df43c74c8`.
- O auditor de consumidores encontrou o mesmo blob no bundle `5866bcb2`.
- Nenhum teste local de produto foi executado. Os patches não estão validados por CI.

## 1. Feature canônica de recall — patch aplicável pelo WP10

`0001-canonical-recall-features.patch` preserva a releitura autorizada e a igualdade do caso/fontes em `featuresForCase`. Após esse fence, usa `deriveAuthorizedRecallFeatures(refreshed.value, call)`, exportado pelo WP14.

O produtor atual infere `decisionType` de `record.surface:recordType` ou de prepared changes. Um caso cuja evidência é uma `calculation` legítima do Planner pode não ter nenhum desses campos e retornar `undefined` antes do ranking. O próprio tipo do caso deixa de significar o tipo de decisão. A transformação canônica usa `costCoverageBases[].decisionType`, exige um único tipo não vazio, preserva período, componentes, restrições e disponibilidade de resultado. Casos antigos sem base inequívoca permanecem indisponíveis; não devem receber tipo inventado para fazer um teste passar.

Seleções de aceite do proprietário: fluxo real `sf_decision_recall`/capability sobre caso com calculation e costCoverageBasis válidos; tipo ambíguo/ausente recusado; revogação entre a releitura e a saída recusada; mesma semântica de features na origem e nos candidatos. Este finding é separado da latência do leitor Atlas descrita abaixo.

## 2. Recall nativo entre casos — seam de consumo, ainda BLOCKED_OWNER

`0002-scoped-recall-consumer-seam.patch` expõe um callback opcional host-only `recallCandidateAccess` no construtor WP10 e o encaminha a `createSfCaseRecall` e a `atlasRecall()`. A segunda propagação preserva o consumidor antigo `analysis-domain-bindings.ts`, que espalha esse bundle em outro `createSfCaseRecall`; o caminho vivo identificado é `host-context.ts` → `analysis-host-services.ts` → `business.caseRecall`. É um patch de composição: sozinho não implementa nem prova o leitor autorizado de precedentes. Não torna a seleção MCP uma concessão de acesso.

No pin examinado, a cadeia normal está restrita ao caso nativo corrente em quatro lugares:

1. WP11 `createDecisionCasePort().read` exige `binding.caseId/caseIncarnation/caseVersion`.
2. WP14 `createSfCaseEventSourceAccess` recusa ancestry de outro caso por padrão.
3. WP10 `createSfAtlasMemory().readOriginal` verifica o mesmo binding corrente antes de ler o capture protegido.
4. WP10 `featuresForCase` e `caseForEvidence` fecham sobre os leitores normais; para native, `caseForEvidence` considera apenas `nativeRuns[runId].caseRef`.

O WP14 entrega as peças próprias consumíveis, mantendo os defaults estritos:

- `SfRecallCandidateAccess` traz `cases`, `memory` e os callbacks opcionais `featuresForCase`/`proveContinuity` correspondentes ao mesmo escopo.
- `createSfCaseRecall` continua lendo o caso de origem pelo port normal; rejeita origem diferente do binding, refs/version/incarnation fora da seleção, mudanças da seleção original/clonada e do binding durante awaits.
- `createSfCaseEventSourceAccess.authorizeRecallCase` é uma opção de factory privada do host, usada apenas para caso estrangeiro. O caso corrente não pode contornar sua versão ligada. A releitura repete autorização, acesso às fontes e ancestry; mudanças de ref/binding não chegam à saída.

O produtor WP10, com o leitor WP11, precisa publicar um bundle por **invocação**, com estas propriedades observáveis:

- Verificar a chamada registrada e a seleção admitida para o run/skill corrente. `query`, `period` e a lista exata `id/incarnation/version` são parte do digest; valores vindos de argumentos MCP não concedem autoridade.
- Revalidar o caso de origem, identidade, participante, política, accessRevision, sessão e run antes/depois dos awaits. Nunca clonar ou reescrever `TrustedExecutionBinding` para simular que o precedente é o caso corrente.
- Reusar as verificações WP11 de evidence coverage, acesso a fontes e `verifyScenarioOperations` para o precedente, com releitura e fence da versão. Não substituir esse port por uma leitura bruta do catálogo de casos.
- Produzir `memory.recall`, `readOriginal`, ancestry e continuidade com a mesma concessão imutável e limitada à invocação. `readOriginal` deve continuar verificando o log Atlas canônico, envelope, digest do capture, participante atual e versão/incarnation; não reabrir recursivamente o cálculo que precisa do próprio capture.
- Usar o leitor de precedentes autorizado em `featuresForCase` antes da transformação canônica e o capture protegido correspondente em `proveContinuity`.
- Não ampliar `emitFromLedger`: o writer normal continua ligado ao caso atual; a fachada de precedentes é de leitura.
- Não usar um grant global mutável/WeakMap por contexto compartilhado para ampliar requisições concorrentes. Cada seleção carrega seu próprio closure e fingerprint; autorização de uma chamada não sobrevive à saída nem é reutilizada em outra seleção.

Critérios cirúrgicos de aceite do proprietário: sem callback, outro caso é indisponível; com callback e fontes reais, o precedente exato é lembrado; versão/incarnation trocada, candidato removido, revogação após await, ancestry revogada e pedido/binding alterados retornam indisponível sem conteúdo de candidato. Repetir com SQLite fechado/reaberto, scanner real e SessionV2/MCP privado reais para a prova nativa. Os testes WP14 da seam são unitários/sintéticos e não substituem esse witness.

## 3. Planner após reopen — finding de performance do host, não resolvido pelo mapper

Evidência executada: run `43564553695`, job `132355419787`, snapshot WP10 `417038d6b3cfd1817f40ffc60e56f42e505b50a5`.

O log mostra duas falhas por deadline cooperativo de 105000 ms:

- `Planner calculation recalls the actual reopened Atlas record and does not append it twice` (`reopen-and-recall`, cerca de 105009 ms).
- `Planner overlapping replays and Atlas recall disclose nothing after principal revocation` (`overlapping-revocation`, cerca de 105012 ms).

No mesmo run, `reopen-and-context` passou em cerca de 85973 ms, com cálculo resolvido após reopen, continuidade autorizada, capture original e contexto de ancestry repetido. As fases medidas atribuem aproximadamente 10750 ms à resolução do cálculo, 21393 ms à continuidade e 115 ms à leitura isolada do capture original. A escrita real Atlas e o reopen haviam concluído nos dois testes que venceram o prazo.

A chamada que falha é diretamente `reopened.atlas.memory.recall(...)`; ela não passa por `createSfCaseRecall`, `featuresForCase` nem pelo ranking WP14. Portanto o patch de features não é uma correção demonstrada para esse deadline. O pin contém repetição custosa das resoluções/continuidade de calculation nas passagens de autorização do host. Cabe ao WP10 instrumentar e eliminar recomputação dentro de uma única passagem, conservando os fences antes/depois, o recheck após revogação e os deadlines existentes. Cache entre chamadas, remoção de ancestry/revalidação, aumento do prazo ou retorno de catálogo não constituem solução.

Para encerrar este finding, o proprietário precisa publicar o pin e uma execução dos dois testes que falharam, com o mesmo scanner real e SQLite real. O WP14 não declara esse resultado aprovado.

## 4. Persistência das registries — proposta de separação WP14/WP10

`0003-host-memory-registry-ownership.patch` materializa o finding de `WP14.INV.01` e `WP14.INV.40`: as implementações herdadas de `signal-registry.ts` e `outcome-selection.ts` chamam `state.read`/`state.transaction` e escrevem em `preferences` dentro do namespace WP14. A proposta transfere essas implementações para adaptadores de `product/host-binding`, mantendo contratos de porta, seleções, bindings e prefixos em `product/decision-memory`. Os critérios relacionados de T04 continuam sujeitos à revisão do proprietário. O patch não altera o plano aprovado nem atribui autoria, ACL ou permissão de merge a alguém.

**Estado: proposta para revisão S0/WP10, não aplicada e não pronta para produção.** Nenhum arquivo de produto foi alterado para gerar este artefato; não houve `git apply`, teste local de produto, typecheck ou CI deste patch. Os 11 paths propostos, os blobs Git e os SHA256 anteriores/propostos estão em `0003-host-memory-registry-ownership.sources.json`. O patch contém duas adições e nove modificações; a maior parte do conteúdo é a implementação existente movida de lugar.

### Bases e dependências

O lado WP14 usa W2 de PR38, commit `075cbe04a954b08e946bed676c3901dae13a14cc`, tree `3f59fc019290d4f7a01a42de8a136c36840ff9ee`, conforme publicação informada pelo root. Esse incremento inclui as correções de identidade, cancelamento, snapshots e mutação de callbacks após o último await. O manifesto identifica os bytes exatos de cada arquivo. A proposta exige o consumo desses arquivos W2 antes da relocação. Não deve ser aplicada isoladamente ao antigo snapshot WP14 de PR36 presente no host.

O lado host usa WP10 `f075e9824b7d8aed50b7f42c597528ef198177db`, tree `2751625f28928baf371d39576fe46777aa81f74e`. Os dois arquivos CLI usados no patch não aparecem no delta completo de 134 paths desse commit em relação a `417038d6b3cfd1817f40ffc60e56f42e505b50a5`; por isso os snapshots do parent, já verificados por blob, são os mesmos inputs em f075. Os blobs são `85c3021dec21ab942a8fab04524d48295fd918f7` para `memory-services.ts` e `2deb115ed924b39319eecada7701b8c63da79064` para `decision-materiality-services.ts`. Essa derivação está registrada em `../consumer-audit/f075e982/increment-metadata.json`, `addendum.json` e no manifesto do patch.

As novas localizações abaixo são nomes propostos de adaptadores no namespace do host. S0/WP10 precisam aceitar a transferência e publicar o incremento sob seu próprio ownership. Não há alteração de `AGENTS`, `CODEOWNERS`, grants, identidades técnicas ou estado financeiro.

### Paths e compatibilidade

Paths de produto e teste nesta tabela são relativos a `modules/sucafina/Sucafinav1/`.

| Path ou grupo | Mudança proposta |
| --- | --- |
| `product/decision-memory/signal-registry.ts` | Retém `SfSignalSelection`, `SfStoredSignalBinding` e `SF_SIGNAL_REGISTRY_PREFIX`; declara o contrato puro `SfSignalRegistry`, sem dependência de store ou import do host. |
| `product/decision-memory/outcome-selection.ts` | Retém `SF_OUTCOME_SELECTION_PREFIX`; declara o contrato puro `SfOutcomeSelectionRegistry`, usando o tipo existente `SfOutcomeSelection`. |
| `product/host-binding/memory-signal-registry.ts` | Recebe `createSfSignalRegistry` e sua validação privada, com a implementação W2 preservada. |
| `product/host-binding/memory-outcome-selection.ts` | Recebe `createSfOutcomeSelectionRegistry`, o formato persistido privado e sua validação, com a implementação W2 preservada. |
| `product/decision-memory/planner-materiality.ts`, `signal-list.ts`, `signal-work.ts` | Consomem `SfSignalRegistry` por tipo, sem depender de `ReturnType` da factory concreta. As assinaturas das portas recebidas permanecem as mesmas. |
| `test/product/wp14/signal-registry.test.ts`, `domain-outcome.test.ts` | Importam as factories do host; continuam importando prefixos e tipos puros de WP14. O corpo dos testes e os produtores reais permanecem intactos. |
| `apps/cli/src/sucafina-product/memory-services.ts` | Atualiza somente os imports de ambas as factories para os adaptadores do host. |
| `apps/cli/src/sucafina-product/decision-materiality-services.ts` | Atualiza somente o import de `createSfSignalRegistry` para o adaptador do host. |

As factories conservam os nomes, argumentos, métodos e formatos de retorno. Os contratos explícitos descrevem os mesmos métodos `register`/`revise`/`list`/`reconcile` e `register`/`select`; não introduzem capacidade nova. A mudança dos paths das factories exige consumo atômico com os imports dos callers. Um re-export de runtime do WP14 para o host recolocaria a dependência concreta no namespace puro, por isso ele não faz parte da proposta.

Os callers conhecidos que importam apenas o contrato existente não precisam de hunk: `apps/cli/src/sucafina-product/memory-selection.ts` e `test/product/wp10/integration/memory-fixture.ts` continuam recebendo `SfSignalSelection` no mesmo path; `test/product/wp10/integration/memory-services.test.ts` continua recebendo `SF_SIGNAL_REGISTRY_PREFIX` no mesmo path. `memory-http.ts`, `host-context.ts`, revisão e a composição de decisões continuam consumindo as mesmas APIs de serviços. A busca cobre os snapshots auditados WP10 e as fontes WP14 disponíveis; o owner deve repetir a busca no tree integrado que efetivamente publicará para encontrar callers de incrementos posteriores.

### Autoridade, persistência e replay preservados

O patch mantém os prefixos `sf:memory-condition:` e `sf:memory-outcome:`, schemas, IDs, revisões, digests de escolha, keys de idempotência, storage versions e target incarnation. Não cria store paralelo nem exige migração de dados. O `SfProductStatePort` e os produtores canônicos de caso e de fonte continuam sendo os fornecidos pela composição atual.

O mesmo `signalRegistryWrites` fornecido pelo host continua marcando a identidade do callback de transação e removendo-a em `finally`; o guard dos prefixos protegidos de `state-provider.ts` não é alterado. Os mesmos hooks de aprovação humana, autorização, source fence e revalidação continuam obrigatórios. A identidade do objeto de seleção entre autorização e source fence também permanece: isso conserva o `WeakMap` privado usado pela composição WP10. As cópias isoladas no armazenamento e as verificações finais W2 são movidas junto com a implementação.

A relocação não amplia participantes, escopo nativo, acesso a precedentes ou fontes. Não implementa scheduler, invalidação de cache concreta, ligação C16, revisão material após alteração real de Planner ou prova nativa/Atlas. Esses findings permanecem separados. A proposta também não declara os invariantes completos aprovados apenas porque um arquivo foi movido.

### Boundary restante: os dois writers não esgotam a separação

Este patch move somente os dois adaptadores que gravam as seleções e estados de sinal. Ainda há adaptação de host herdada em `product/decision-memory/source-access.ts`: `createSfDashboardSourceAccess` e `createSfDashboardContinuityProof` executam transações de leitura com `commit: false` em `host.persistence`, consultam scopes/identidade física e chamam autenticação concreta; `createSfCaseEventSourceAccess` lê o namespace `cases` por `SfProductStatePort`. Esses acessos continuam sendo I/O, mesmo quando não gravam. As factories de acesso a registros, procurement e documentos também invocam os resolvers/readers fornecidos pelo host e os produtores reais.

Além desse acesso direto, os consumidores assíncronos de WP14 continuam dependendo de callbacks com I/O — leitura de casos/fontes, resolução de materialidade/outcome, revalidação e operações das registries. A proposta declara o contrato dessas portas, mas não transforma a execução dos callbacks em computação pura. S0/WP10 precisam distinguir as funções puras de decisão/ranking/tradução dos adaptadores e da orquestração de host, definir a transferência restante por path e conservar os checks atuais de autoridade, continuidade, revogação e ancestry. `source-access.ts` e os outros consumidores não são movidos por este patch. **`WP14.INV.01`/`WP14.INV.40` não ficam globalmente resolvidos por 0003**, e o patch não autoriza ampliar ou remover callbacks para simular essa conclusão.

### Revisão e validação que cabem ao proprietário

S0/WP10 devem reconciliar os 11 paths com seu tree atual e com o pin W2 admitido, revisar os contratos explícitos e fazer a atualização dos imports em um único incremento. Divergências de fonte devem ser conciliadas por arquivo; esta proposta não autoriza merge de snapshot antigo nem substituição de mudanças concorrentes.

Após a revisão, a validação cirúrgica sugerida ao owner cobre `test/product/wp14/signal-registry.test.ts`, `domain-outcome.test.ts`, `planner-materiality.test.ts` e `test/product/wp10/integration/memory-services.test.ts`, além de Bun typecheck nos packages Sucafina/CLI e os guards aplicáveis. A execução deve usar GitHub Actions conforme o protocolo vigente e não repetir runs equivalentes. Os resultados precisam pertencer ao novo head que contém a relocação; o CI de W2 sem este patch não valida os novos imports ou contratos. Nenhum desses checks foi executado nesta proposta.

## 5. Resultado posterior do finding de latência

O run WP10 `43580252381`, job `132403235716`, concluiu no produto `f075e9824b7d8aed50b7f42c597528ef198177db`: os 16 testes Planner passaram, incluindo recall direto após reopen em 45,20601 s e overlap/revogação em 45,54443 s, sem elevar o prazo de 105/120 s. O finding de latência dessas duas cadeias está reconciliado nesse pin. O run geral teve 198 pass, 12 fail e 2 skip.

Esta evidência posterior não é green do head `0cf10879`, não executa as propostas 0001/0002 e não concede candidateAccess nativo. As diferenças entre recall Atlas direto e ranking WP14 permanecem. Consulte [o adendo final](../consumer-audit/0cf10879/ADDENDUM.md) e [o resumo executado](../consumer-audit/0cf10879/product-final-summary.json), que preservam a observação pendente anterior e o resultado final.
