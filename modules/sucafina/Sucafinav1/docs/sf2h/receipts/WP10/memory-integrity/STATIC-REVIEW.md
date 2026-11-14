# Revisão delimitada MemoryA27

Revisor: subagente `memory_boundary_review`, leitura sem commits, dispatch ou testes. Candidato W32 `f511f30b73289c2f21c843254569d31c02eb9608`; runtime blob `f3e7c88000f47018a6b3bb0f6e65ddac1a948e45`, confirmado por GitHub MCP e hash local de leitura.

O revisor participou da análise causal e sugeriu a ligação dos refs aos envelopes. Este parecer **não é uma das três revisões FINAL independentes da campanha**.

## Resultado estático

Nenhum bloqueio adicional identificado no corte MemoryA27. O wrapper mantém C12 para acesso à fonte e acrescenta o recall canônico Atlas sob C08 para a captura. Exige membership exato dos refs de proof/output; um recall vazio não autoriza captura exigida. Fingerprint antigo participa apenas da identidade, sem substituir autorização atual, Request, headers, owner ou fonte.

Request original, start e proof são retidos. Record/output/binding/headers são comparados antes e depois de awaits. Digest do snapshot é capturado antes dos awaits para não comparar duas referências ao mesmo objeto mutado; resolução recebida também é fixada por digest. Autorização humana e revalidação real ocorrem depois do recall, seguidas de verificações síncronas. Nenhum parser paralelo de atlas.originals ou reparo/digest rewrite foi adicionado.

Recall adicional é restrito à skill Memory; a propriedade opcional preserva callers não Memory, enquanto Memory sem reader falha fechada. Os testes contêm controles positivos íntegros/históricos e metadata-only stale.preserve, além de 10 cenários de identidade/autoridade. Fault hooks encaminham ao reader/autoridade reais antes da alteração, sem callback permissivo.

## Cobertura e limites

12 casos: preflight/preservação (2), identidade (5), autoridade (5). A fixture usa caso/choice/lifecycle sintéticos declarados, com source issuance, C12, SQLite/C08, BCS, Atlas, scanner e wrapper reais. Nenhuma Session/modelo nativo executado.

Contribuição parcial para WP10.T06.INV.01/CHK.04 e WP10.T07.DOD.01/INV.01/CHK.03/CHK.07/QLT.40/CMP.01/SUC.01. Nenhum critério amplo fechado por este parecer.

À emissão do parecer, os testes Actions e o recheck histórico ainda estavam pendentes. O custo adicional do recall sob C08 era o risco concreto a verificar, com budgets históricos 225000/240000 intactos. Os resultados posteriores constam nos recibos de execução separados.

Continuam fora do parecer: C17 entre observações, X29, restart→recall→UI, provas AM/nativas, aceitação global e três pareceres FINAL.

## Seguimento após MI02

MI02 terminou FAIL (11 PASS / 1 FAIL). O único caso falho tentou uma escrita aninhada e o C08 abortou com `Nested local write attempted` antes da assertion de recusa. O revisor dos testes confirmou que `currentSnapshots` no LocalStore devolve clones; não há prova de bug de alias nesse driver. W33 corrige apenas a injeção do teste para alterar o argumento real do callback externo de `transactionAll`, após o reader real, usando `commit:false`. As assertions e budgets permanecem. Recheck cirúrgico e reanexação dos 11 PASS com atribuição ao W32 são permitidos pelo protocolo; isso não constitui qualificação global no mesmo C.

## Revisão do refinamento W34

Candidato `5d42e44fb623db78a3a6ef025d2317a3fb653432`. Runtime wrapper SHA256 `3d1b2e6ed237e1321fe6052277f94e6edc83a66b0b03a1e977b9757641bf8ca0`; BCS SHA256 `51ae8d2f38afd88cd86a8eca8c44f5e6d23201924137c8790044125e693926de`.

O full recall introduzido por W32 tornou stale.preserve 23334ms em MI04 e o histórico terminou no deadline225000, sem alcançar a cauda. O refinamento associa, somente na composição Atlas real, uma rota privada single-use à identidade do array retornado por context. A rota relê as capturas canônicas a cada consumo, sem reter grant/resultado.

