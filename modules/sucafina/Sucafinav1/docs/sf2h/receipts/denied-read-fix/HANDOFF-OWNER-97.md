# VIS88-010 — patch causal ao owner de BusinessContext

**Identidade:** 97 / denied-read-browser97 / GPT-6. **Base do patch:** C45 `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d`.
**Fronteira:** não editar diretamente `product/host-binding/business-context.ts`; este é o patch completo para o owner/71 com preimage `2e7b312561f3f027ab070c61e15ecb6886fa169c`.
**Módulo novo permitido:** `product/host-binding/denied-read.ts`. Controle de acesso **apenas negativo**, sem emitir autoridade e sem gravar fontes.

## Causa e correção

`createSfAtlasBusiness.withRecordHistory` chama `freshDashboard` **antes** de validar o vínculo da referência original. `createSfDashboardSourceAccess` chama `dashboardIssue`, e `readScopedSource` persiste uma nova versão de scope do principal rebaixado a viewer. A leitura é depois negada; o oráculo integral detecta +57 linhas. Planner tem caminho homólogo no fallback `recordHistory.current`.

A correção é um preflight puramente leitor **antes** de `const found = await read(selected, call)` em `withRecordHistory`; rejeita evidência antiga cujo escopo não é do principal + `accessRevision` + `policyVersion` atuais, antes que qualquer issuer tente novo scope. Só vale para fontes record Dashboard/Planner. O preflight confere escopo vivo, encarnação física, id, versão e unicidade, e revalida binding/Request. `true` nunca concede acesso: os resolvedores originais continuam reautorizando projeção, revogação, ACL e continuidade.

Patch aplicável: `OWNER-BUSINESS-CONTEXT-97.patch`. Não remover o resolver legítimo, não suprimir captura explícita de viewers, não afrouxar `composed-storage.test.ts:157` nem alterar `ReadSnapshotRoot`. O patch usa somente API nova deste commit.

## Sequência de integração

1. O owner valida o preimage de `product/host-binding/business-context.ts` (C45 e base atual de sf2-stack; reconciliar HEAD).
2. Adota o patch completo ou devolve contraexemplo com paths/preimages exatos. Mantém sua autoridade exclusiva sobre `business-context.ts`.
3. Executa no dispatcher45 deduplicado o arquivo **original e intocado** `test/product/export-artifact-closure/composed-storage.test.ts` e o adicional `test/product/denied-read-fix/bound-source-read.test.ts`; exige PASS real e snapshots integralmente iguais.
4. Revalida retries, reopen, other principal, revocation/tombstone, source versions/incarnation e egress86 separadamente. Solicitar recheck independente a92. Sem GLOBAL_RELEASE.

**Prova histórica pré-fix:** run `43678123870`, job `132702648942`, duas falhas distintas: VIS88-010 (+57 linhas de scope) e egress86 (este último já composto em C45). Esta PR não declara correção instalada do consumer até a aplicação pelo owner.
