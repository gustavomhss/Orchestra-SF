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
