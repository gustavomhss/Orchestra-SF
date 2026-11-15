# W16 / A04 — preflight e bloqueio de admissão

**Status:** `BLOCKED_OWNER` — pré-trabalho concluído, **NÃO `ARTIFACT_READY`**, **NÃO `INTEGRATED`**, **NÃO `QUALIFIED`**.

- Ator: GPT-6, sessão nova W16, sem ID de sessão exposto.
- Branch: `sf-ux-w16`; coorte `f8e442616c96651f3b26013b34b8ce697860e3e2` / tree `39fd91edd2a452097dc333cd2098d326ac87b1e0`.
- Material C58: `422f1ed7b549021d7c62c834c9d9041279112af4`, tree `647b024075265fc76d6253c99bec00a82618f816`.
- ACK pré-produto: `fb9f4714a3b8574f4a4e6e34329914a7d6ff7f4a` (`ACK.json`).
- Admissão solicitada na PR65: https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896734295
- Lease reservada: `ux-native-w16-e1`; **não ativada por ACK explícito 114/S0**.
- Contratos congelados: `CONTRACTS.md@94553a31`, `contract-catalog.json@31dbec17`, `host-signatures.ts@e99e094f`. COMMON prevalece sobre referências antigas 105/101/45 do protocolo, roteando 114/120/119.
- Verificação fontes: quatro blobs sem delta; Workbench `164c8208→78574180`: body 64KiB + UTF8 fatal, fence adicional `X-SF-Creation-Scope` sob `sf_case_draft`, resposta 409 para conflict e 400 para needs-input. Sem rollback do source.
- Mapeamento das 21 operações, dois novos GETs, schema exports e casos negativos: `SOURCE-EQUIVALENCE.json` no mesmo diretório.
- Canonical pointers: `WP11.T01..T04`. Critérios continuam ligados ao canônico, não alegados aprovados.

## Autoria aguardando admissão de 114

1. `packages/schema/src/sucafina/decisions.ts` — `SfDecisions.operations` com schemas source-locked das 21 operações, sem `Schema.Any` e sem import browser da implementação privada.
2. `packages/client/src/sucafina/decisions.ts` — `createSfDecisionsClient(transport)`, métodos readonly indexados pelo ID literal completo, transport preservando Idempotency-Key e owner.
3. `apps/cli/src/sucafina-product/native-ui/decisions.ts` — `createSfDecisionsProjectionHandlers(deps)` somente para `projection.case` e `projection.cases`, portando leitura autorizada de casos a JSON **antes** do renderer HTML; mesmo Request, ui.admit/validate/revalidate/finish, participant filtering, original `sf_case_read` e `contextualCaseReturn`. Os 19 HTTP preexistentes ficam intocados.
4. `test/native-ui-contract/decisions.test.ts` — campos de origem, versões e 10 negativos, contra implementações reais; CI somente 120 após integração F01/F02; typecheck/guards somente 119.
5. Shared `packages/schema/src/sucafina/index.ts`, package exports, router/composição e registro de operações pertencem exclusivamente à 114: entregar patch completo com pre/postimage; não editar nesta lane.

**Fronteira:** nenhum código de produto, teste, import compartilhado ou produtor de terceiros foi alterado; nenhum teste, PR, merge, deploy ou Azure executado. O documento não certifica A04. Bloqueio causal: admissão por output de `S0-C-e17-browser114` ainda não observada; o protocolo proíbe converter um ACK de worker em GO de escrita de produto.

**Handoff para 114:** registrar admissão explícita de A04 e ativação/ausência de conflito ou devolver recusa causal específica. Após admissão, esta lane precisa nova leitura HEAD e produzir os quatro artefatos reais, pre/postimages e uma PR convencional para `sf2-stack`. Não criar outro C00/dispatcher.
