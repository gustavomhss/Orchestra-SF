# Missão40 — handoff para sessão33

**Estado terminal: `M35-C17-ORIGINAL-REVALIDATION = RESOLVED_ON_RECORDED_CLOSURE`. Autoridade da missão40: `HANDOFF / ENDED`; nenhum source writer ativo.**
O produto final da origem é `1b2a58c687af47558d215e195a1e1abdf9f40df5`, em `astra-wp10` / PR29. F02 passou com 18 testes; o arquivo original35 passou integralmente, sem alteração de suas assertions, no closure C10 registrado abaixo. A contraprova B01 demonstrou o comportamento vulnerável antes da correção. CHECK2 eliminou todos os diagnostics próprios, preservando os 13 herdados. Esta entrega resolve o finding no closure comprovado; preserva os limites de MI07, AM05 e compilação composta descritos neste handoff.

## Autoridade e leitura

- Missão: `memory-original-reauthorization.json` em `98e6c9c4847d0f3239a0f9cf1fcc1afd6fbb338b`, blob `412a17f0af27ba66d4a8d8c79823752db3bf67d6`.
- Planejamento fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; pack completo S0-B, COMMON e anexos registrados em `READING-AND-CRITERIA.json` e no recibo de autoridade da missão.
- Head recebido e handoff terminal13: `539a3c7f95174190f783debc74e3694d84ca8653`.
- Entrega35 e proposta revisada: `975c42ec29c15ccd0d4d6fa17aefd44d64bd1eab`. A proposta era PROPOSTA/NÃO TESTADA; a implementação entregue incorpora adaptação para o callback instalado e seleção de capturas já commitadas.
- `astra-wp10` / PR29 permanecem a origem da entrega. Somente a sessão33 integra `sf2-stack`; esta missão não moveu esse ref.
- A autoridade de escrita de produto da missão40 terminou neste handoff. Não há source writer ativo; a sessão33 recebe o patch, os testes e a evidência para sua integração por CAS.

A escrita de produto está limitada a `product/host-binding/business-context.ts` e `product/host-binding/atlas-memory.ts`, sob `modules/sucafina/Sucafinav1/`. Testes e recibos próprios usam o namespace `memory-original-reauthorization`. A prova de processo separado da35, persistência34, engines Atlas, CLI host, workflows e arquivos dos demais writers permanecem preservados.

## Correção entregue

`memory.readOriginal` público agora reabre a autoridade atual do caso, valida os registros ligados à captura e reautoriza suas fontes. Aceita resoluções `fresh` ou históricas legítimas com captura íntegra; recusa alterações de bytes, corrupção, revogação e troca de identidade/encarnação. Antes do retorno, repete as observações de fontes e compara captura, caso, partição Atlas, outbox e fences de fontes. O retorno usa uma cópia da referência capturada, sem regravar o original.

A captura privada permanece disponível para a resolução histórica. Um escopo `AsyncLocalStorage` restrito ao callback ativo, ao mesmo call e ao mesmo digest permite que `initializeAtlas.caseForEvidence` localize a captura sem recursão pela autorização pública. O teste instalado usa o callback real. Chamadas públicas sobrepostas não herdam esse escopo.

O núcleo de leitura de registros aceita seleção interna do original/evento já commitado. Assim, a captura e o replay de A continuam disponíveis quando um evento posterior B está `pending`, enquanto o recall público do caso conserva sua recusa por pendência. O positivo A/B impede que uma negativa seja obtida negando todo o histórico.

O caminho de recibo `already-committed` reabre o caso e revalida todas as fontes e a captura correspondente, mesmo com um callback de ACL limitado a participação/autoridade. Seu retorno não executa scanner, append, transação de recuperação ou criação de outro recibo. Os testes comparam o estado persistido e os contadores antes/depois, inclusive sob corrupção tardia.

Request por identidade, conteúdo dos headers, binding, lease, abort e observações já lidas são fixados e conferidos após os awaits relevantes. A última revalidação fica dentro da leitura protegida de C08, seguida de comparação síncrona dos snapshots antes do retorno.

