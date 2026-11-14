# WP10 W29 — C29 e CHECK29

Produto W: `813806af6c2ce74b2a087139c544e90dd1adcbe4`; tree `06db6b04ee6bdb2af26b71d0b4031d769b76d219`.

## C29 — FAIL, com os dois casos de cálculo aprovados

[Run 43628006308](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628006308), S `d33cc53660250bde7bfb19a26401f4c722fe4875`, tree `822087bcda13bb0db7f2b4df21131b2c503f06c6`. Parent único W29; compare acrescenta somente .ci-run.json.

Job 132548123768: failure. Cleanup 132548953183: success. Artefatos: nenhum.

**3 pass / 3 fail / 36 expects / 6 testes / 4 arquivos / 42,39 s.** A request com caminhos explícitos ./ foi preservada; os cabeçalhos reais confirmam a ordem startup → calculation-source-observation → forecast-submit → lifecycle.

Passaram o startup do browser e os dois casos completos de cálculo. O primeiro caso de cálculo passou em 2.646,52 ms, incluindo a assertion explícita de Request ausente após admissão revogada, zero revalidação na chamada seguinte e a igualdade final do estado durável. O caso de abort passou em 122,13 ms.

Contagens observadas do cálculo:

| Fase | Envelopes de fonte | Authenticate | Revalidate | Estado |
|---|---:|---:|---:|---|
| Fallback | 4 | 6 | 4 | ok |
| Candidato, primeira chamada | 2 | 6 | 4 | ok |
| Candidato, mesma instância/contexto novamente | 2 | 6 | 4 | ok |
| A→B→A | 2 | 6 | 3 | stale |
| Revogação no egresso | 2 | 6 | 4 | stale |
| Chamada seguinte, admissão removida | 0 | 0 | 0 | denied |
| Abort após último authorizer da primeira observação | 1 | 3 | 1 | denied |

Isso fecha o corte estrutural do novo teste no W29. Não demonstra a jornada X integral, ganho temporal em produção ou seus gates posteriores. C09 não foi selecionado neste run: os resultados C28/W28 permanecem identificados separadamente, conforme a reconciliação por blobs feita pelo root.

### Falhas FIN-IND-004 e finalização

O primeiro teste de forecast expirou no timeout próprio de 30.000 ms (30.000,43 ms observado). O log registra a aquisição do lease 1 antes do timeout e não identifica qual await travou. Não há evidência suficiente neste log para localizar a falha no produtor, no transporte ou no setup.

O segundo teste falhou ao tentar adquirir outro lease, em forecast-submit.test.ts:88, com Concurrent WP01 browser leases are not allowed. O lifecycle final encontrou lease ativo, um contexto restante e acquisitions/releases desbalanceados.

A finalização física foi observada: launches 1; acquisitions 1; releases 0; contexts 1; activeLease true; disconnected true; driverClosed true; processExited true; Node driver exitCode 0. A falha de invariantes do pool permanece, embora os processos tenham sido encerrados. O resultado FAIL do conjunto não foi reclassificado.

Omni nonce `8d065236e1d7016a815410d941ea9b3e`: PASS, um teste declarado em browser-startup.test.ts, um spawn e zero delegações. Isso não concede aceite do fluxo de forecast que falhou.

## CHECK29 — FAIL somente pelos 13 diagnósticos externos anteriores

[Run 43628024706](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628024706), S `92319dad2957a023cf1a7c9cfe0e03e77e2242af`, tree `b3e201d8d0b6873a4fd2c5224a19bfcd8e9d7e78`. Parents: W29 e CHECK28 `66d3a7fc3160a54aad1766e096a6b4cb397ab82b`. Compare acrescenta somente .astra-wp10-check.json. Envelope validado. Guard base `a1d37698a7bb097c1578f827eba6a19b9917ef07`.

Job composition 132548181579: failure. Não há job dedicado de exclusão da branch de check; passos finais de limpeza passaram.

| Gate | Resultado |
|---|---|
| Sucafina typecheck | FAIL: 13 diagnósticos externos anteriores; zero próprios WP10 |
| CLI typecheck | PASS |
| WP10 test consumers | PASS |
| Atlas geração/check/diff | PASS |
| Atlas typecheck | PASS |
| Spawn imports | PASS |
| Guards contra origin/dev | PASS |
| Upload de evidência | PASS |

Os três erros próprios do CHECK28 não reaparecem. Permanecem WP04 3, WP06 4, WP08 5 e WP09 1, conforme o log integral. Nenhum sucesso global de typecheck foi atribuído.

## Artefato e preservação

Artifact CHECK29: id 14127078300; nome astra-wp10-check-1; 4.364 bytes; SHA-256 `b660a75b3b9ea3aa76837c47fbe4abbe4a1c6e96ee2106291333cedae29124f5`; expiração 2026-11-28T18:45:30Z. Download GitHub MCP devolveu file_id `file_000000005384820ebd62e710c00bbd81`, nome astra-wp10-check29-1.zip. Metadata e referência foram preservadas; o ZIP não foi materializado por transporte remoto alternativo.

Logs completos, bytes UTF-8 decodificados retornados pelo GitHub MCP:

- C29.log.txt: 89.588 bytes; SHA-256 `341cfc6754860daca68a92334a26e819ea5e56da5a3d96c7fdcbe1db45315d6f`.
- CHECK29.log.txt: 90.495 bytes; SHA-256 `48f26e80c024400f002acb41d8635d57082c745ee6338313499f0bcf4fafc472`.

Os JSON contêm requests/envelopes completos, W/S/trees/parents/compares, jobs, artefatos, Omni, cabeçalhos reais e observações. Nenhum teste local, despacho novo ou mudança de produto foi realizado nesta tarefa de acompanhamento.
