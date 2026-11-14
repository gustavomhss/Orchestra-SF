# Memory integrity — missão 13

**Correção focada comprovada; qualificação do histórico completo BLOCKED.** A captura corrompida é recusada pela fronteira real. Intacto/histórico, metadata-only stale.preserve, identidade/autoridade e os três entrypoints finais têm provas focadas. O histórico original permanece FAIL no deadline225000; suas assertions 580/583–585 não foram alcançadas em MI07.

- Branch: `astra-wp10`; PR29 aberta e draft durante a verificação.
- Candidato de produto W36: `f29f9f7acdc860590581d76e1d276139da7af1e3`.
- Tree de W36: `6f69fc8bfcfcd8ae313ef1a556a35d11ad09e556`.
- Implementação de runtime W35: `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`; W36 acrescenta apenas teste/recibos.
- Histórico preservado: blob `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`, budgets 225000/240000.
- Esta é entrega evidencial do delta Memory. Não constitui D global/G8 ou aceite integral de WP10.

## Execuções, sem conversão de falhas em PASS

| Tentativa | W | S | Run | Resultado | Tempo da seleção |
|---|---|---|---|---|---|
| MI01 | `6cf5d78b` | `453a8abb` | [43632659610](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632659610) | FAIL: 0 PASS / 1 FAIL | 21.34s |
| MI02 | `f511f30b` | `9294efc1` | [43633110221](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633110221) | FAIL: 11 PASS / 1 FAIL | 201.14s |
| MI03 | `a00ba2a5` | `32d40b0e` | [43633722919](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633722919) | PASS: 1 PASS / 0 FAIL | 10.65s |
| MI04 | `a00ba2a5` | `6207445e` | [43633898208](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633898208) | FAIL: 0 PASS / 1 FAIL | 225.56s |
| MI05 | `5d42e44f` | `9b1f70a6` | [43636096246](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43636096246) | FAIL: 12 PASS / 1 FAIL | 234.03s |
| MI06 | `ab511e9a` | `5860244f` | [43637049651](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43637049651) | PASS: 1 PASS / 0 FAIL | 10.72s |
| MI07 | `ab511e9a` | `e6351173` | [43637227753](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43637227753) | FAIL: 0 PASS / 1 FAIL | 225.71s |
| MI08 | `f29f9f7a` | `088c84fe` | [43638160793](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638160793) | PASS: 3 PASS / 0 FAIL | 95.22s |

Identidades completas, requests e hashes estão em RUN-INDEX.json e nos recibos por tentativa. MI01 é uma contraprova funcionalmente FAIL no runtime entregue. MI05 permanece 12/1, e seus 12 PASS são reanexados com o diff causal; MI06 passa somente o caso afetado pelo fence. MI08 é uma execução separada de 3 casos, não a conclusão da sequência histórica.

### Resultado histórico obrigatório

MI07 executou o arquivo original inalterado no W35. O último evento foi `memory.fence-final-request-headers`, elapsed 225014 ms, aborted true. O teste terminou 0 PASS/1 FAIL, 687 assertions, 225.71 s; ainda não havia alcançado o stale preflight alterado, a corrupção na linha580 ou os negativos 583–585. O runtime e o histórico são idênticos em W36. O resultado permanece FAIL reanexado, sem rerun inalterado, ampliação de budgets ou diagnóstico/otimização de X29.

### Três recusas de revogação

MI08 passou 3/0, 51 assertions, 95.22 s. `producer.prepare`, `verifier.verify` e o mesmo `proof.acceptsOutput` retornaram primeiro `ok` sob captura histórica íntegra, depois `unavailable` após revogar somente a autoridade do principal. Os positivos completaram respectivamente 2/2/4 recalls canônicos. Request/call, headers, inputs, captura e output permaneceram iguais; Request não abortado. Isso demonstra as três fronteiras no cenário focado e mantém MI07 separado.

### Check normal do candidato final

[CHECK36 — run 43638533816](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638533816), S `42bb400783f50b06c5925a1411c94a33734bc95c`, request SHA256 `1925b62e904109f2044382644dda7e45ac78a28f07587e9bb108137cd9638dd7`.

O resultado global é **FAIL exclusivamente pelos 13 erros externos de Sucafina**, cujas linhas são idênticas aos CHECK30/CHECK34. Não há diagnóstico novo Memory. CLI, consumidores WP10, Atlas geração/check:generated/diff/typecheck, spawn e guards passaram. Guards: 78 regras, 2217 paths acumulados contra dev, 0 gates, 53 warnings, 0 erros; spawn: 4702 arquivos/66 sites. Artefato 14131287684, 4364 bytes, SHA256 `4ede1b651434996a232f3e402c825027f3669b3d8286aae1c0726218c5c5d058`. O download foi obtido pelo GitHub MCP; não se afirma inspeção manual do ZIP.

## Causa e comportamento entregue

A27 comprovou que a projeção persistida podia ser corrompida sem recomputar o digest: Atlas negava o recall, mas o wrapper aceitava o preflight porque consultava apenas o contexto de fontes. A continuidade histórica C12 e o acesso atual à fonte não validavam os bytes da captura Atlas.

