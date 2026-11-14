# W14 — auditoria de preservação

**Resultado metadata: sem bloqueador de preservação.** A revisão está vinculada ao head `edefb5b66706aea866ee45c7e8e76332c27c342a` e tree `294c7bd28795119a014190c34a643fe85616e0ac` da [PR #31](https://github.com/gustavomhss/Orchestra-SF/pull/31), contra `sf2-stack`. Não constitui teste de produto, aceite nativo ou gate global.

## Histórico e fonte fixa

- Os **24 commits recuperados** continuam ancestrais do W14: dez da PR #25 e quatorze da PR #21.
- Os **32 recibos históricos** continuam idênticos em modo/tipo/blob. Foram refeitas **256 comparações** entre os heads originais, recovery, W7, W10, W11, W12, W13 e W14; nenhuma divergência.
- O manifesto recovery mantém blob `c268498408c94b1d201ea5d9bf0009cdbc7f8f80` e SHA256 `d536e5352f546bbc3865593c8c8e40a4f0cea65d7923ca5a70fc2dc4fd7b1cf8`. Os cinco arquivos das auditorias anteriores permanecem byte a byte, inclusive suas cópias publicadas.
- A fonte normativa permanece no pin `dbf9547211d9b0fade619790de7c19c0869b7c7d`. O SHA256 de `campaign.json` foi recalculado como `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Nenhuma edição ou cópia substitutiva do plano entrou nesta branch.

## Reconciliação GitHub MCP

| Referência | Head observado |
|---|---|
| `astra-wp01` | `6f4360bf0bdd444a19a7d4f97e18306ae7618b6f` |
| `astra-wp02` | `6ce14163ec6de963b50ada3d610aa8161176adee` |
| `sf2-stack` | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` |
| `astra-interface` | `edefb5b66706aea866ee45c7e8e76332c27c342a` |

PRs #25 e #21 continuam abertas nos heads originais; PR #31 aponta para W14, com pai W13. A base continua no pin de recovery. A leitura foi somente GET por GitHub MCP, sem endpoint Actions.

## Ownership e deltas

| Intervalo | Paths | Adições | Remoções textuais |
|---|---:|---:|---:|
| W13 | 63 | 7920 | 246 |
| W14 | 35 | 6035 | 30 |
| W12 → W14 | 93 | 13953 | 274 |
| Recovery → W14 | 222 | 51816 | 2520 |

Remoções textuais são linhas substituídas, não exclusão de arquivos. Não há arquivo excluído, path não classificado ou alteração em plano aprovado, engines, Azure/deploy, infraestrutura de identidade, políticas financeiras ou Protocol/Server HttpApi. Não houve merge posterior a recovery nem integração de sf2-control.

| Categoria, recovery → W14 | Paths | Adições | Remoções textuais |
|---|---:|---:|---:|
| `scoped_ci_workflow` | 1 | 45 | 0 |
| `exact_foreign_input` | 59 | 5408 | 2076 |
| `owned_guide` | 1 | 27 | 1 |
| `new_receipt_or_finding` | 110 | 40366 | 0 |
| `recovery_manifest` | 1 | 376 | 0 |
| `owned_interface_or_dashboard` | 16 | 1157 | 272 |
| `owned_test_or_fixture` | 34 | 4437 | 171 |

A cadeia contém 15 commits posteriores a recovery. A relação completa de paths, commits e entradas Git consta no JSON.

## Inputs estrangeiros e fronteira preservada

W13 consumiu **47 arquivos G03 publicados exatamente** e preservou sete dependências já idênticas. W14 consumiu **dois callers publicados exatamente**: `dashboard-services.ts` (`0891d178833165fff098e3c05f3a64c5f5b35043`, Compose ed10) e `documents/capabilities.ts` (`6b655187d4444cff5b8966e868ba163191adfc42`, Operations ba8). As 56 ocorrências de fonte foram reconciliadas por MCP e comparadas ao cache/manifests e ao W14. Os dez inputs anteriores continuam idênticos. Há **65 pins únicos verificados**, dos quais **59** são paths estrangeiros alterados desde recovery.

| Fronteira | Blob preservado |
|---|---|
| `modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts` | `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` |
| `modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts` | `6987eddae37ae2c90fe03b2d8e81ea28e8b5221f` |
| `modules/sucafina/Sucafinav1/product/decisions/apply.ts` | `4bdd12ac162d61465557363953e25dfd99fad5e8` |
| `modules/sucafina/Sucafinav1/product/collaboration/answer-reuse.ts` | `134ce5cd8c4f0779380936de6a439c9ea124d932` |
| `modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts` | `562cdca31a843ad893bc5f31eab039c55e7c9baa` |
| `apps/cli/src/sucafina-product/business-services.ts` | `b289a4a376f937c2cf4b56a00a6c1247152c5798` |

O BCS retido é **b289a4a376f937c2cf4b56a00a6c1247152c5798**. O BCS publicado **4b02413b5a98e750187fa8f5fa54f3cb2415f4e3** continua held; não foi copiado. Host-context, BCS e os paths de import/document HTTP permanecem como em recovery. Patches destinados a owners alheios estão somente em documentação. Nenhum desses fatos prova a composição completa C12 ou a montagem de workSignals/workDestination.

## Testes e assertions preservados

- W13 troca três referências do alias incorreto para a rota canônica no arquivo existente: um branch de transporte e duas expectativas de sequência. A nova contraprova usa HTTP/diretório/logout reais; seus dois failures de setup em W13 permanecem registrados.
- W14 altera um único caso existente de resposta tardia. Após normalizar somente a rota canônica e a variável que guarda a mesma resposta, todas as **205 linhas anteriores de assertions** permanecem; o arquivo passa a **213**, com oito novas observações. O teste continua com 30s e as fases com 5s. `finished() === null`, zero starts e purge de DOM/dados continuam exigidos.
- A fixture substitui a chamada a um membro inexistente do BCS por composição do issuer real sobre a mesma autoridade/persistência. Nenhum consumidor real foi trocado por mock.
- Foram acrescentados dois casos de recipients no W13 e sete casos reais no W14: cinco de seleção e dois de destino. Nenhuma nova marca `skip`, `only` ou `todo` foi adicionada. Os testes anteriores e suas assertions permanecem; não há resultado de execução antecipado nesta auditoria.
- A expectativa antiga de Confirm substituída no W10 e sua contraprova real explícita permanecem inalteradas. Negativos de ciclo503 e destino503 continuam negativos de composição ausente; não contam como navegação, ciclo completo ou seleção global de responsável concluídos.

## Limites e próxima ação

Esta revisão preserva evidências e limites. Não executou produto, typecheck, guards, browser, CI, native ou epic. O CI agent deve vincular os resultados cirúrgicos ao head/snapshot exatos; a integração deve consumir o incremento e resolver os mounts e inputs held. S0 mantém o aceite global e o epic final.
