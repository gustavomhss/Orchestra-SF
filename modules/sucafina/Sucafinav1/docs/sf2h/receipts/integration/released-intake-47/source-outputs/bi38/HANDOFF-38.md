# Handoff terminal38 — waterfall de custos do BI09

**Estado: implementação e patch completo entregues; qualificação do consumidor instalado bloqueada.** A PR24 permanece Draft e não está liberada como bundle aceito. Esta entrega não conclui BI10.

A missão38 termina seu lease `bi-waterfall-browser38` com uma unidade liberada para intake seletivo. A prova preparada de cenário, comparação e renderer reais não chegou a executar na branch fonte antiga: três imports necessários faltam nela. Os 17 casos do seam de Portfólio passaram; isso não demonstra o waterfall instalado.

## Destinatário e autoridade

Destinatário lógico: **sessão33**, conforme a missão. Foi observado seu handoff terminal e o ACK de sucessão da **missão42**, lease `S0-C-e8-browser42`. A entrega é consumível pela continuidade autorizada dessa cadeia; **consumo e ACK específicos de M38 não foram observados**.

A fonte38 não moveu `sf2-stack`, não enviou mensagens nem assumiu autoridade de integração. A restrição de CI da missão42 não foi tomada como autorização para executá-lo por ela: os gates do consumidor devem seguir S0/dispatcher e a autoridade vigente. Os runs abaixo são exclusivamente os autorizados para a fonte38.

Reconciliados: missão e COMMON em `edee66d9a22ab4a3090e6b461953e783b9910ca8`, planejamento em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, pack S2-B integral e anexos, head fonte `0881fee21f07bf8a9a1153d7d55727837cdf497a` e seu handoff DRAFT/BLOCKED. O ACK38 foi publicado em `d37494ad4015525c39062c9679f69b7e1f731ed8`.

## Identidades da entrega

| Papel | SHA |
| --- | --- |
| Primeiro produto W1 | `561c3646e2f56a99b4e2ffa74af5913bb7464ea0` |
| Snapshot S1 | `c9596d601e704fc801f25824e4d9ae8a59e77d5c` |
| Produto final W2 | `f1642ba926738befceb4cba66dc463f9c847cd02` |
| Tree de W2 | `eeb05ef64f82776c95ef1fab1859607a61ae40f2` |
| Snapshot final S2 | `8897e46674f528883c3efb3c59c4fd60bb0f9242` |
| Tree de S2 | `032c2e8d06f9c1f908d367672ba853a8780263a0` |
| Base material de implementação observada, com documentos C11 | `e7e97591edfc15f230856a035e32951f2f700c2f` |
| Alvo usado para conferir dependências e sucessão | `c5ab23fd7c9b231917bf70123958c9ff03e7d420` |
| Último head integrador com os cinco preimages novamente conferidos | `36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1` |

Cada S é filho direto de seu W e difere exclusivamente por `.ci-run.json`, conforme compare do GitHub. Todos os outros blobs Git são iguais. Os dez postimages de produto/testes de W2 e o patch foram relidos remotamente e conferidos contra o manifest.

O commit que acrescenta este handoff e `TERMINAL-38.json` é documental, filho de W2. Seu SHA exato fica no corpo da PR24 e na resposta de entrega. Não se atribui uma nova execução a esse commit documental.

## Implementação entregue

1. **`bi-services.ts`** monta BI09 de cenário em `projectedScenario` e conecta a seleção equivalente de Portfólio ao mesmo produtor. BI10/BI11 mantêm as rotas anteriores; os outros produtores continuam na factory.
2. **`analytics/scenario.ts`** oferece `createScenarioCostBiHost`: valida a comparação persistida, relê o par por C08, conserva baseline histórico legítimo e consome `plannerScenarioBiPresentation`. Usa snapshot read-only e novas observações antes da saída.
3. **`analytics/portfolio.ts`** admite um callback opcional de projeção com clones, seleção fixa, envelope preservado e releitura. O caminho anterior de `present` continua disponível.
4. **`analytics/waterfall.ts`** verifica a contribuição contra os endpoints fornecidos sem corrigir valores. Identifica subtotais conhecidos, preserva null/ausência, tabelas e origens acessíveis.
5. **`analytics/view.ts`** mantém período, moeda, versão e limitações também quando o produtor fornece apenas tabela, sem valores de gráfico.

Os valores, deltas, ordem, labels e endpoints vêm do produtor canônico existente. Não houve outro cálculo financeiro, residual de fechamento, moeda convertida pelo renderer ou zero fictício. O bridge conserva o resultado original de Portfólio, sua cobertura e seus custos externos não quantificados.

