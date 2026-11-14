# Parecer independente R1 — W17

**REQUEST_CHANGES / HOLD.** W17 corrige as duas causas próprias apontadas no W16 em nível de fonte. Os dois erros de tipos estão fechados no check hospedado exato; a comprovação funcional da reentrada permanece pendente. A revisão identificou um bloqueio adicional de composição C17: o adapter do host não consome os leitores históricos publicados quando o caso avança e conserva o cálculo no ledger.

| Identidade | Valor |
| --- | --- |
| Produto W17 | `2ec17b2c8204d5e953eec3186b7e236c0faaad47` |
| Árvore | `526f67866223b8b73e1bcae16e45ec9377b1af2e` |
| Parent W16 | `f3b9f512fbcae66bc369ff7dbbe6fa433ae4c9d0` |
| Revisor | R1 — `/root/independent_r1_w16`; sem autoria de produto ou testes |
| PR / base | PR29 → `sf2-stack` |

## Achado obrigatório novo

### R1-W17-CALCULATION-HISTORY-01 — histórico C17 sem composição no host

O novo `analysis-run-context.ts` permite reentrada em caso mais recente da mesma encarnação, preservando o selector original. Entretanto, `business.withCase` ainda começa por `cases.read`. Este reader reúne as evidências do caso e de seu ledger e recusa a projeção se alguma referência não resolver como fresh ou historical (`case-port.ts:79–85,133–145`).

O adapter próprio `planner-calculation-services.ts` resolve cálculos somente por `requests.read` e `results.readForCalculation` (`66–91,116–162`). Esses caminhos correntes exigem que a versão do caso seja a mesma do resultado persistido. Depois de aceitar uma análise e avançar de v1 para v2, a referência C17 conservada no ledger continua apontando para o resultado original v1: o reader corrente recusa, o BCS retorna unavailable e a leitura do caso impede até a reentrada de lifecycle.

O produtor publica as rotas `readHistoricalCalculation` e `readHistorical`, vinculadas ao caso corrente, evento real e referência exata. O teste publicado `wp11/calculation-history.test.ts:66–90,120–140` explicita a distinção: a leitura corrente deve recusar após v1→v2; o ramo histórico explícito deve reabrir o caso preservando o resultado. O adapter WP10 não monta esse ramo e seu verificador de cálculo também prende `stored.caseRef` ao scope de versão exata.

**Impacto:** caso e evidência histórica indisponíveis no host após evolução legítima, inclusive para lifecycle stale. É uma recusa segura com perda de funcionalidade; não encontrei vazamento ou promoção de autoridade fresh nesse fluxo. O problema já existia antes do W17 e foi identificado nesta revisão por seu encadeamento estático; não alego reprodução local ou hospedada.

**Correção requerida:** compor o reader histórico do produtor numa rota privada autorizada, derivada de evento/ref reais do caso corrente. Preservar resultados e fontes originais, replay canônico, autoridade corrente, projeção histórica, currentRef, diferenças e prova de continuidade do BCS. A rota corrente deve continuar estrita. O resolver da fixture WP11 não pode ser copiado como implementação: ele omite campos exigidos pelo BCS real.

**Prova requerida:** cálculo canônico persistido em v1, referência aceita num evento real e caso avançado a v2, leitura pelo BusinessServices/BCS real, reopen/restart autorizado e lifecycle através do helper de produção. Contraprovas: evento ausente/trocado, ref alterada, reencarnação, revogação, corrida durante awaits, referência aninhada/self e impossibilidade de usar o histórico como seleção fresh. O achado foi comunicado imediatamente ao implementador.

## Rechecagem dos achados W16

| Achado | Fonte no W17 | Prova / limite |
| --- | --- | --- |
| `R1-W16-LIFECYCLE-CASE-01` | **SOURCE_FIXED**: host usa `createSfAnalysisRunContext`; `allowHistoricalRetry` mantém selector e intenção originais; autoridade/Request/active/replay são verificados no retorno e removidos no finally | **HOSTED_RECHECK_PENDING**. O novo teste usa helper/human/C08 reais e avanço, mas não chama markStale/preserveStale e usa sourceRefs vazio. O cenário C17 acima continua bloqueado |
| `R1-W16-TYPES-02` | **SOURCE_FIXED**: narrowing por presença de reason e readLifecycle conservador na fixture; sem supressões ou remoção de assertions | **CLOSED_SCOPED_EXACT_W17_TYPECHECK**: zero diagnostics próprios no SF; CLI e testes WP10 aprovados no job `132425652500` |

Não transfiro resultados de W16 nem declaro esses critérios funcionalmente aceitos.

## Identidade, pins, exclusões e critérios

Conferi **16.093 blobs** na árvore completa, **1.115 arquivos hidratados** por SHA Git e **28 alterações**, sem deletes. São **6 mudanças próprias de código/testes**, **4 adições de recibos** e **18 blobs estrangeiros exatos**. O manifesto corresponde ao delta; todos os **393 pins efetivos** conferem e não há violação de ownership/exclusões. Nenhum recibo anterior mudou.

