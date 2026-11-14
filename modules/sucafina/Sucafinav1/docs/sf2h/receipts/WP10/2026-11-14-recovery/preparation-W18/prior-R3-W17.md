# R3 — rechecagem independente W17

**Parecer: CHANGES_REQUESTED / HOLD para composição histórica C17 e provas hospedadas do candidato exato.** As causas de código dos três findings R3 do W16 foram corrigidas. Os dois erros de tipo próprios estão fechados no recorte comprovado pelo check W17. A reentrada stale e a seleção BI ainda aguardam comprovação funcional; o novo bloqueio C17 identificado por R1 impede aceitar a composição.

## Identidade e independência

- Candidato: `2ec17b2c8204d5e953eec3186b7e236c0faaad47`.
- Tree: `526f67866223b8b73e1bcae16e45ec9377b1af2e`.
- Parent W16: `f3b9f512fbcae66bc369ff7dbbe6fa433ae4c9d0`.
- Branch `astra-wp10`, PR 29 contra `sf2-stack`.
- Revisor: `/root/independent_r3_w16`, mesmo agente independente que examinou W16.

Não participei da autoria ou correção do produto. Não executei testes, typecheck, build ou browser de produto localmente; não publiquei, não alterei branches nem fiz mutações remotas. Escrevi somente pareceres e recibos próprios. Os relatórios W16 permanecem preservados. R1/R2 retêm sua autoridade independente.

## Rechecagem dos findings W16

| Finding | Estado no W17 | Evidência e limite |
| --- | --- | --- |
| R3-W16-HOST-CASE-REENTRY-01 | **Correção implementada; prova composta pendente** | O host usa `createSfAnalysisRunContext` e `allowHistoricalRetry`, conservando o seletor original. O teste novo não atravessa `preserveStale`/store/commit. |
| R3-W16-BI-SELECTOR-02 | **Correção implementada; recheck funcional pendente** | `referenceDigest` entrou na allowlist estreita e no digest da intenção. Falta resultado hospedado no W17 para as origens reais e recusas correspondentes. |
| R3-W16-TYPECHECK-03 | **Fechado no recorte dos dois erros de tipo** | Guard `"reason" in initialized` e membro `readLifecycle` explicitamente indisponível na fixture; checks CLI e consumidores WP10 passaram no W17. |

O helper novo clona o caso selecionado e o start; readmite a Request original para `analysis.start`; instala o holder de replay; entra com retry histórico; reautoriza antes do retorno; e libera holder e lease no `finally`. `selectedCase`, `resolveCase` e o verifier fresh continuam exigindo a versão exata. A mudança não seleciona silenciosamente a versão nova para execução fresh.

O novo teste usa admissão humana real, `BusinessServices` e C08, avança o caso e confirma que o callback consegue ler a nova versão enquanto o seletor fresh fica indisponível. Também cobre outro run, perda de participação, restauração, autoridade geral revogada, host inativo, abort e encarnação substituída. Contudo, o callback chamado `readLifecycle` apenas retorna a versão do caso. Não existe store de run nem chamada a `wrapStore`/`preserveStale` nesse teste. A fixture histórica existente exercita essas partes diretamente, sem o novo contexto externo.

Para fechar a regressão original, a prova deve compor o helper usado pelo host, `withCase` real, wrapper stale e store real na mesma chamada. Pode usar metadata de lifecycle explicitamente não executada, com fontes reais autorizadas. Precisa observar o commit stale, a versão e os bytes exatos da contribuição, mantendo o seletor original e as recusas de revogação/troca de encarnação. Essa prova não deve declarar Session, provider ou execução nativa que não ocorreram.

## Bloqueio C17 atribuído a R1

**R1-W17-CALCULATION-HISTORY-01 — aberto no W17; owner WP10, consumindo readers históricos publicados.** O finding completo e sua prova causal pertencem a R1, registrados em `reviews/R1/review-W17.json`. Este relatório não reivindica uma segunda reprodução independente.

Conforme R1, `withCase` ainda chama `cases.read`, que precisa resolver as referências mantidas no ledger. O adapter WP10 de cálculo usa os readers ordinários `requests.read` e `results.readForCalculation`; esses readers exigem a versão original do caso. Depois de um avanço legítimo v1→v2 com o C17 de v1 retido no ledger, a referência é recusada antes de alcançar o callback de lifecycle. Os readers explícitos `requests.readHistorical` e `results.readHistoricalCalculation` publicados pelo owner não estão compostos nessa rota do W17. A leitura R3 do adapter ordinário e de `withCalculationCase` é consistente com a cadeia relatada, mas não substitui a prova de R1.

O resultado é uma recusa segura impeditiva. Não foi classificado como vazamento, bypass fresh ou ciclo infinito. A correção precisa derivar o acesso histórico de caso/evento/referência reais e autorizados, conservar request/result/source/provenance originais e fornecer as projeções correntes/diferenças/continuidade exigidas pelo BCS. A igualdade de versão fresh permanece estrita. Não é suficiente copiar uma fixture histórica simplificada ou rotular a referência antiga como fresh.

O coordinator informou que encontrou novos outputs publicados PR32 para essa composição. Eles não pertencem ao W17 e não foram aceitos neste parecer.

## Store, concorrência e publication

Os dois arquivos de produção AI alterados foram lidos diretamente no candidato e também no source commit PR36 `c21a990c57b714cd60bb7f915beb6be51acbafdb`. Os bytes e blobs são idênticos nos dois lados.