**Limite histórico:** suporta o baseline anterior com candidato/comparação da versão admitida atual. Não declara suporte geral à reabertura de candidato também histórico após revisões posteriores do caso. Nenhuma identidade ou versão é reescrita para contornar C08.

## Unidade de consumo

- [Patch integral](integration/M38-BI09-WATERFALL.patch)
- [Manifest com todos os preimages e postimages](integration-manifest.json)
- [Explicação da implementação](IMPLEMENTATION.md)
- [Pins de dependências e autoridade](DEPENDENCY-PINS.json)
- [Request cirúrgico do consumidor](CONSUMER-33.ci-request.json)

**SHA-256 do patch:** `b9574dc964d46fa22929ad814264e9922871e7309cffcacf09e5bb080ca0f827`.

**Blob Git do patch:** `ab4363ef9831caa4aea957ce0e2d3b35e22ffb64`.

O patch contém o delta completo dos cinco arquivos de produto e os cinco arquivos novos de teste/fixture. Há cópias integrais de todos os preimages existentes e de todos os postimages dentro de `integration/`. A conferência estática `git apply --check` passou sobre esses preimages; nenhum código de produto foi executado localmente.

| Arquivo de produto | Preimage de integração | Postimage |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/bi-services.ts` | `b6a84dd807207e9b6791dc10f1419ec756ea1167` | `280627cbb683c2f401a8c37f90b6c727f9de7b94` |
| `analytics/scenario.ts` | `b7174b16b485323f767d63e6842f3d61284245eb` | `c116831c71e2df3e30c6b058f4eff8d26ce6ce07` |
| `analytics/portfolio.ts` | `4fd2a1ec2fc8cc78b21699e5a008362fec588444` | `fda4f51c8ccc8e45c959e8531f0cd63435c24d57` |
| `analytics/view.ts` | `4a6d481a8c7de805d7e13a3d3ab334beffd5692e` | `85480f85cf36f20ab7ba7ac7e142d457653ae292` |
| `analytics/waterfall.ts` | `fef3b0546384fcb0739fcf11ef531406c60ad760` | `cc4d834d3336ca17ca5b7bf15883c6dbd77f64ab` |

Os paths abreviados `analytics/` pertencem a `modules/sucafina/Sucafinav1/product/`. Os cinco preimages são idênticos em C9, C11 e no último head conferido. Os arquivos novos devem continuar ausentes no alvo até o intake; se houver mudança concorrente, reconciliar pelo manifest antes de aplicar.

**Não fazer intake da branch inteira nem cherry-pick cego da fonte antiga.** O source W2 contém apenas os paths autorizados e não importa a closure de C11. No alvo observado, factory, produtores, portas e host já existem: não foi identificada outra montagem de código fora dos cinco paths como requisito deste patch.

## Resultados reais das Actions

| W / gate | Resultado | Run |
| --- | --- | --- |
| W1 / quatro arquivos de teste | **17 PASS; 3 falhas de carregamento; 3 errors; 42 expects** | [43649330734](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649330734) |
| W1 / typecheck | **FAIL, 335 diagnósticos** | [43649332388](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649332388) |
| W1 / guards + árvore rastreada | **PASS** | mesmo check |
| W2 / mesmos quatro arquivos | **17 PASS; 3 falhas de carregamento; 3 errors; 42 expects** | [43649817896](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649817896) |
| W2 / typecheck | **FAIL, 334 diagnósticos** | [43649821021](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649821021) |
| W2 / guards + árvore rastreada | **PASS** | mesmo check |

Os 17 corpos executados pertencem a `portfolio-binding.test.ts`. Os **28 corpos** preparados nos outros três arquivos não executaram. Bun contabilizou 20 testes porque também contou os três erros entre testes; isso não significa que três assertions do waterfall rodaram e falharam.

### Bloqueios de carregamento

| Arquivo selecionado | Dependência ausente na fonte |
| --- | --- |
| `waterfall-contract.test.ts` | `product/analytics/source-navigation.ts` |
| `presentation.test.ts` | `product/planner/scenario-bi.ts` |
| `rendering.test.ts` | `test/product/wp07/chromium-cleanup.ts` |

Esses arquivos existem no alvo integrado e têm blobs registrados em `DEPENDENCY-PINS.json`. Outras APIs e fixtures da closure integrada também não existem ou são incompatíveis no source antigo; não foram copiadas para fora do escopo autorizado.

**Controle Omni, nos dois runs: MISSING / NOT PASS.** O nonce esteve presente, mas não houve verdict final correspondente. O preload canônico já está no bunfig. Nenhum import redundante, verdict impresso por teste, variável de rollback ou mudança de escopo foi acrescentado. A causa específica da ausência do hook não foi estabelecida; não se afirma que o controle passou.

A instalação do test-ci registrou `Saved lockfile`. A igualdade W/S prova os inputs Git, não uma árvore de trabalho frozen após a instalação. A lane check usou `--frozen-lockfile` e concluiu a verificação de árvore rastreada intacta.

### Typecheck e guards

O check canônico executou `bun typecheck` em `modules/sucafina`. A comparação por arquivo+código TS e multiplicidade conserva os **183 diagnósticos do predecessor**. W1 acrescentou 152. Foi corrigido um erro próprio de expectativa tipada (`TS2769`, razão de recusa alargada para string), sem mudar o oracle; W2 conserva 151 diagnósticos adicionais em arquivos tocados, associados à incompatibilidade da closure fonte e seus erros posteriores de tipo. Não se afirma que todos desaparecerão sem typecheck do alvo.

Guards: **78 regras, 649 paths, 0 gates, 13 warnings, 0 erros**. Os 13 registros de path/regra/mensagem são iguais aos do predecessor; nenhum é novo de M38. A orientação `guardrail-usage` foi lida. Não houve ignore, label de aprovação ou mudança de regra. Base real `origin/dev`: `a1d37698a7bb097c1578f827eba6a19b9917ef07`; merge-base: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

Typecheck separado de `apps/cli` e typecheck/guards do candidato integrado com M38: **NOT_RUN**. A lane existente da fonte não executa esses gates. Eles permanecem na solicitação do consumidor.

Os artefatos dos checks são [14135975039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649332388/artifacts/14135975039) e [14135513369](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649821021/artifacts/14135513369). Metadados e downloads foram obtidos via GitHub MCP; os conteúdos de identidade, typecheck e guards foram lidos nos logs completos. Os hashes de ZIP registrados são os declarados pelo provider, sem alegação de hash local ou decompactação. A lane Bun não publicou artefato Playwright.

## Testes entregues e lacunas

A fixture usa fontes sintéticas declaradas, caso vazio, SQLite real, admissão humana, promoções sequenciais, comparação C08 e dispatcher instalado. Os testes preparados cobrem custo completo confirmado por categoria, condicionado, null, zero, negativos/cancelamento, Portfólio equivalente, fonte/identidade/autorização revogadas e renderer real.

A prova de browser é de cenário. A prova de Portfólio compara a composição real equivalente; não é outra jornada de browser independente. A origem por teclado verifica o payload exato ao callback, sem alegar reabertura C17 completa. BI11 positivo depende da prova complementar existente solicitada ao consumidor. O caso literal training=40000 com histórico de escolha não foi reproduzido por M38.

## Critérios e aceite

| Critério | Disposição de M38 |
| --- | --- |
| `M27-BI09-WATERFALL-MOUNT` | Implementado; consumidor instalado ainda não qualificado |
| `WP05.T05.CHK.03` | Asserts exatos produtor/tabela/marcas preparados; execução bloqueada |
| `WP05.T05.DOD.20` | Consumo de refs/coverage real preparado; execução bloqueada |
| `WP05.T05.DOD.01` | Contribuição de implementação BI09; não fecha as 8+3 perguntas |
| `WP05.T05.CHK.20` | Oracle histórico literal não reproduzido |
| `WP05.DOD.04`, `WP05.CMP.04` | Não requalificados integralmente por esta missão |
| BI10 | Sem fechamento novo |

Os seis textos normativos completos estão em [CRITERIA-38.json](CRITERIA-38.json). Os 108 registros e resultados históricos de WP05 permanecem nos recibos anteriores, com seus próprios SHAs. Não há promoção de NOT_RUN a PASS nem aprovação independente de bundle pelo autor.

## Próximo consumo autorizado

1. Conferir o head e os dez paths do manifest. Aplicar somente o patch delimitado contra preimages iguais; conservar os outros paths do integrador.
2. Registrar o novo W consumidor e a proveniência dos blobs. A existência do patch não demonstra aplicação ou aceite.
3. Pela autoridade vigente de S0/dispatcher, validar e deduplicar `CONSUMER-33.ci-request.json`: quatro arquivos M38 mais `wp10/integration/bi-decision-navigation.test.ts`, total planejado de 48 casos. Criar S somente pelo protocolo autorizado; manter o limite existente e todos os asserts.
4. Executar os dois package typechecks pertinentes e guards contra a base real no candidato integrado. Resolver falhas nesse candidato e conservar seus runs desfavoráveis.
5. Registrar ACK, alcance e resultados do consumidor. Manter os gates globais, AM, três revisões independentes e o aceite 8+3 sob S0.

Nenhum run está em voo neste fechamento. Fonte encerrada; unidade disponível para consumo seletivo. **GLOBAL_RELEASE = false.**
