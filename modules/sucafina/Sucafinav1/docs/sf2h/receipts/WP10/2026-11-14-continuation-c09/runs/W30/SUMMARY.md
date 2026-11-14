# W30 — U30 e CHECK30

## Resultado

W30 `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7`, tree `8f2cd84288df2a9d70402219df871765fe1890ca`.

| Run | Resultado integral | Evidência útil |
|---|---|---|
| [U30 43629303473](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629303473) | FAIL: 3 pass, 1 fail, 35 expects, 4 testes, 3 arquivos, 13.66s | Fluxo ready chegou ao output; falha localizada em visibilidade de cancelar. Rejeição por teclado, startup e lifecycle PASS. |
| [CHECK30 43629131094](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629131094) | FAIL: mesmos 13 diagnósticos externos do CHECK29 | Zero diagnósticos próprios; WP10 test typecheck, CLI, Atlas generation/check/diff, Atlas typecheck e guards PASS. |

## U30: request, jobs e limite exato

S `84432d8ab3a5f1619eb2e96652290434d2bb0a2e`, tree `938cdbc8a43094b52c101d61d60ee2564dc879d1`, filho único de W30. Compare MCP contém apenas `.ci-run.json`. Request de 397 bytes: blob `789d044c489eae96aef1877d98a249ba86d854ed`, SHA256 `f4259ab02921f2fc9f7b5ba18f79df529035dd48f5200e87d1fa7111f89bbf9a`.

Ordem literal e observada dos arquivos completos:

1. `./Sucafinav1/test/product/wp01/browser-startup.test.ts`
2. `./Sucafinav1/test/product/wp10/integration/forecast-submit.test.ts`
3. `./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts`

Bun 1.3.14. Timeout externo do teste UI preservado em 30000ms; ações/navegação têm timeout nativo de até 5000ms limitado pelo tempo restante. Teste forecast W30: blob `b312f2dda7029b79c7420af91d52ca6fec1b098d`.

- Job `132552127580`: failure, 18:55:55–18:58:00Z.
- Cleanup `132552703448`: success, 18:58:02–18:58:05Z; run concluído às 18:58:06Z.
- Artefatos: nenhum.
- Omni nonce `bceba14f449cce8e07472045234fb8ed`: PASS, 1 declaração no startup, 1 spawn, 0 delegações.

### Ready: FAIL localizado

O teste de clique positivo levou 2108.93ms. A seleção de comparação, datas e moeda concluiu, o clique gerou prepare HTTP200, e start/read/output também retornaram HTTP200. O estado ready e o corpo da fixture explícita apareceram na página. As asserções de ordem `prepare → start → read → output` e dos payloads start/read/output passaram.

A falha ocorre em `forecast-submit.test.ts:164:113`, etapa `analysis.cancel-hidden`, aos 2070ms: `isVisible()` devolveu true, esperado false. A operação terminou sem timeout nem pageError observado.

As asserções comuns após essa linha **não foram alcançadas no cenário ready**: igualdade do payload prepare com seleção atual; `every(key)`; submit/currency reabilitados; moeda EUR preservada; `expect(pageErrors).toEqual([])`. O trace registra headers presentes e pageErrors=[], mas observação não substitui as asserções interrompidas. O teste positivo completo permanece FAIL.

### Rejected, startup e lifecycle: PASS

O submit por Enter recebeu 409, exibiu a rejeição, não fez start/read/output, não exibiu corpo e passou todas as asserções comuns de payload, chave, reabilitação e moeda. Duração 389.44ms.

Startup passou em 10682.24ms. Lifecycle passou em 63.38ms: 1 launch, 2 aquisições/2 liberações, 0 contextos, activeLease=false. Chromium desconectado; driver e processo encerrados; Node exit0 e browser exit0. Bridge, listener, socket e WebSocket fechados, filas zeradas e diretório/socket removidos. Os cleanups de ambos os cenários completaram.

Limitação preservada: o servidor é uma fixture explícita de prepare/análise. O teste exercita o DOM/controller real e seu contrato de requests; não prova execução de agente real.

## CHECK30

S `00d1ba5220121c8490ae28ed0fc839c56b0b7192`, tree `74baf3094086b85bd5c003ff4a2dfa9cb9119f57`. Primeiro pai W30, segundo pai CHECK29 `92319dad2957a023cf1a7c9cfe0e03e77e2242af`; compare com W30 contém somente `.astra-wp10-check.json`.

Envelope: blob `44644019c1aa76864506d1d59d99ae61500a5774`, 119 bytes, SHA256 `72327724e46c908a75da3108e780b46803d97366fdd788f3439b493691542322`. Guard base `a1d37698a7bb097c1578f827eba6a19b9917ef07`.

Job `132551590764`: failure, 18:53:57–18:57:19Z, run concluído às 18:57:20Z. Só Typecheck Sucafina falhou. Os 13 headlines diagnósticos são idênticos aos do CHECK29: WP04=3 (incluindo `product/procurement/sourcing-analysis.ts`), WP06=4, WP08=5, WP09=1; próprios WP10=0. Os outros gates passaram. Guards: 78 regras, 2160 paths, 0 gates, 53 avisos, 0 erros. Os post-checkout cleanups passaram; a branch de checks existente permanece em uso.

Artefato `14126584278`, `astra-wp10-check-1`, 4363 bytes, SHA256 `310967dbfb665fc8e68640d8ddc8386d5e8602fc80a06be16e179267b862eb84`, expira 2026-11-28T18:57:17Z. Download GitHub MCP retornou file_id `file_0000000047c4820e82b738094d3cec12` (`astra-wp10-check30-1.zip`). Não houve materialização por outro cliente de rede nem alegação de leitura do ZIP; o log bruto preserva a saída completa de todos os gates.

## Integridade dos logs

| Arquivo | Bytes | SHA256 |
|---|---:|---|
| U30.log.txt | 100659 | `c462e2e3ffa12a810b5502e8cb57539f7284224d523d7206751b9e2c0837ee28` |
| U30-cleanup.log.txt | 2312 | `037cb69a378247fa43b07347d96852fe0f534cdd4e124f9ce3f27ca6f7038fcf` |
| CHECK30.log.txt | 90866 | `1609ccc17d771fd1f415c2e7911ab0ea200040c8f67d03b8cf988b1162cb9f25` |

Requests, proveniência MCP, jobs, artefatos, receipts e fases completas estão neste diretório. Nenhum run novo, mutação remota ou teste local foi realizado por este agente de coleta.
