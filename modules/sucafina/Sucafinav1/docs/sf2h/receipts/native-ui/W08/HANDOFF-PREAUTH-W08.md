# W08 / S03 — pré-admissão: proposta de implementação inerte

**Estado:** `PREAUTH_CODE_PREPARED / BLOCKED_OWNER`, **não** `ARTIFACT_READY`, **não** integrado ou qualificado. Lease `ux-native-w08-e1` permanece `RESERVED_NOT_ACTIVE`. O ACK real de `9484a49d8a47976f3bbfffe92797574a90deaadd` foi lido de volta e o pedido de admissão encaminhado ao mesmo 114 em PR65 (issuecomment 6896771566).

## Conteúdo proposto (não instalado em produto)

- `packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/index.ts` ← [`proposed/draft-index.ts`](./proposed/draft-index.ts), blob `d91f4e75cd0ab6fd4df61422eae452dba7566faf`, preimage **ABSENT** (404 remoto), estado **AUTHOR_DRAFT_PROPOSAL_NOT_INSTALLED**.
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx` ← [`proposed/change-review-index.tsx`](./proposed/change-review-index.tsx), blob `08d69a11cf5ba19ce2777f3815143a993ab7dff2`, preimage **ABSENT** (404 remoto), estado **AUTHOR_DRAFT_PROPOSAL_NOT_INSTALLED**.
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/s03.css` ← [`proposed/s03.css`](./proposed/s03.css), blob `c824658aefddab52631c09209bc48183c6e8c3f0`, preimage **ABSENT** (404 remoto), estado **AUTHOR_DRAFT_PROPOSAL_NOT_INSTALLED**.
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/receipt/index.tsx` ← [`proposed/receipt-index.tsx`](./proposed/receipt-index.tsx), blob `598ee9b6404f37021a23e74fe4f9d48487b2ac78`, preimage **ABSENT** (404 remoto), estado **AUTHOR_DRAFT_PROPOSAL_NOT_INSTALLED**.
- `packages/app-shell/src/i18n/orchestra-chapters/sf-s03.ts` ← [`proposed/sf-s03.ts`](./proposed/sf-s03.ts), blob `b4ae99ceac85c9ebc6e694029fd70c7f71951a9d`, preimage **ABSENT** (404 remoto), estado **EDITORIAL_PROPOSAL_NOT_FROZEN**.
- `packages/app-shell/test-browser/sucafina-native/s03.test.ts` ← [`proposed/s03.test.ts`](./proposed/s03.test.ts), blob `5dcbb19a9173b6b18ec71008c6ab439426c6004d`, preimage **ABSENT** (404 remoto), estado **TEST_PROPOSAL_NOT_RUN**.

Esses seis blobs estão versionados **somente** sob `receipts/native-ui/W08/proposed/`. Nenhum arquivo na árvore de produto foi escrito e nenhum stub/recibo foi instalado. O manifesto [SOURCE-PROPOSAL.json](./SOURCE-PROPOSAL.json) contém os SHAs/preimages exatos, requisitos de integração e seleção proposta.

## Invariantes de segurança implementadas no pacote proposto

- Draft em memória sem rede/persistência: intenção pendente `operationRef + idempotencyKey + payloadDigest + expectedVersion` imutável, leitura remota não sobrescreve valor sujo, conflito expõe ambas versões, `discard` não descarta pending submetido.
- `outcome-unknown` mantém a operação original para **consulta** e eventual decisão humana; não existe replay/dispatch automático, nem callback que reenvia mutation. `confirmSave` ignora operationRef divergente; confirmação sem projeção **não** vira snapshot persistido nem recibo.
- Quarantine apresenta estado mínimo sem valor; `restoreSameAuthority` é método privado a ser invocado **somente** por F01 após revalidação real da mesma autoridade e ACL atual; `revoke` limpa private baseline e exige remount seguro.
- Review somente apresenta snapshots/efeitos recebidos, e o botão invoca `onConfirm` exclusivamente quando a admissão `SfReviewConfirmation.kind=admitted` e estado compatível estão presentes. Source/vínculo CAS continuam autoridade do produtor; o componente não faz cálculos financeiros paralelos.
- Receipt exibe **apenas** recibos entregues pelo produtor. `confirmed-by-authorized-refetch` usa explicação separada (não inventa receipt). Reconciliation usa `onReconcileRead`, nunca mutation. Denied/session-expired não renderizam dados privados.

## Bloqueios verificáveis para 114

1. **Admissão:** 114 não publicou GO específico de S03; pedido do W08 registrado. A origem `sf2-stack` é o mesmo C00/114; não criar outro integrador.
2. **Tipos / runtime:** F01 `context/contracts.ts`, F02 `schema/sucafina/common.ts` e F03 `shared/frame` / `shared/states` ainda precisam ser confrontados com os exports reais. Não criar shim permissivo nem stub.
3. **COPY-01:** as frases `sf.s03.*` do leaf são **propostas editoriais**, **não** constam do `surface-manifest.json` congelado. 114 deve obter resolução do contrato de copy; não registrar ou tratar como aprovado antes disso. O arquivo proposto foi incluído para permitir revisão humana de ambas línguas sem hardcode na UI.
4. **Qualificação:** seleção proposta a 120: `packages/app-shell/test-browser/sucafina-native/s03.test.ts`, após composição F01/F02/F03/I00. **NOT_RUN**, sem workflow próprio. Compiler/guards exclusivamente 119. Não inferir green.
5. **Diff coorte:** `sf-ux-w08` descende de `f8e4426`, que inclui o overlay UX inteiro ausente do `sf2-stack` atual. PR é **intake draft somente**; a 114 deve consumir os **seis blobs declarados**, nunca mergear todo o diff `sf2-stack...sf-ux-w08`.

## Caminho de saída

114 registra ADMIT ou recusa causal em S0, verifica nenhuma colisão dos seis preimages ABSENT, obtém aliases normativos F01/F02/F03 e copy, e autoriza writer W08 aplicar somente o próprio allowlist. Até esse GO, o commit deste recibo contém fonte **preparada, não instalada**.

`GLOBAL_RELEASE=false`. Zero testes locais, merge, deploy, Azure e alterações generated.