Os novos produtores estão fixados em PR31 `01633144c83fb1080e6d985ef226b8db2aa131cb`, PR33 `2784daafbb0d3b58b6019822288a07fa38e5c5b0` e PR36 `c21a990c57b714cd60bb7f915beb6be51acbafdb`. Fiz nove leituras remotas próprias por GitHub MCP, incluindo run-store e analysis-port tanto no W17 quanto no commit produtor. O JSON registra hashes e escopo de 27 fontes examinadas; as demais conferências de pins são comparação independente com a árvore completa, sem alegar nova leitura remota individual de cada blob.

O handoff arquivado mantém o blob `d1ac5e6da263fc2dd1766f13e4368b898bcceab5` e as **128 cópias estrangeiras / 131 inputs somente leitura**. O mapa draft ainda paramétrico preserva literalmente os **171 critérios / 7 tasks**, incluindo ID/texto/família/task/título, e não constitui aceite W17. O finding C17 e a prova faltante de lifecycle precisam integrar as obrigações dos critérios afetados.

O freeze9 segue **37/38**. O único mismatch é o host: esperado SHA-256 `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922`, atual W17 `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`. WP00 precisa publicar o binding exato; não houve mudança própria do freeze/test estrangeiro.

## Demais deltas e busca de bypass/ciclo

O novo run-store fixa digests antes dos awaits, rejeita alterações do caller/verifier e clona os valores admitidos para o staging C08. Mantém CAS terminal e captura privada Alternative. O analysis-port liquida unavailable/needs-input da publicação por reentrada fresca; denied/conflict não ganham escrita terminal. Não encontrei enfraquecimento próprio nesses deltas, mas os testes de aliases e lifecycle ainda precisam do resultado hospedado exato.

A alteração BI inclui referenceDigest tanto na allowlist exclusiva de bi-source quanto no digest da intenção autenticada. A fixture estrangeira WP02 passa a compor BusinessServices/cases reais e continua declarando scanner ausente. O delta inspecionado do workbench preserva suas assertions. Nada disso representa execução nativa.

Os guards existentes limitam ancestry/replay a16 níveis e recusam self-recursion; o scope privado usa C08 direto em vez de reabrir cases.read para sua própria seleção. Não encontrei ciclo ilimitado introduzido pelo helper, porém o histórico C17 permanece recusado. Essa observação estática não equivale a uma prova positiva de runtime.

## CI e gates ainda pendentes

Check W17 inspecionado: snapshot **`585831c5d9279a7b87f804bc3598ed66af1bb9e5`**, run **`43587702180`**, job **`132425652500`**. Consulta independente por GitHub MCP confirma conclusão **failure**. O artefato **`14111600606`**, ZIP SHA-256 **`7dc49186b98b1732a8ab444a1d535b9b4d44a77cfc71d83066432b5fefb3247c`**, e seus 11 arquivos foram conferidos; revisions.txt corresponde exatamente ao W17.

| Gate observado | Resultado |
| --- | --- |
| Typecheck SF | **FAIL: 19 diagnostics estrangeiros, zero próprios** |
| Typecheck CLI | Sucesso, zero diagnostics |
| Typecheck dos consumidores de teste WP10 | Sucesso, zero diagnostics |
| Geração/check Atlas e typecheck Atlas | Sucesso |
| Spawn-imports | Sucesso: 4.674 arquivos, 66 sites permitidos |
| Guards contra a base dev fixada | Sucesso: 78 regras, 1.301 caminhos, zero gate findings, 48 warnings, zero errors |

Esses resultados fecham **somente** o achado de tipos próprios `R1-W16-TYPES-02`. Não tornam o typecheck SF integral ou o check geral aprovados e não comprovam a execução funcional. Requests funcionais W17 ainda não possuem prova terminal observada por R1.

O implementador informou término da seleção **W16 A `43585812801`: 82 PASS / 20 FAIL em 102 testes, 18 arquivos**. Não inspecionei seus logs nesta rechecagem; as falhas de BI/review precisam de triagem própria e nenhum resultado é transferido ao W17.

O novo delta C17 do produtor PR32 `35b9fd4f532abeb1058f00281d4ad8885ca9966f`, informado pelo implementador após o finding, ainda não faz parte de W17 e não foi julgado neste parecer. Exige composição auditada e nova rechecagem do candidato publicado.


C07 continua dependente de adapter e recibos reais; cinco descritores de rotina,39 operações e oito packs não são declarados aceitos. Os 19 diagnósticos estrangeiros observados mantêm seus owners e bloqueiam o check SF integral. Scanner/AM, residentes e epic/global permanecem para o bundle completo. Três revisores independentes e rechecagem do candidato final continuam obrigatórios.

Nenhum produto, build, teste ou typecheck foi executado localmente. Não houve edição de produto/testes nem mutação remota. **W17 não está aprovado; aceite funcional, nativo e global permanece falso.**
