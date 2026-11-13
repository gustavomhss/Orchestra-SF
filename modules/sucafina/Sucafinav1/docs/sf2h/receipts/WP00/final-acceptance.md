# WP00 — entrega de implementação e evidência

**Estado: DRAFT/BLOCKED.** A implementação e os probes próprios estão publicados; os contratos/corpus têm uma seleção verde de 40 testes. A aceitação integrada permanece bloqueada por consumidores C07/C08/C15, typecheck herdado, bootstrap real C15, scanner instalado ausente e cadeia nativa não observada. Não há READY_FOR_REVIEW nem GLOBAL_RELEASE.

- PR: [#20](https://github.com/gustavomhss/Orchestra-SF/pull/20), `astra-wp00` → `sf2-stack`.
- Seed: `7631b186e4249abd0fc24c7d10beb62355db3f3b`.
- Base da PR: `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`.
- Último candidato de código executado: [`70476b99e0a34c4432d48f5d2f3710c26562aa1b`](https://github.com/gustavomhss/Orchestra-SF/commit/70476b99e0a34c4432d48f5d2f3710c26562aa1b); tree `56f717d5713bb48710f82ed66f9ef3d01292d90c`.
- Base efetiva dos guards: `origin/dev` em `a1d37698a7bb097c1578f827eba6a19b9917ef07`.
- Fonte normativa: plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

O commit que contém este recibo acrescenta apenas documentação/evidência ao candidato W5. Cada execução continua vinculada ao seu próprio SHA W e snapshot S; nenhum run foi relabelado como execução do commit documental. A comparação final da entrega com W5 está vinculada na PR.

## Implementação

O freeze revisão 7 reconcilia os 20 artefatos de contratos, C01–C17 e a matriz 5 perfis / 18 skills / 8 packs / 39 operações / 6 provas. O layout C08 define os 12 namespaces e os campos aditivos sem criar outro store. `host-context.ts` e `runtime.ts` não foram substituídos por cópias históricas.

O baseline cobre 28 entradas, 41 requisitos e 18 capacidades de IA, com destinos/owners e distinção entre semântica permitida e política financeira excluída. Os testes consomem Planner, Procurement e renderizadores DOCX/PPTX reais, com oráculos numéricos independentes e volume sintético 1000/200/100.

O verificador de ownership rejeita colisões de prefixos/arquivos e limita a exceção do workflow. Os negativos semânticos adicionais usam implementação real para moeda incompatível sem FX, referência válida inexistente, campo de fornecedor restrito e lista vazia de SkillLoadReceipt. As identidades/autoridades/receipts dessas fixtures são sintéticos e não qualificam uma Session nativa.

O probe de scanner consulta o detector e a porta de escrita reais. O harness Playwright prepara SQLite real, usa enrollment/CLI existentes e preserva a falha de bootstrap. O typecheck próprio inclui spec e helper pelo script oficial e valida a lista real de arquivos do compilador.

## Estado das tasks e dos 85 critérios

O [mapa completo](../../../product-campaign/wp00/criterion-map.json) preserva todos os 85 textos canônicos e associa implementação, consumidores, prova/run, estado, limite e próxima ação. Fontes e runs têm catálogos únicos. PASS vale para o texto específico do critério; não promove a task inteira quando há critérios abertos.

| Escopo | PASS | PARTIAL | BLOCKED | NOT_PROVEN | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| WP00 | 8 | 9 | 3 | 0 | 20 |
| WP00.T01 | 7 | 0 | 0 | 0 | 7 |
| WP00.T02 | 8 | 7 | 8 | 0 | 23 |
| WP00.T03 | 5 | 4 | 0 | 0 | 9 |
| WP00.T04 | 4 | 13 | 8 | 1 | 26 |
| **Total** | **32** | **33** | **19** | **1** | **85** |

- **T01:** inventário, decisões e destinos implementados com as sete verificações próprias satisfeitas.
- **T02:** definição/congelamento comprovados; confirmação de consumidores bloqueada.
- **T03:** corpus e oráculos numéricos comprovados; medições, comparação temporal e jornadas completas continuam abertas.
- **T04:** inventário, CI e observação de ausência do scanner entregues; cadeia nativa exigida não qualificada.

O critério T04.SUC.10, relativo ao checkpoint histórico até T20, permanece NOT_PROVEN: ele não pode ser certificado retroativamente. Os quatro PASS de T04 são INV.01, INV.10, CHK.01 e CHK.03; nenhum é execução GNATIVE.

## CI cirúrgico observado

| Gate | Produto W | Snapshot S | Run | Resultado |
| --- | --- | --- | --- | --- |
| Contratos/corpus/ownership/negativos/scanner | [`fe30d34f`](https://github.com/gustavomhss/Orchestra-SF/commit/fe30d34f509bd1d7ab12d30566200f1059eb5456) | [`d3ce1eab`](https://github.com/gustavomhss/Orchestra-SF/commit/d3ce1eab9779b12a283f7ddefb812901a94144b2) | [43522589708](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522589708) | 40 PASS / 0 FAIL; 9 arquivos; 1.683 asserções |
| Consumidores | [`72342f0e`](https://github.com/gustavomhss/Orchestra-SF/commit/72342f0efbbe099231aa2e30a964769b14e4fbb2) | [`d44a0097`](https://github.com/gustavomhss/Orchestra-SF/commit/d44a0097b540cd0074ff033f0317c82f4dc85bc0) | [43514166596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43514166596) | 9 PASS / 8 FAIL; 4 arquivos; 125 asserções |
| Typecheck e guards | [`70476b99`](https://github.com/gustavomhss/Orchestra-SF/commit/70476b99e0a34c4432d48f5d2f3710c26562aa1b) | [`8a521449`](https://github.com/gustavomhss/Orchestra-SF/commit/8a52144930724b61de2a8d2b8fe91adbce9b5f27) | [43522928224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224) | Sucafina FAIL:144; harness UI PASS; guards PASS:0 gate/11 warn/0 errors |
| Instalação real e recibo UI | [`70476b99`](https://github.com/gustavomhss/Orchestra-SF/commit/70476b99e0a34c4432d48f5d2f3710c26562aa1b) | [`2160a52e`](https://github.com/gustavomhss/Orchestra-SF/commit/2160a52ea84ab1315ec2ae8fd1c5c5f82b2ce6b9) | [43522985791](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791) | 1 FAIL; 0 retries; C15 antes de autenticação; 0 medições |

O [recibo de CI](ci-execution-evidence.json) preserva as 12 execuções, seleções normalizadas, SHAs completos, jobs, etapas, artefatos, digests e comparações W→S. Em cada snapshot, a única diferença de árvore para seu produto é o envelope `.ci-run.json` ou `.astra-wp00-check.json`.

Os consumidores executados em W2 mantêm os mesmos contratos/runtime/config/testes selecionados em W5. O run verde de 40 testes pertence a W4; o delta W4→W5 só altera workflow e dois arquivos do harness UI. Todos os blobs de Sucafina, fixtures e nove testes Bun são idênticos. As comparações remotas estão no recibo, sem atribuir um SHA de produto diferente ao run.

O controle Omni Bun dos runs focados devolveu `not applicable`, validado pelo parser canônico e nonce do job: não houve spawn/delegação declarados. Isso não prova Omni ou execução nativa. O runner Playwright não invoca o gate Bun; as assertions de contadores posteriores ao bootstrap não foram alcançadas por causa da falha C15.

O [review independente de typecheck](typecheck-review.md) conserva os 144 IDs herdados: zero novos/removidos e nenhum em `test/product/wp00`. Há um erro herdado dentro de contratos, `host-context.ts(14,45) TS2307`, pelo produtor `../routines/factory.ts` ausente. Portanto não se afirma ausência de erros em toda a pasta de contratos. Os 11 warnings dos guards não foram suprimidos.

### Correções próprias durante a execução

A comparação financeira estrita de ponto flutuante foi substituída por tolerância inferior a um centavo, sem alterar cálculo financeiro. O matcher tipado WP00 foi corrigido. O recibo UI agora marca falha também se screenshot/anexo falhar e não declara autenticação/cache antes de observá-los. O workflow passou a interpretar a saída real flat do `tsgo --showConfig`, verificar `--listFilesOnly` e desabilitar a emissão de declarações herdada no tsconfig `noEmit`. Essas correções não relaxam os gates de produto.

### Artefatos atuais

- [astra-wp00-check-1 — 14084311276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224/artifacts/14084311276): `sha256:24383cd1a0a26e180d9ef1737da30047e52cd12b1a965543edc20e1a4dfb8b3d`; 15493 bytes; expiração informada pelo GitHub `2026-11-27T22:54:38Z`. Bytes baixados e digest verificado.
- [playwright-ubuntu-24.04-1 — 14083059625](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791/artifacts/14083059625): `sha256:70e23230cf58b2cfa7364b4d70b781020812f51e80d5094c5acceed6e11f5752`; 692045 bytes; expiração informada pelo GitHub `2026-11-20T22:56:34Z`. Bytes baixados e digest verificado.

As observações relevantes permanecem também nos JSONs versionados deste diretório. O artefato UI contém seleção/runtime JSON, recibo bruto, log do servidor, trace e screenshot/vídeo de falha; sua existência não prova conteúdo UI utilizável.

## Bloqueios e ações dos owners

| ID | Evidência observada | Próxima ação |
| --- | --- | --- |
| C07 / WP09–WP10 | Export de `product/routines/capabilities.ts` ausente; host fornece portas de rotinas indisponíveis. | S0/WP09 reconciliam o produtor publicado e suas dependências com admissão real; WP10 compõe a ligação. |
| C08 / WP10 | Namespace BI/migração, CAS de `checkNamespaces`, read authority e fence de campo divergem do contrato. | Reconciliar `state-provider.ts` do produtor com C08 e repetir o gate positivo. |
| C15 / WP12 | Bundle rejeita `sf_portfolio`; a mesma rejeição encerra o CLI real antes da autenticação. | Integrar perfil, skill e manifesto como conjunto, preservando `AlternativeDraft`, e repetir o bootstrap. |
| Typecheck / owners e S0 | 144 diagnósticos em 50 arquivos herdados. | Corrigir nos owners; manter o erro do contrato que importa o produtor ausente explícito. |
| Scanner / WP10.T07–S0 | Detector real não encontrou scanner; clean/canary recusados, zero eventos. | Instalar/pinar a dependência pelos mecanismos autorizados e provar path/version/digest, clean/canary e transação durável. |
| GNATIVE / WP10–qualifier–S0 | Não há Session/provider/caso real/SkillLoadReceipt/MCP/consumer-chain observados nesta superfície. | Executar a cadeia exigida no host existente autorizado, sem nova identidade ou provider simulado. |
| UI30 / WP00 após integração | Corpus SQLite preparado; CLI falha antes da autenticação; `observations: []`. | Após C15, executar os fluxos/30 repetições, baseline histórico, atores restritos, viewports e zoom real exigidos. |

As oito falhas do gate de consumidores permanecem expectativas positivas: produtor de rotinas ausente; bundle C15 incompatível; namespace ausente; migração aditiva ausente; leitura obsoleta ignorada; autorização de leitura não consultada; escrita indevida após leitura negada; e escrita aditiva em `claimBindings` aceita. O último teste parou na primeira iteração: não se atribui execução individual aos seis campos. No teste de leitura negada, as assertions posteriores ao status falho não foram alcançadas.

O [delta para os consumidores](../../../product-campaign/wp00/consumer-deltas.md) e seu patch continuam sem aplicação sobre arquivos dos outros owners. Os heads `sf2-host-ready@dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`, `sf2-ai-ready@574841e2409a9523000c4c1976c81804c9a86fde` e `sf2-relay-ready@b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8` foram reconferidos e permanecem os pins documentados. Presença de fonte não constitui CI nem aceite desses produtores.

O [scanner observado](scanner-host-observation.json) qualifica apenas ausência e recusa segura no runner. C17 permanece HOLD. O [recibo de UI](ui-bootstrap-observations.json) registra o corpus real 1000/200/100, digest `7b37f785864261ec218f53368b42c2f5a3a181ae3bb95197676e96b00ca7ccea`, Bun 1.3.14 e Chromium 147.0.7727.15; não há mediana, p95, comparação de performance nem UI aprovada.

O teste de relatórios comprova 20 identidades em DOCX/PPTX; não encerra a jornada J05 de 25 registros. As fixtures de identidade/recibo não provam revogação empresarial, inferência ou qualificação nativa. AM01–AM06/C/D e as seleções finais do bundle não foram executados nesta entrega.

## Inventário de critérios

O detalhe de implementação/consumidor/prova de cada linha está no mapa JSON. Todos os critérios diferentes de PASS abaixo permanecem explicitamente abertos.

| Critério | Estado | Próximos owners |
| --- | --- | --- |
| WP00.DOD.01 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.DOD.02 | PASS | — |
| WP00.DOD.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.DOD.40 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.INV.01 | PASS | — |
| WP00.INV.02 | PARTIAL | S0 |
| WP00.INV.10 | PASS | — |
| WP00.INV.40 | PASS | — |
| WP00.QLT.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.QLT.02 | PASS | — |
| WP00.QLT.10 | PASS | — |
| WP00.QLT.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.CMP.01 | PASS | — |
| WP00.CMP.02 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.CMP.10 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.CMP.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.SUC.01 | PARTIAL | S0 |
| WP00.SUC.02 | PASS | — |
| WP00.SUC.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.SUC.40 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T01.DOD.01 | PASS | — |
| WP00.T01.INV.01 | PASS | — |
| WP00.T01.QLT.01 | PASS | — |
| WP00.T01.CMP.01 | PASS | — |
| WP00.T01.SUC.01 | PASS | — |
| WP00.T01.CHK.01 | PASS | — |
| WP00.T01.CHK.02 | PASS | — |
| WP00.T02.DOD.01 | PASS | — |
| WP00.T02.DOD.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.DOD.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.INV.01 | PASS | — |
| WP00.T02.INV.10 | PASS | — |
| WP00.T02.INV.60 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.QLT.01 | PASS | — |
| WP00.T02.QLT.10 | PASS | — |
| WP00.T02.QLT.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.01 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.02 | PASS | — |
| WP00.T02.CMP.10 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.60 | PARTIAL | WP00 qualifier independente, WP10, WP09, WP06 |
| WP00.T02.SUC.01 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.SUC.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.SUC.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CHK.01 | BLOCKED | S0, WP09, owners dos diagnósticos de typecheck |
| WP00.T02.CHK.02 | PASS | — |
| WP00.T02.CHK.03 | PARTIAL | WP10, WP00 |
| WP00.T02.CHK.10 | PASS | — |
| WP00.T02.CHK.11 | BLOCKED | WP12, WP10 |
| WP00.T02.CHK.12 | PARTIAL | WP10, WP14 |
| WP00.T02.CHK.60 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T03.DOD.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.T03.INV.01 | PASS | — |
| WP00.T03.QLT.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.T03.QLT.02 | PASS | — |
| WP00.T03.CMP.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.T03.SUC.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.T03.CHK.01 | PASS | — |
| WP00.T03.CHK.02 | PASS | — |
| WP00.T03.CHK.03 | PASS | — |
| WP00.T04.DOD.01 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.DOD.02 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.DOD.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.DOD.40 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.INV.01 | PASS | — |
| WP00.T04.INV.10 | PASS | — |
| WP00.T04.INV.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.10 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.10 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.10 | NOT_PROVEN | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.01 | PASS | — |
| WP00.T04.CHK.02 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.03 | PASS | — |
| WP00.T04.CHK.04 | BLOCKED | WP10, WP00 |
| WP00.T04.CHK.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.11 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.12 | PARTIAL | WP00, WP10.T07 |
| WP00.T04.CHK.40 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.41 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.42 | BLOCKED | WP10.T07, WP00 qualifier independente |

## Escopo de escrita e encerramento

Os 33 paths da implementação comparados ao seed constam em `implementation_paths_vs_seed` do recibo CI. A consolidação final só modifica guias, mapa de critérios e recibos nos prefixos próprios, além do README do harness. A única exceção de workflow é `.github/workflows/astra-wp00-check.yml`, autorizada pelo handoff e presente no produto revisável.

Nenhum teste de produto ou typecheck foi executado localmente. As operações remotas de publicação/CI foram feitas pelo GitHub MCP. Não houve merge, deploy, label epic, nova credencial, mudança de política financeira, substituição de engine ou escrita em runtime de outro WP. S0 mantém a integração da PR e a revisão dos bloqueios. Esta entrega encerra a publicação da evidência disponível; os 53 critérios não-PASS continuam abertos nos estados registrados.
