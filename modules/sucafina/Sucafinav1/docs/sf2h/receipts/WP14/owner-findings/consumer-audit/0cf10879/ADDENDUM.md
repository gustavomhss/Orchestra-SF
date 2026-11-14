# WP10 PR29 — adendo incremental para WP14

## Resultado

O novo head **0cf10879337bf1e4a4dfd0dbde0b9c259cb51d23**, tree **78a1976c1c8831121fda75efad95ebaab6f2f425**, preserva os findings de consumidores WP14 já abertos. O incremento compõe replay C17 com ancestry e reforça fences de outros fluxos, mas **não corrige a derivação de features Planner nem fornece o produtor nativo de autoridade de precedentes**. Os patches de integração continuam necessários, sujeitos à revisão do proprietário no novo blob.

A auditoria foi somente leitura. Nenhuma fonte de produto alheia foi editada e nenhum run foi iniciado. Os arquivos deste diretório são snapshots de referência e recibos da análise.

## Identidade e fontes

A comparação [f075e982…0cf10879](https://github.com/gustavomhss/Orchestra-SF/compare/f075e9824b7d8aed50b7f42c597528ef198177db...0cf10879337bf1e4a4dfd0dbde0b9c259cb51d23) contém **dois commits, 90 arquivos**, sem commits atrás da base:

| Commit | Tree | Mudança declarada |
| --- | --- | --- |
| 78f80881e94913b9b211bad7d17fbc95467ce0d7 | ffae7f1279c8c7af7b98f19f3ebc04960db75cc7 | WP10 W14: review fences e contratos de cálculo publicados |
| 0cf10879337bf1e4a4dfd0dbde0b9c259cb51d23 | 78a1976c1c8831121fda75efad95ebaab6f2f425 | WP10 W15: contraprovas de autoridade e browser BI |

`increment-metadata.json` conserva os 90 paths/blobs e os dois commits. `source-manifest.json` fixa **13 snapshots** relevantes lidos via GitHub MCP, com tamanho real em bytes, SHA256 e verificação do Git blob SHA. Os adendos anteriores permanecem inalterados.

O recibo W14 contém 258 entradas de pins efetivos. As **14 entradas próprias de WP14** continuam no PR36, pin **2fb7e9c792327725384d99d656cc44b232ddc485**. Nenhum arquivo de `product/decision-memory` ou `test/product/wp14` mudou neste incremento. A versão atual publicada no PR38 não foi consumida; diagnósticos sobre o pin antigo não caracterizam regressão da versão atual.

## Mudanças que afetam a análise

### C17, replay e ancestry

`business-services.ts` (blob **0d09eac4610a1f18c50f38094ada5a921e2ec237**) passa o replay canônico do Planner ao serviço de cálculo e conecta seu verificador de source closure ao result store. `planner-calculation-services.ts` compõe validação de fontes nos requests persistidos, rejeita ciclos e cadeias acima do limite antes do replay e permite a composição explícita de evidência aninhada.

As fontes `calculation-evidence.ts`, `result-store.ts` e `scenario-request-store.ts` exigem os verificadores canônicos para admitir a via aninhada. Elas verificam a closure completa de cálculo/cobertura, resolvem as fontes atuais e reproduzem o request. A presença desse código não demonstra seu custo ou sucesso no novo head.

O teste novo `calculation-ancestry-composition.test.ts` exercita SQLite, C08, cálculo Planner real, ledger ancestry, reabertura, ciclo persistido e revogação. A preparação usa uma premissa explicitamente hipotética e preserva subtotal conhecido/total pendente. Ele chama **initializeAtlas(undefined)**: não grava ou lê memória com scanner real nesse teste, nem executa Session nativa.

### Recall Planner e teste histórico

`planner-calculation.test.ts` mudou apenas o narrowing de `authorizedProjection.components`. Os fluxos de recall continuam chamando **reopened.atlas.memory.recall**, com deadlines cooperativo de 105.000 ms e de teste de 120.000 ms. Esse é o recall direto de registros Atlas; não é o ranking WP14 por `business.caseRecall`.

A função `featuresForCase` de `business-services.ts`, linhas 362–374, continua extraindo tipos apenas de records e prepared changes. Ela não chama `deriveAuthorizedRecallFeatures`; o finding Planner continua aberto. A construção de `createSfCaseRecall`, linhas 438–453, também não compõe `candidateAccess`.

O teste `historical-memory.test.ts` preserva scanner/C08/CaseRecall reais de sua integração existente e troca somente a construção do output do verificador. O novo helper passa pelo decoder estrutural e marca os campos como **unexecuted/unpublished**. Isso testa o verificador de payload; não fornece execução de modelo, Session, skill carregada ou autoridade para publicar contribuição nativa.

### Demais consumidores

| Finding | Estado após o incremento |
| --- | --- |
| 01 — memória/outcome/review | Composição real preservada; nenhuma nova execução de outcome WP14 não vazio em review foi demonstrada. |
| 02 — sinais de colaboração C16 | Continua sem `workSignals`/issuer de work refs na composição auditada. |
| 03 — features Planner | Aberto; função local continua omitindo cálculo/cobertura canônica. |
| 04 — autoridade nativa de candidato | Bloqueado no proprietário; falta produtor escopado real e sua ligação. |
| 05 — invalidação | Reconhecida a fence lexical de f075; nenhum consumo novo de `decideSfRecallInvalidation`. A ausência não é tomada como prova de vazamento. |
| 06 — reavaliação após troca real de fonte | Serviços de materialidade/memória não mudaram; exigência de fonte original fresh/igual permanece. |
| 07 — review/portfólio | Composição de histórico preservada; teste genérico não prova consumo não vazio de outcome WP14. |
| 08 — Atlas/replay | C17 ampliado; implementação Atlas e scope lexical não mudaram; falta execução exata do novo candidato. |
| 09 — C07/watch nativo | Recibo conserva bloqueio do executor e dos cinco descritores públicos de rotina. |

O scope lexical de `atlas-recall-scope.ts` e sua ligação em `business-context.ts` não mudaram neste compare. Continua sendo a otimização UI limitada documentada em f075, com descarte ao sair da invocação; não constitui autoridade de candidato nativo.

A proposta **0001** de features canônicas e a **0002** de seam escopado continuam semanticamente relevantes. Seus contextos devem ser aplicados e revisados contra o novo blob do host, sem copiar snapshots antigos. A proposta **0003** de composição de registries é independente do gap de `workSignals`. O callback Procurement publicado permanece callable via `Object.assign`, compatível com o adapter WP14 tipado por `ReturnType<typeof createProcurementSourceResolver>["resolve"]`.

## CI observado inicialmente e limite da prova

Na observação inicial, o GET do [run 43580252381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580252381) retornou **in_progress**, conclusão nula, job **132403235716** ainda no passo **Run tests**. O snapshot é **dd648c423ab97fbe6e806b620057a328a5816b5f**, sobre **f075e982**, não sobre o novo head. O estado e instante de observação estão em `product-run-status.json`. Naquela observação ainda não havia resultado final. A atualização cronológica abaixo registra o fechamento posterior e sua reconciliação.

O recibo publicado de W15 relata falha do check W14 **43582254372 / 132409279269**, snapshot **0f895a5086dd270f024aa291b876d1a4cc9677f6**, e declara correção das duas ocorrências próprias num único local de teste. Este dado é atribuído ao recibo do proprietário; o job e o artefato desse check não foram baixados nesta auditoria. O mesmo recibo mantém a aceitação W15 dependente de execução e revisão exatas, sem aceitação nativa/global.

O PASS do recall direto em f075 não encerra automaticamente o ranking WP14, a autoridade de precedentes nativa ou a aceitação do head 0cf10879. Nenhum teste local, epic por WP ou repetição equivalente de run foi executado.

## Atualização cronológica — resultado final do run 43580252381

Depois da observação inicial acima, a API passou a informar **completed / failure**, com `updated_at=2026-11-14T10:01:56Z`. A auditoria baixou via GitHub MCP os jobs e o log completo do job **132403235716**. Esta seção substitui somente o estado pendente daquele run; conserva as observações históricas e as identidades dos candidatos.

**O finding anterior de latência dos dois fluxos de recall direto Planner/Atlas está corrigido no pin f075e9824b7d8aed50b7f42c597528ef198177db.** Os dois testes exatos passaram dentro dos mesmos limites de 105.000 ms cooperativos e 120.000 ms do teste, embora o run completo tenha falhado por outros testes.

| Prova exata em planner-calculation.test.ts | Resultado | Tempo total | Linha do log |
| --- | --- | ---: | ---: |
| Planner calculation recalls the actual reopened Atlas record and does not append it twice | PASS | 45.206,01 ms | 1234 |
| Planner overlapping replays and Atlas recall disclose nothing after principal revocation | PASS | 45.544,43 ms | 1301 |
| Planner calculation survives SQLite and Atlas reopen with continuity, original and ancestor context | PASS | 65.272,49 ms | 1213 |
| Arquivo completo | 16 PASS / 0 FAIL / 0 SKIP | — | 1182–1481 |

Na cadeia **reopen-and-recall**, o log registra gravação Atlas real confirmada em 7.942 ms, SQLite/autoridade reabertos em 7.950 ms, início do recall em 16.088 ms e recall autorizado em 45.070 ms. O teste exige exatamente um registro, uma única resolução de cálculo durante aquele recall e novo emit retornando `already-committed`.

Na cadeia **overlapping-revocation**, o controle positivo encontra um registro após reabertura. Em seguida, o teste pausa no await real do ambiente, sobrepõe outra prova, revoga o principal e exige ambos os resultados de cálculo sem `ok`, além de contexto e recall Atlas `unavailable`. O PASS é dessa sequência completa. Os outros testes do arquivo também passam: source drift, membership, capture, coverage, selector, clock, principal, lease e isolamento lexical de chamada sobreposta.

### Totais, Omni e falhas que mantêm o run vermelho

O resultado exato é **198 PASS, 12 FAIL, 2 SKIP**, **212 testes em 24 arquivos**, **2.163 assertions**, duração reportada **2.274,65 s**. O controle Omni retorna **PASS**, com **22 testes declarados, 38 spawns Omni e zero delegados**. Esse controle demonstra o caminho de criação de processos; não constitui execução de Session/modelo/skill nativa.

As 12 falhas têm estes grupos verificáveis:

| Arquivo/grupo | Quantidade | Falha observada |
| --- | ---: | --- |
| WP02 host-workbench / workbench-recovery | 7 | Uma opção de caso esperada não aparece; uma contraprova recebe `ok` com listas vazias em vez de `stale`; cinco seleções da opção de caso expiram em 15 ou 30 segundos. |
| WP01 shell-recovery, teste sem nome | 1 | A fixture recusa a seleção porque exige a lane Linux explícita com `browser-lifecycle.test.ts` por último; a seleção usada não fornece esse ciclo de vida. |
| WP10 analysis-composition/alternative-selection | 4 | As duas provas de draft/capture para janeiro e as duas versões anuais excedem o prazo cooperativo de 105.000 ms. Não são os testes de recall direto Atlas acima. |

Os dois SKIPs são as contraprovas de UID estrangeiro de diretório e banco, declaradas dependentes de privilégios root. Nenhuma delas é convertida em PASS.

### Identidade e limites preservados

O snapshot executado continua **dd648c423ab97fbe6e806b620057a328a5816b5f**, tree **ac9a7f96aa0f8bd6b30200c5628c37058e8176b0**, com somente `.ci-run.json` sobre **f075e982**. O request SHA256 é **bc01cc977b331e5538d4dad42e38048c943a2747fde600eb7cee580fd05c371b**, já verificado no adendo anterior.

O head auditado **0cf10879** não é a identidade deste run. O finding de **features canônicas Planner do ranking WP14** permanece aberto, assim como o **produtor de candidateAccess nativo**. O PASS do recall direto UI não altera essas conclusões, e a atualização não declara aceitação nativa/global.

Artefatos para reprodução da leitura:

- `job-132403235716.log`: log completo, UTF-8 com BOM/escapes originais, **344.268 bytes**, SHA256 **fc1f7b522623b9f8d1a89535ce37873d6d1a572fec698a0832a8427ec0ef23a7**.
- `planner-final-evidence.log`: linhas exatas dos resultados Planner, fases dos dois fluxos, controle Omni e totais.
- `product-final-summary.json`: resultado, todas as 16 provas Planner, 12 falhas, dois SKIPs, limites e reconciliação do finding.
- `product-test-results.json`: as 212 ocorrências de testes, sem duplicar o sumário terminal.
- `product-final-status.json`: metadados finais de run/jobs.
- `final-evidence-manifest.json`: hashes e tamanhos dos artefatos desta atualização.

Nenhum produto foi editado, nenhum teste local foi executado e nenhum novo run foi disparado para obter essa evidência.
