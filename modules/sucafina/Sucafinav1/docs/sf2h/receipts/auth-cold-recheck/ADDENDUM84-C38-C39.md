# Missão 84 — Adendo por avanço concorrente C37 → C38 → C39

**Este adendo prevalece para o último snapshot observado.** Os quatro arquivos originais de 84 referem-se corretamente ao snapshot C37 `bc5eb1e0...` visto antes da publicação. Enquanto o PR94 era criado, a 71 integrou a correção 72 no [C38](https://github.com/gustavomhss/Orchestra-SF/commit/943b3fc6919eecb55556b05c48f07c9dbba1c530) e fez outro commit de BI no [C39](https://github.com/gustavomhss/Orchestra-SF/commit/a9eb6d3e70714e712c48f7286c53a27b45236d95). Não reescrevemos observações históricas: esta é uma rechecagem incremental, não aprovação automática dos commits novos.

**SHAs fixados:** C38 `943b3fc6919eecb55556b05c48f07c9dbba1c530` tree `9ad861864150f4690ad1ed3faa1f8c7164130212`, parent C37; C39 `a9eb6d3e70714e712c48f7286c53a27b45236d95` tree `6975ec3f93801e081f14091343f6c2f2d1b57252`, parent C38. O C39 é HEAD observado, **não o C final aceito**. Leitura direta do código, de ambos os snapshots e do novo teste foi feita após esse avanço; os recibos 71 são apenas corroborativos.

## Nova matriz para C39

| Finding70 | Fonte corrigida | Presença/causalidade no C39 | Aceite integrado |
| --- | --- | --- | --- |
| `M70-AUTH-01` / 72 | **FIXED** + R1 138pass/2skip | **FIXED (estático):** toda implementação auth incorporada ao C38/C39, `local-store.ts` composto com readonly59 | **OPEN / MISSING_PROOF:** novo overlay não executado no C |
| `M70-ISO-01` / 73 | **FIXED** + R1 29pass | **FIXED (estático):** os dois blobs idênticos permanecem desde C37 | **OPEN / MISSING_PROOF:** consumidor HTTP/identidade e possível egress86 não testados no mesmo C |
| `M70-HTTP-01` / 74 | **FIXED** + Node3/Bun15pass | **OPEN:** instalação e Workbench antigos, `request-body.ts` ausente | **OPEN / MISSING_PROOF:** 74 ainda precisa entrar no C e ser validada |

**Correção da leitura anterior:** o registro original da missão84 marcou `AUTH-01@C37=OPEN` porque era verdadeiro naquele SHA. **Não transportá-lo para C38/C39**. Agora o problema de presença da 72 foi sanado; o problema de **validação integrada** continua.

### Evidência de C38/C39 lida diretamente

- `runtime/local-identity.ts` blob `473b9dbfe56092af26f0de2927767b8d64b79e1b`, mesmo source72 W.
- `runtime/auth-maintenance.ts` blob `af6e6749f7b61e07c419c90a264fdc48f3b32e21`, presente; `runtime/local-contract.ts` blob `d82b40928a235f2d249e45e59732f281dfded97f`; `local/entry.ts` blob `04fa7d53b8f2a4d4f7375c0f069a6ae38523e877`.
- `runtime/local-store.ts` blob **`d9eaac043514141abb2f1f978a6fd2ceaf4040d6`**, **não** o `7cca20...` da fonte72 porque 71 integrou com a raiz readonly59. O código corrente conserva a inicialização do ledger sob `BEGIN IMMEDIATE`, inspeção de autenticação em DB com leitura atual, escrita de credenciais via `operation(true)` e `readSnapshotRoot` para a raiz de negócios. Não trate equivalência parcial como equivalência total de source72: exige testes do overlay.
- Novo `test/product/auth-retention-fix/readonly-composed.test.ts` blob `59d5aa8328af3d1542ddb29020fb9b059ec26c5a` contém exatamente dois casos: `Graph completion observes logout before queued durable write` e `nested maintenance rejection poisons readonly59 root`. A existência do arquivo **não é execução**. A leitura de `C38-readback.json` na própria 71 registra `validation: NOT_RUN`.
- `runtime/procurement.ts` `a4ab021f646c0fc819b3afdde18796630fb9603f` e `runtime/application.ts` `81f469822a2756b3e1ca87effbf5fd865a56010d` iguais ao W73.
- `apps/cli/src/sucafina-product/installation.ts` **`21236af83e4de879242fd298d9e15a9923f3bf41`** e `product/interface/http.ts` **`164c8208067d9feaa2c720adfd9e8bf27e272715`** antigos; `runtime/request-body.ts` ausente. O M70-HTTP-01 segue sem correção no alvo.

### Próximo passo sem trabalho duplicado

**71:** incorporar 74 pelo W `d2a1227ae8858ed6defd80df7383d5648dd97b5e` e manifestos, preservar C38 readonly59/72 e C37 73, recompor mapas/fixtures afetados. **85:** qualificar readonly59+72 realmente no candidato integrado e trazer W/S/job dos dois novos casos e corridas, sem reescrever 71. **86:** validar resultado público de Procurement com identidade/egress após a composição. **45:** typecheck e guards, sem nova CI por esta 84. **S0:** exigir evidência dinâmica em um único C final, três revisores independentes, oito seleções, AM, G7/G8 e envelope de recibos.

**Parecer atualizado:** `FIX-FIRST` **para HTTP74 + validação de 72/73 combinadas**, sem regressão de origem constatada, sem prova de aceite e sem `GLOBAL_RELEASE`. Mudança material após C39 exige novo delta. A 84 continua documental; nenhuma edição de produto e nenhum teste executado/disparado por este reviewer.
