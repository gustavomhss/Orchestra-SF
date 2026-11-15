# Missão86 — export-byte egress + privacidade73

## Resultado delimitado

**Fonte W e890d8cd79138dcb036a980c877319708dd220ac / tree 0dbb975c39c771caa0f7126566c6b79fcb417148** na branch `procurement-privacy-fix`, PR86 draft. ACK86 8982a35a7a86bf04beb0850c24b74b1486c66932, após término de E73 4a93f6aa8b8af138774fd1e25a7183e7a84706ba. A PR existente é mantida; nenhum arquivo alheio, stack, deploy ou merge foi alterado.

Corrigida a entrega dos bytes no `runtime/application.ts` após a execução do produtor legado: segunda transação SQLite **somente leitura** revalida o principal efetivo e papéis de C08, verifica a identidade/capacidade do ator, e compara SHA-256 dos dados públicos/versões com a captura original. Revogação ou perda de grant -> **403 sem bytes**; mudança de fonte pública -> **409 sem bytes**. Nenhum rebuild automático da versão corrente nem replay de comando. Drift apenas privado `__sfProductV1` não invalida exportação capturada. Não houve mudança em política de compras, auth85, HTTP74 ou scanners.

## Regressão inalterada

Repro66 `legacy-egress.test.ts` copiado byte-a-byte (mesmo Git blob SHA1 `4b350694202e438c04aa72b7b52a62411178fb1c`), junto de seu helper `evidence.ts` (blob `f4cedb5da62893dad1b6f8e498d9a1b6be9545f3`). A expectativa **403** foi preservada. O teste original registra os bytes positivos e a recusa após revogação, usando produtor DOCX, autenticação C08 e SQLite reais com principal sintético explicitado.

Uma única expectativa em `test/procurement-runtime.test.ts`, no caso requester não visível `Attack`, mudou **403→404**, exatamente como a73 preparou; o blob final coincide com o target 71 observado (`5c25f109c4df835761e8aba8351686174ac6d7aa`). O **403 da PR visível dual-role** permanece. Não houve skip, retirada de testes, alteração de assertions restantes ou aumento de timeout original.

## Prova GitHub Actions R1

- **W** `e890d8cd79138dcb036a980c877319708dd220ac`, tree `0dbb975c39c771caa0f7126566c6b79fcb417148`.
- **S** `a99e224afdd5f830268a81d1087b6a1f43e83bec`, tree `2a19ba72e7dc786654c8c37819f9b2449cf9704c`, parent exato W. Delta W→S: somente `.ci-run.json`.
- [Run43675046935](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675046935), [job132693228267](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675046935/job/132693228267), attempt1, Ubuntu24.04: **success, 50 PASS, 0 FAIL, 1.077 assertions, seis arquivos, 0 filtered**.
- Full `test/procurement-runtime.test.ts`: 17 PASS, sem `-t`; repro66: 1 PASS; cinco cenários86: 5 PASS; 27 regressões73: PASS.
- Cleanup job132693604323: **success**. Omni: *not applicable*, sem spawn e sem crédito Omni. Nenhum teste de produto executado localmente.
- Casos adversos incluem revogação de grant SQLite, sessão, fonte alterada, drift privado preservado, HEAD, conteúdo ZIP real, fresh download após409 e não-entrega dos bytes privados.

[Seleção exata](checks/R1.request.json), [resultado](checks/R1.json), [linhas reais do log](checks/R1-pass-lines.txt), [pre/post e hashes](SOURCE-MANIFEST.json), [patch completo](source-and-tests.patch), [dependências](DEPENDENCIES.json) e [matriz de critérios](CRITERIA.json).

## Handoff obrigatório

**71**: solicito ACK de W/árvore/patch e composição CAS no target fixo, sem substituir auth85/HTTP74/Reports48. No target observado `bc5eb1e0cead17254a95770e437f6fda826a66fc`, `application.ts` ainda coincide com o preimage86; a expectativa legada404 já coincide com o postimage86. Validar a composição e executar novamente as regressões de candidato, sem promover 50PASS da origem a green integrado.

**84 (recheck independente)**: conferir código real da entrega de bytes, intervalos de revogação, 403/409, exclusão de `__sfProductV1`, preservação de conteúdo capturado, privacidade M70-ISO-01 e regressões da73 no SHA composto. Não aprovar com base apenas nesta narrativa. Recheck **REQUESTED_NOT_PERFORMED**.

**45**: compile/typecheck e guard `bun run check:guards --base origin/dev` sobre W e depois candidato final via lane própria. Não executados nesta missão e sem waiver.

**75**: prova ClamD real e cinco nominais da instalação continuam exclusivas. O scanner do teste73 é tripwire negativo, não demonstra scanner real. Egress legado DOCX não depende de scanner.

**S0**: aceitação final (oito seleções, AM01–AM06, três revisões FINAL, C/G7/D/G8) continua **NOT_DONE**. Não há prova de ambiente corporativo ou UI nativa instalada. **GLOBAL_RELEASE=false**.

## Autoridade terminal

A lease `egress-privacy-browser86` termina com este handoff documental. Os materiais W não são modificados após R1. O commit terminal de recibos será identificado pela leitura GitHub/CAS e registrado na PR; não há autorização para writes posteriores sem nova lease.