## Identidade dos produtos e patch

| Papel | Commit W | Árvore |
|---|---|---|
| Runtime e testes F01 | `ecbc9b8b5902e3d43891631cd90d70faa340e6c4` | `714d43c0a9e7153c26d8c4aefa55a8a479e8e628` |
| Produto final da origem, após três correções de tipos próprias | `1b2a58c687af47558d215e195a1e1abdf9f40df5` | `f80bf7b2bc24966a9709ed2ab16bae6c93d24b94` |
| C10 fixo usado na prova35 | `0c395c462ce0fae67cb274c45ccb06884877d7cd` | `d34dba1f7eca5a1bce546a0b6fab9d9ec5aef5b7` |
| Closure35 comprovado; arquivo integral PASS | `9902a8f2a3c3ca0b11bae17c7c369fdb0ed22732` | `856c1913e383d48d9392ac089722b45cde41a49b` |
| `sf2-stack` observado; somente leitura | `36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1` | `d6cc2b9f562ddc390e13a0645aae510bb5bd4e13` |

Os dois postimages de runtime são iguais em F01 e na origem atual. As alterações entre esses produtos corrigem somente os três erros de tipos próprios identificados no primeiro check.

| Arquivo relativo a `modules/sucafina/Sucafinav1/` | Preimage em origem recebida, C10 e stack observado | Postimage entregue |
|---|---|---|
| `product/host-binding/business-context.ts` | `6e0aba2f7aa058cef1b35ecd0c963312e98ef993` | `390bce2594e39a28defce1d47fafa0d7291e940e` |
| `product/host-binding/atlas-memory.ts` | `91e8bc8f5d80f83b7756b4647c790cc5e5936d59` | `a45ab53b1dab706eedb3b0d075bbfe36a00be40d` |

Patch completo dos dois arquivos: `owner-patch/0001-original-and-replay-reauthorization.patch`.
SHA256: `08968ae49b79e5833520b69eb6ec63c871df34c57c3840e673ba7984276be8f2`.
O patch usa os preimages explícitos acima; não transportar o branch de origem inteiro para compor o bundle.

Patch dos testes próprios: `owner-patch/0002-mission40-tests.patch`.
SHA256: `9d479f9b4edd2d509633e89da4555b6c551774ae9009675ed4371332222a7d99`.

O commit documental de entrega é identificado externamente como o commit que introduz esta versão de `HANDOFF.md`. Ele deve ser filho direto do produto final `1b2a58c687af47558d215e195a1e1abdf9f40df5`, acrescentando somente os recibos/documentação autorizados e preservando os bytes de produto e testes já comprovados. Seu SHA é obtido do histórico Git, sem inserir um hash autorreferente neste arquivo. O W de produto permanece o indicado acima.

## Resultados de validação

Todos os testes e checks abaixo usam GitHub Actions pela interface/dispatcher existente. Não houve teste, servidor ou typecheck local; não houve ampliação de budgets, skip ou epic/full suite.