O wrapper agora retém o Request original, fixa a identidade do input e exige a validação canônica da captura Memory. A composição Atlas real registra uma rota privada vinculada ao array exato de resoluções e à call atual. Essa rota é consumida uma vez e não armazena grant ou resultado. No caminho de um evento/envelope, usa fold e readOriginalCapture reais, valida referências/owner/caso/incarnação/source maps, projeção histórica e continuidade. A topologia complexa continua pelo recall completo real.

A autorização integral do case é lida antes e depois das capturas; as referências fora do envelope também continuam sujeitas à autorização atual. Request, headers, binding, seleção, resoluções, capturas devolvidas e snapshots são comparados até a revalidação final. O fence W35 recusa a alteração imediatamente após pin da captura, antes de uma continuidade que poderia tentar refresh aninhado. O wrapper conserva sua autorização final. O fingerprint antigo não é grant.

## Escopo e autoridade

A missão foi iniciada depois de ler o HANDOFF terminal em `2026-11-14-continuation-c09/HANDOFF.md`, conferir o head entregue `54317229d7f8fcb7e92921c2f4a8dc6f9310270b` e reconciliar a passagem explícita de autoridade. Foram lidos o JSON da missão em `3e3c329e9f4ab94d70c02d2cf69b030a9726769a`, COMMON em `c708ec0609dbfc95b259707d8c38481617f74f11`, AGENTS e o pack S0-B completo. A autorização efetiva é a estreita da missão 13, não o ownership histórico mais amplo do pack.

A branch continua `astra-wp10`, PR29. Escritas remotas ocorreram pelo GitHub MCP com compare-and-swap do head, sem reset, force, merge, nova branch de produto/PR ou reinício de supervisor/Goal. As refs temporárias `ci-run-linux-*` foram apenas envelopes do protocolo existente, com cleanup registrado.

O runtime mudou somente em `apps/cli/src/sucafina-product/analysis-stale-commit.ts` e no reader necessário de `product/host-binding/business-context.ts`. O contrato público BCS, host-context, engines, workflows, guards e os arquivos das demais sessões permaneceram intactos. Testes e recibos próprios estão nos namespaces memory-integrity. O diff e os blobs constam em WRITE-SCOPE.json.

## Provas e limites

As fixtures exercitam SQLite/C08, source issuance, Procurement/C12, BCS, roteamento/continuidade, Atlas canônico, Gitleaks8.30.1 por Omni, autoridade de produto e wrapper reais. Os dados PR-1, principal/grants/autenticador local, caso/choice/ledger e metadados de run/modelo/output são sintéticos declarados. Os hooks encaminham os readers instalados e injetam faults depois de seu retorno; não substituem o reader por um callback permissivo.

Não houve testes nem typechecks locais. Todos os testes foram seleções cirúrgicas e deduplicadas em Actions; A27 completo não foi repetido. Nenhuma assertion ou budget histórico foi modificado. Os logs, requests exatos, hashes, W/S, jobs e resultados ficam no índice e nos recibos por tentativa.

A reanexação conserva a proveniência de cada PASS. MI05 permanece FAIL12/1 no W34; seus 12 PASS são observações reanexadas ao delta de uma linha, após revisão de sequência/contagens. MI06 executa o único caso afetado no W35. MI08 acrescenta 3 PASS com positivos reais antes da revogação no W36. Não se declara uma execução única de todos esses casos no W35/W36.

MI01 permanece FAIL como contraprova; MI02 permanece FAIL pela injeção aninhada do teste, corrigida somente em W33; MI03 registra o recheck dessa injeção. MI04 permanece FAIL no deadline225000 após o full recall introduzido por W32. MI05 preserva sua falha de ordenação do fence, corrigida por W35. Nenhuma dessas falhas foi apagada ou convertida em PASS.

## Pendências preservadas e próximo consumidor

Esta entrega não encerra C17 `R1-W23-C17-BETWEEN-OBSERVATIONS`, desempenho X29, restart→recall→UI, AM/GNATIVE, Session/modelo nativos, UI da sessão12, ACK da10, exports da11, os 13 erros externos de tipo ou as demais limitações do HANDOFF anterior. Não constitui qualificação integrada no mesmo candidato nem aceite global G8.

Os pareceres auxiliares desta sessão são estáticos e participaram do desenho/protocolo/testes. Não contam como as três revisões FINAL independentes da campanha. CRITERIA.json registra a contribuição parcial e mantém os critérios canônicos amplos sem aceite.

O consumidor seguinte é S0 integração/revisores/candidato final posterior. Deve partir do head terminal indicado na seção Memory da PR29, conferir este HANDOFF e a passagem de autoridade e preservar as pendências. Não assumir transferência por silêncio.

## Entrega documental

O commit que contém este HANDOFF é D, com somente novos recibos sobre o candidato final; sua implementação de runtime permanece a do W35. DELIVERY.json indexa paths e hashes sem autorreferência. O SHA exato D, snapshot do guard documental e resultado terminal são registrados na descrição da PR29 depois da execução; o próprio D não prevê o resultado de um check futuro. Não há D+1 apenas para registrar esse resultado.