A revisão rejeitou duas versões preliminares: metadata de case não substitui cases.read; uma única cases.read inicial não cobre revogação externa tardia de referências fora do envelope. A implementação final conserva **duas cases.read reais**, sendo a segunda após todas as capturas/continuidades dos casos da rota curta. A forma genérica assembleSfBusinessContext e os demais readers continuam idênticos ao baseline.

A rota curta exige um evento e um envelope, usa o fold e readOriginalCapture canônicos e valida todas as referências/dependências/continuidade atuais. Topologia complexa segue o recall canônico. Request/headers/binding, seleção e sua cópia, fontes, capturas retornadas e snapshot permanecem fixados até a revalidação final. Os hooks próprios encaminham ao reader instalado; há teste adicional de duas entradas reais com corrupção de uma captura secundária.

A conferência estática final de memory_boundary_review não identificou novo blocker nem erro de tipos óbvio. memory_ci_protocol confirmou a necessidade da segunda leitura. Nenhum desses pareceres equivale a teste/typecheck ou FINAL independente da campanha. Os resultados Actions estão separados.

## Revisão do fence antecipado W35

Candidato `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`; BCS SHA256 `d6df55fbe2ebf1868c3279eb2196108228a1dcd695f8af36fe65429419c7ec65`. O delta de runtime é uma linha: `if (!stable()) return false`, após fixar a captura devolvida e antes de consultar continuidade. memory_boundary_review confirmou a ordem pin → fence → próximo await. A verificação impede que uma fonte alterada durante a leitura provoque refresh aninhado antes da recusa. Não dispensa reader, continuidade, segunda cases.read ou autoridade final. Nenhum teste/assertion mudou.

O protocolo permite reanexar os 12 PASS MI05 com proveniência W34 e diff exato, sem declarar 13 testes executados no W35. A mudança não altera contagens de leituras no caminho estável. O caso afetado é reexecutado isoladamente, seguido do histórico obrigatório; o typecheck/guard do W35 continua necessário e não pode ser substituído pelo modo de entrega documental.

### Escopo final conferido

GitHub MCP compare `54317229...ab511e9a`: 5 commits à frente, 0 atrás, merge-base no head entregue. Foram observados 16 arquivos (2 runtime autorizados, 5 testes próprios e 9 recibos próprios) e zero fora dos write_paths. O blob histórico continua `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`, incluindo as assertions 580/583–585 e budgets225000/240000. A entrega documental posterior só pode acrescentar recibos próprios. Nenhum acesso/grant regressivo óbvio foi identificado na inspeção estática; isso não equivale a execução.

## Teste focal de revogação W36

W36 `f29f9f7acdc860590581d76e1d276139da7af1e3` acrescenta somente `revocation-tail.test.ts` e dois recibos; runtime e testes anteriores permanecem iguais a W35. Proposta SHA256 `b6e0f89ac1255f3edd90b587af08bbe9721ea9792cf9050d96dcd68b472beda4`, blob publicado `b737b7f797b880c3e2664f65747ef2bc2c18156f`.

memory_boundary_review e root conferiram as mesmas factories e as três fronteiras do histórico. Cada caso estabelece um positivo real antes de revogar; o hook encaminha o recall canônico, exige leitura concluída e restaura em finally. Capturas/Request/headers/inputs/output permanecem íntegros e o Request não está abortado. Os testes preservam105000/120000 da fixture; o histórico conserva225000/240000. Não há callback permissivo, execução nativa ou alteração de produto. Esta prova separada não substitui MI07, que falhou antes do caminho stale. Os resultados Actions continuam em recibos próprios.

A revisão final do teste de tail confirmou ausência de novo blocker. Os três casos verificam a associação Request/call antes de revogar e conservam os mesmos objetos e bytes depois. A coleta observa apenas completed canonical recalls; não substitui sua decisão. Nenhum resultado de teste foi antecipado por esse parecer.