| Pedido | Produto / envelope | Seleção e resultado |
|---|---|---|
| B01, contraprova anterior à correção | W `0706b084e87bd78758f445e6283541d8eb79e783`; S `e8c8916b859e2cbfc281948f225dce223a4b8926` | [Run 43648633283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43648633283): **0 PASS / 2 FAIL; 37 expects; 13.88 s**, vermelho esperado. O original ainda era devolvido após alterar os bytes do documento; replay devolvia `already-committed`, inclusive com captura corrompida. |
| F01 | W `ecbc9b8b5902e3d43891631cd90d70faa340e6c4`; S `02108777fcd4f4e01beb5ec9bdd41a4e4bd419b3`; árvore S `c84625c3e87324201c40971e16a4b14fb3b99071` | [Run 43649218257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649218257), job `132613718305`: **15 PASS / 0 FAIL; 260 expects; 688.05 s**. Três arquivos próprios completos. **Omni PASS (15/30)**; cleanup job `132617135109` success; nenhum artefato publicado. |
| CHECK1 | W F01; S `0fe6fa076a2bfa8b33fa5442c47627f3073645aa` | [Run 43649219986](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649219986): Sucafina FAIL com 13 herdados + 3 próprios. Os três foram corrigidos na origem atual; histórico do resultado preservado. |
| CHECK2 | W `1b2a58c687af47558d215e195a1e1abdf9f40df5`; S `3022e0945a79f5bd9faf26c4f6a4f3be903e428a`; árvore S `ecc0ea2ee48e797c747bd32234ddeacd926d3984` | [Run 43649819285](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649819285), job `132615552942`: **13 herdados idênticos; 0 próprios; added=[]; removed=[]**. Sucafina FAIL herdado; demais checks PASS. |
| F02 | W `1b2a58c687af47558d215e195a1e1abdf9f40df5`; S `33d829f96c2f4cad74d7610da089c4aa1162d4ba`; árvore S `210c902a04fc114f3f917685ae7f16c31d226715` | [Run 43650471583](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43650471583), job `132617571523`: **18 PASS / 0 FAIL; 311 expects; 710.19 s**. Os 15 próprios + 3 MI08 de `wp10/memory-integrity/revocation-tail.test.ts`. **Omni PASS (18/36)**; cleanup job `132621213750` success; nenhum artefato publicado. |
| Original35 | W `9902a8f2a3c3ca0b11bae17c7c369fdb0ed22732`; S `57882fd8ecabb9b3a9e458ea644c81260fbf514a`; árvore S `7fc0b5cd838251166cdcdca8094efdcf0e9c5c34` | [Run 43651719591](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43651719591), job `132621440454`: **2 PASS / 0 FAIL; 95 expects; 75.19 s**. Arquivo original35 integral no closure C10. **Omni PASS (2/5)**; cleanup job `132622221412` success; nenhum artefato publicado. |

CHECK2 executou o typecheck completo de Sucafina, cujo `tsconfig.json` inclui o namespace novo por `test/**/*.ts`. Seus 13 diagnostics são as mesmas linhas integrais, na mesma ordem, de `receipts/WP10/memory-integrity/check-36/BASELINE-DIAGNOSTICS.json` no head terminal13, após remover apenas timestamp/ANSI. O typecheck suplementar WP10 cobre somente a subárvore WP10 e não substitui essa comparação.

Em CHECK2 passaram: consumidores CLI, consumidores WP10, geração canônica Atlas, boundary Atlas, guard de subprocessos e guards contra `origin/dev`. Subprocessos: **4702 arquivos / 66 pontos permitidos**. Guards: **78 regras / 2259 paths / 0 gates / 53 avisos / 0 erros**. Artefato `astra-wp10-check-1`, ID `14135427236`, 4364 bytes, digest `sha256:cb52ef6e102f551cf5d8253b4e6fe84efd437d9d81306f130b220c260d290a3d`.

### Cobertura dos 15 casos próprios

| Arquivo | Casos | Discriminadores |
|---|---:|---|
| `installed-original.test.ts` | 10 | Originais intactos; callback real sem recursão; C12 histórico legítimo e captura corrompida; A commitado com B pending; revogação no mesmo call; principal/binding/lease/caso/encarnação trocados; headers, Request, abort e fim de lease tardios; revogação após última resolução de fonte. |
| `document-replay.test.ts` | 2 | Documento C17 real com bytes alterados, captura corrompida e identidade inválida; replay com ACL leve; dependência B removida/recriada enquanto A permanece fresh; estado e contadores invariantes. |
| `replay-fences.test.ts` | 3 | Fences tardias do replay; logout real depois da última resolução; corrupção de captura depois da última resolução sem reparo automático, com replay positivo após restauração explícita da fixture. |