O novo `run-store.ts` fixa os digests de comando/registro antes dos awaits, compara-os depois de preflight e autorização e novamente no callback de commit. A verificação continua recusando alteração do snapshot real. Antes de inserir valores no staging C08, clona run, output e provenance, impedindo que uma referência retida pelo chamador reescreva os bytes já admitidos durante a autorização final do provider. As verificações de CAS, `sourceFence: all`, estado terminal, output existente e proveniência permanecem.

As oito contraprovas novas do producer abordam mutação do run no preflight, substituição da saída no verifier, aliases durante a autorização final C08, alteração antes da autorização de publicação, mutação tardia em leitura, cancelamento que vence publicação concorrente e falha tardia após ready. Sua fixture declara autoridade injetada: ela prova a fronteira do store quando executada, sem qualificar native host ou ACL empresarial.

`analysis-port.ts` passa a persistir `unavailable`/`needs-input` de publicação por uma nova reentrada e `settle`. `failed` conserva seu caminho; `denied`/`conflict` continuam sem escrita terminal. CAS e a máquina de estados recusam sobrescrever um run já ready/cancelled com settlement tardio. Os novos testes de lifecycle cobrem essas distinções, mas não há recibo funcional W17 aceito neste checkpoint.

Os scopes de joint admission Alternative, os awaits finais sob C08 e os controles de histórico/recall são idênticos ao W16. As observações estáticas anteriores do mesmo revisor continuam ligadas aos mesmos blobs. Nenhum resultado funcional antigo foi transferido. O helper novo também não prova a composição com todas as formas de referência mista ou de cálculo.

## BI e egress

A mudança HTTP é limitada à allowlist e ao bootstrap autenticado. A seleção continua usando uma origem presente na linha devolvida pelo produtor real; o formato deve ser um digest canônico. Ausência em linha ambígua e origem externa continuam recusadas. Depois de resolver os links, o produtor é reaberto e sua projeção comparada. Os caminhos de Review atual/predecessor conservam a leitura final conjunta C08 e o digest completo dos corpos.

Não identifiquei regressão nova confirmada de autoridade nesses deltas. A ausência de resultado hospedado para `bi-source-choice.test.ts` no W17 mantém o finding funcional pendente. O W16 usa outro blob HTTP e não comprova essa correção.

## Verificação dos insumos

A comparação remota GitHub MCP W16→W17 coincide com as árvores completas: 28 paths, seis arquivos próprios de código/teste, quatro recibos novos e 18 inputs estrangeiros. Há 393 pins efetivos e nenhuma exclusão. Os recibos WP10 preexistentes permanecem idênticos. Ausência no checkout parcial não foi interpretada como exclusão.

O inventário registra 36 arquivos com Git blob SHA, SHA256, tamanho e limite de inspeção. Diferencia deltas relidos de blobs inalterados examinados anteriormente pelo mesmo revisor. Quatro arquivos tiveram seus bytes conferidos diretamente por MCP no candidato:

| Arquivo | Blob W17 |
| --- | --- |
| `analysis-run-context.ts` | `5b0f9e394f433bc904724019678d08555078dc0b` |
| `extended-http.ts` | `65ec2c948a1c83aa7ada84d5f0f806bd236038b5` |
| `product/ai/run-store.ts` | `460ea7d043351f1b401b005d0cc383ff2e876a86` |
| `product/ai/analysis-port.ts` | `5526b59d0c7a06791968c9dbb4d94cd3145a5bf6` |

A proveniência remota dos dois últimos foi conferida também no source commit PR36. Os demais pins estrangeiros tiveram identidade candidato/manifesto conferida; não se declara auditoria semântica integral de todos os 18 inputs.

## Check hospedado W17

Run **43587702180**, job **132425652500**, snapshot **585831c5d9279a7b87f804bc3598ed66af1bb9e5**. O log remoto registra checkout exato de W17. **Conclusão geral: FAILURE.**

| Gate | Resultado |
| --- | --- |
| Sucafina typecheck | FAIL, 19 diagnósticos estrangeiros, zero próprios |
| CLI typecheck | PASS |
| Consumidores WP10 typecheck | PASS |
| Atlas generation e boundary typecheck | PASS |
| Spawn imports | PASS |
| Guards | PASS: 78 regras, 1.301 paths, zero gate, 48 warnings, zero erros |

R3 leu o log por GitHub MCP. Também conferiu o ZIP **14111600606**, 4.382 bytes, SHA256 **7dc49186b98b1732a8ab444a1d535b9b4d44a77cfc71d83066432b5fefb3247c**, contra o digest anunciado no log remoto; comparou suas onze entradas com os arquivos extraídos; e confirmou SHA/tree W17 em `revisions.txt`. Os 19 diagnósticos restantes estão integralmente registrados no JSON. Sua ownership estrangeira não altera a conclusão FAILURE.

Fonte: [check W17](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587702180). A execução W16 A `43585812801` terminou, segundo atualização do coordinator, em 82 pass/20 fail. R3 não releu seu log final neste checkpoint e não usa essas contagens como evidência W17.

## Limites e próxima revisão

Freeze9 continua **37/38**, verificado por hashes. O binding estrangeiro espera SHA256 `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922` para o host CLI; W17 tem `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`. WP00 deve publicar o binding dos bytes finais, conservando o teste estrito.

O JSON preserva os 171 IDs/textos e sete tasks. Não existe aprovação integral. Permanecem pendentes a composição histórica C17 de R1, a contraprova composta stale, a execução funcional exata das correções e os diagnósticos estrangeiros. C07/provider nativo, 39 operações, consumo 5/18/8, AM01–AM06, instalação limpa/scanners e epic global continuam sem aceite. Um sucessor de W17 requer relatório e evidência próprios; S0 revisará e integrará.
