# Addendum independente — cinco fixtures S11/S12

**Parecer: nenhum bloqueador adicional encontrado nos cinco deltas congelados. A revisão é estática; execução no GitHub Actions pendente.** Este addendum é separado da revisão dos dois deltas de produto em `review-late-core.md`. Não houve edição de produto nem execução de produto/Bun/CI pelo revisor.

## Blobs revisados

Prefixo: `modules/sucafina/Sucafinav1/`. As versões antes/depois foram verificadas independentemente pelos hashes e comparadas integralmente. O JSON acompanhante contém SHA-256, tamanhos, fontes dos baselines e todos os diffs.

| Grupo | Arquivo | Antes | Depois |
| --- | --- | --- | --- |
| S12 | `test/product/wp11/calculation-history.test.ts` | `ae99e63e1e9987be91c46d231bba05ec24748ca1` | `310435389682b2892fc255a0eb60030ae7dda6a6` |
| S12 | `test/product/wp11/case-import-incarnation.test.ts` | `fe8e2173a1291efd8bed0305c8ef6b5c3e725a94` | `90333c12d277942667810d6ed802e019e799f837` |
| S11 | `test/product/wp05/engine-revision-fixture.ts` | `93e9c37cfea05574c3c0b3ae080a03fdd5063056` | `856381de3f333ca79b302483d3b8893d55f00441` |
| S11 | `test/product/wp05/choice-history-bi.test.ts` | `40fbaf6eb4a7b88c3f4feb54773961188cd007da` | `c939c5e39c80f3cdbc08fd700cd017a7b0ed50b4` |
| S11 | `test/product/wp11/renewal-source-fixture.ts` | `fb973752979eb98ba2e1c3c9002ade471443b728` | `79de9744dcf08cfc8a4f17084954a9230bb1793a` |

Para os dois arquivos S12, os conteúdos anteriores vieram da captura W18 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` e coincidem com os pins congelados do root. Os baselines dos três arquivos S11 vieram de `bi-choice-failure-before`, conferidos com o manifesto do autor. Nenhum run antigo qualifica estes novos blobs.

## S12 — nova admissão após revogação

**FIXTURE-S12-ADMISSION, P2 de fixture, correção presente no código.** A implementação real de `createSfUiAuthority.revalidate` remove a entrada privada quando a autorização deixa de ser válida. Reabrir o flag `allowed` não restaura uma admissão revogada. O teste anterior prosseguia usando o contexto removido e falhava antes de exercer os negativos de fonte e incarnação.

O teste agora mantém `context` e a `Request` correspondente como variáveis, emite uma nova admissão real com consumo e atualiza a Request usada pela autoridade da fixture. Confirma que o contexto antigo continua inválido antes e depois dessa renovação, que o novo é válido e que o resultado histórico persistido volta a ser lido exatamente. Não reinjeta o contexto revogado nem altera a implementação de autorização. As negativas de ledger, seleção, horizonte, fonte e incarnação foram preservadas, assim como o timeout de 180000 ms.

## S12 — CAS atual no restore

**FIXTURE-S12-DATASET-CAS, P2 de fixture, correção presente no código.** A aplicação real incrementa `snapshot.versions.dataset` após o delete HTTP bem-sucedido. O produtor de backup-import compara a versão do comando com esse dataset. O restore positivo não podia continuar enviando a versão anterior 1.

O teste lê a revisão atual, exige explicitamente `2` e usa essa revisão na restauração confirmada. A repetição stale continua enviando `1` e exigindo `409`. Permanecem as assertions de proteção de `__sfProductV1`, ChoiceRecord e histórico, novo incarnation para o ID reintroduzido, recusa da referência antiga, proteção de roleMap/access e exportação pública sem metadados privados. Não houve mudança de produtor ou política.

## S11 — calendário explícito da cotação de treinamento

**FIXTURE-S11-TRAINING-CALENDAR, P2 de fixture, correção presente no código.** A fonte antiga registrava budget anual zero e apenas `f10=40000`. Nos outros onze meses o forecast era ausente. O qualificador canônico de Planner classifica o fallback do budget como `estimated`, enquanto a cobertura completa exige componentes `confirmed`. Um subtotal conhecido de 250000 com total nulo era coerente com aquela fonte.

As duas fixtures passam agora um vetor de doze forecasts pelo comando real OPEX: novembro recebe 40000 e os onze meses restantes recebem zero explicitamente declarado pela cotação sintética. O runtime admite `f`, exige doze números/null e passa pela permissão canônica de forecast. Não se converte null em zero na implementação do produto, nem se afrouxa a cobertura para aceitar estimated. Os checks de digest que preservam a versão original continuam intactos.

O teste BI acrescenta assertions antes de ler BI: o ScenarioRequest precisa ser uma observação sem operações/premissas, os doze componentes training precisam carregar valores e estado `confirmed` exatos, e o resultado canônico precisa ter knownSubtotal/total 250000 e comparação/cobertura completas. Continuam as assertions posteriores de diferença -10000, fontes, ChoiceRecord original, projeção anterior imutável, ausência de prepared changes/receipts e caso não aplicado. Nenhum timeout foi aumentado.

O consumidor atual é `renewal-choice-fixture` via `renewal-source-fixture`. A busca de referências não encontrou imports/callers do helper antigo `wp05/engine-revision-fixture.ts` além de suas próprias definições. A correção desse helper mantém consistência; não é apresentada como caminho exercitado pela seleção BI atual.

## Riscos e evidência ainda necessária

A contagem estática de `expect` não diminuiu em nenhum arquivo e os literais de timeout permanecem idênticos. Isso acompanha a revisão dos diffs; não substitui execução.

O autor de S11 reportou no manifesto run `43586902727`, job `132423255218`, com duração de 645858.41 ms para um teste declarado com timeout de 180000 ms, além da divergência total nulo/subtotal 250000. Este revisor não baixou os logs novamente. O problema de duração permanece observado e sem nova medição; o ajuste de dados não é apresentado como correção de performance. O efeito das mudanças separadas de fixture trazidas de PR40 precisa ser medido no candidato novo.

O root deve publicar os blobs exatos e executar/reaproveitar seleções cirúrgicas compatíveis para os dois testes S12, `choice-history-bi` e os consumidores de revisão/histórico renewal afetados. Typecheck e guards do candidato, provas instaladas/nativas e aceitação C/D/global continuam pendentes. A divergência de source projector Procurement e o diagnóstico de current-choice pertencem a outros recortes e não foram editados nem declarados resolvidos neste addendum.