Os testes instalados usam `withMemoryIntegrityFixture` sem alterar a fixture original. Os testes documentais usam credenciais reais da fixture, C08/SQLite, extração/confirmação e Atlas/Gitleaks; a fixture WP06 substitui o scanner de ingresso e declara premissas sintéticas de fornecedor/ledger. Esses positivos não constituem um witness de Session nativa: `nativeSessionWitness=false`.

## Prova original35 e closure coerente

O closure35 muda **somente quatro paths sobre a árvore C10 completa**: os dois postimages de runtime acima e os dois blobs publicados da35 abaixo. Os arquivos da35 são consumidos integralmente, com assertions, protocolo entre processos e deadlines inalterados. Não há escrita no ref `sf2-stack`.

| Dependência imutável, relativa a `modules/sucafina/Sucafinav1/` | Blob na entrega35 | SHA256 |
|---|---|---|
| `test/product/wp14/source-access-atlas.test.ts` | `a7d5b4c8346c8f092b4497e7ae8c44aa5f8b53c9` | `5b5cababd46f64fc8b7187df3a24da7cab832276f843a2f4b314e0a7b27dd4ef` |
| `test/product/wp14/atlas-restart-reader.ts` | `65c5fd04f6af34a241e6cc0bd40cd968cdc6e353` | `87915c7647c66d457be91176bbc8a2d566ce7e1bb1afe1f643e8033c1e6ce1ce` |

Origem desses blobs: `975c42ec29c15ccd0d4d6fa17aefd44d64bd1eab`. Seleção executada: arquivo completo `Sucafinav1/test/product/wp14/source-access-atlas.test.ts`, via pacote `sucafina`, diretório `modules/sucafina`, Bun e argumento `--timeout 120000`, conforme pedido existente. Os testes mantêm 180000 ms; o filho mantém deadline cooperativo 90000 ms e limite 120000 ms.

Na entrega35, run `43645747336`, houve **1 PASS / 1 FAIL**. O componente de reinício passou, com parent PID4089, child PID4140 e exit0. A negativa C17 falhou porque a resolução canônica recusou o documento após mudar seus bytes, mas `readOriginal` devolveu a referência antiga. A hipótese de replay subsequente não havia sido alcançada. Esse resultado histórico permanece preservado.

O run da missão40 `43651719591` comprovou os dois testes originais no produto composto exato. O parent PID4120 lançou o child PID4170, que terminou com exit0. A leitura autorizada retornou `ok`, com `matches=1`; outsider, revogado e identidade substituída retornaram `unavailable`. A auditoria da captura permaneceu inalterada; `nativeSessionWitness=false`. O bloqueio restante C17 passou sem alterar suas assertions.

Prova de processo em JSON bruto: `runs/M40-35-process-proof.json`.
SHA256: `bb902845df2fc79427873210085458ff3c6ece0f637a81d593ec1fe08108138a`.

## Critérios e limites que permanecem explícitos

| Critério | Disposição terminal |
|---|---|
| Reautorizar caso/fontes e integridade no original público | F01 e F02 PASS; B01 vermelho esperado comprova a regressão anterior; original35 PASS no closure registrado. |
| Preservar histórico legítimo e captura imutável; evitar recursão instalada | F01 e F02 PASS; positivo A/B e C12 incluídos. |
| Replay commitado sob ACL leve sem scanner/append/novo recibo/efeito | F01 e F02 PASS nos testes próprios, inclusive dependência B e corrupção tardia; B01 demonstra o replay indevido anterior. |
| Preservar fences e revogação tardia | F01 e F02 PASS, incluindo os três MI08 adicionais no produto final da origem. |
| Original35 integral na composição coerente | **2 PASS / 0 FAIL**, run `43651719591`; `M35-C17-ORIGINAL-REVALIDATION = RESOLVED_ON_RECORDED_CLOSURE`. |
| Compiler/guards da origem atual | CHECK2: zero diagnostics próprios; 13 herdados impedem declarar full typecheck PASS. |
| Compiler/guards do produto composto | **NOT_RUN**. C10 não contém o workflow `astra-wp10-check`; um check na origem não qualifica o closure. Não acrescentar workflow nem usar epic para contornar essa lacuna nesta missão. |
| MI07 histórico integral | **INHERITED_FAIL_NOT_CLOSED**. Run `43637227753`, W `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`, S `e63511737be687a2e42f9a15706a229db42a31c1`: deadline 225000 ms atingido antes de corrupção e tail de revogação. F01/F02 curtos não o substituem. |
| AM05 nativo completo | **OPEN**. Ausência de witness completo de Session/binding/provider ou Task/SkillLoadReceipt/consumer nativo. O reinício de componente e os testes curtos não fecham AM05. |
| Finance integral e full suite | **NOT_CLAIMED**. Esta seleção cirúrgica e o arquivo original35 não qualificam o fluxo Finance integral nem a suíte completa. |
| Aceite global da campanha, merge/deploy/restart | Não concedidos nem executados. Mantidos 15 WPs, 74 tasks, 17 contratos e 1610 critérios do planejamento. |

## Protocolo para a sessão33

1. Reconciliar a autoridade e o head atuais de PR29/`astra-wp10` e de `sf2-stack`. O head `36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1` é uma observação, não uma autorização para sobrescrever avanços posteriores.
2. Conferir os dois preimages na árvore de integração efetiva. Se ainda forem os blobs da tabela, aplicar os dois postimages do patch e conferir os blobs resultantes. Se ambos já forem os postimages, reconhecer a aplicação existente sem repetir a mutação. Em divergência parcial/material, reconciliar os bytes e definir nova prova; não reutilizar verde de outro produto.
3. Transportar testes/recibos próprios pelo manifesto final da missão. Preservar bytes e autoria dos dois arquivos35; não substituir arquivos de outros writers nem misturar a árvore inteira do branch de origem com o bundle.
4. Consumir os resultados terminais F02 e original35 já registrados, com seus produtos, envelopes, runs/jobs e vereditos Omni. Não repetir o trabalho concluído por este handoff. Uma integração materialmente diferente exige avaliação da diferença e prova apropriada ao novo produto; o PASS do closure registrado não qualifica uma árvore diferente por herança.
5. Para eventual nova validação necessária à integração, deduplicar por árvore efetiva de produto, seleção, ambiente/configuração/fixtures e tentativa. Reanexar ao run equivalente em andamento; no máximo um teste WP10 em voo. S descende de W e acrescenta somente `.ci-run.json`; criar o ref temporário diretamente em S conforme o dispatcher. Um cancelamento, seleção vazia ou resultado de outro W não vale PASS.
6. Usar somente GitHub MCP para operações remotas, CAS com o head esperado e avanço sem force. Preservar branch, PR e histórico operacional; não fazer merge em `dev`, deploy, Azure, alterações de credenciais/engines ou restart do Orchestra.
7. Registrar o commit documental de entrega pela regra de filho direto acima e a integração posterior por CAS. Qualificar a compilação composta apenas pelo caminho autorizado pela sessão33, sem declarar PASS por herança dos checks da origem. A autoridade da missão40 está encerrada; a integração pertence à sessão33.

## Encerramento e preservação da evidência

F01, F02 e original35 têm resultados terminais e cleanup bem-sucedido; não publicaram artefatos de Actions. Os logs, pedidos, vereditos e o JSON bruto de processo compõem a evidência registrada nos recibos. CHECK2 publicou o artefato identificado acima. B01 preserva a contraprova anterior ao patch; CHECK1 preserva os três erros de tipos próprios posteriormente corrigidos.

O finding `M35-C17-ORIGINAL-REVALIDATION` está resolvido no closure registrado. MI07, AM05, os 13 diagnostics herdados de Sucafina, a compilação de C10 não executada e Finance/full suite não reivindicados continuam explícitos. Não houve merge em `dev`, deploy, Azure, modificação de credenciais/engines ou restart do Orchestra.
