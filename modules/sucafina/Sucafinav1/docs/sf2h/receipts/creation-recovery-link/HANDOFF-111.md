# Missão 111 · HTTP de correlação e ligação dos formulários

**Estado:** `OUTPUT_READY / NOT_COMPOSED / ACTIONS_NOT_RUN / REVIEW91_PENDING / GLOBAL_RELEASE=false`.

## Identidade, autoridade e base

- Repositório `gustavomhss/Orchestra-SF`; branch preexistente `creation-recovery-link`; ACK anterior ao produto: `41d0bdab43da2513d8b7eb9f1f9c2362f3cf12f9`.
- Modelo efetivamente observado: **GPT-6**. Identidade externa de provedor Astra e ID de sessão separados: **não expostos**. Lease declarada: `creation-link-browser111`; não reivindicar revogação ou acesso aos arquivos da 52/96/106.
- Base C53 `180212940105e7b9ad15171b067c1c1b7841df5f` (tree `c423dd1e0828242534fd45d4183104ecc1d20edd`); plano congelado `dbf9547211d9b0fade619790de7c19c0869b7c7d` (15 WPs/74 tasks/17 contracts/1610 criteria; T0 histórico conservado).
- 96 PR103 `3ef1bbf2188275f5bc6ebaeed162a069ad3ae351` — `case-port.ts` recovery SHA `122281c82d15e5732fee287cc4bcead4b6f97eb4`, `decision-create.ts` SHA `d1d12abb1a4c460bdcd9ccf26353f7d0b4a74afb`; `OWNER-52-100-CURRENT.patch` blob `64de6285477b5373eef9caa248f50b95d6e77b7d` read, NOT applied here.
- 52 PR40 branch `astra-wp11` `3cce0806f4e958b2282afae5717e4948e270745a`: terminal, entregue a47, não reabrir lease. Integrador106 é único writer `sf2-stack`, observado `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07`; NÃO editar sua branch.

## Own-path outputs (commits CAS, sem edições compartilhadas)

1. `apps/cli/src/sucafina-product/creation-recovery-http.ts` blob `96a83583afef331274ce1ea9f5c2877175434433`: `createSfCreationRecoveryHttp` é GET privado no path existente `/{surface}?sf=workbench-create-recover`, somente três superfícies reais. Admite e consome `sf_case_read` pelo UI host real, liga a UUID original do header, recalcula digest de escopo host (installation/project/principal/policy), consulta exclusivamente `casePort.recoverCreation` da 96, revalida revogação antes do egress, finaliza lease. Sem write, segunda implementação C08, POST, redispatch, segredo no browser ou caminho de fixture permissivo. `missing` é devolvido como `200 {status:ok,state:not-found}` **inconclusivo** conforme contrato efetivo da UI96. Respostas tipadas deny403, stale/conflict409, invalid400, unavailable503; exige C08 e case reader 96.
2. `test/product/creation-recovery-link/recovery-http.test.ts` blob `46ab9222309a5856e931d033261f3438b1ce939b`: teste de fonte com UI admission C08/SQLite real + GET; observa before/after sem mutação, reboot SQLite, isolamento Bob, revogação inclusive egress, reencarnação e duas intenções iguais distintas. Requer **96 realmente incorporada**: sem `recoverCreation`, teste falha explicitamente.
3. `test/product/creation-recovery-link/recovery-browser.test.ts` blob `913e205486854fe581065fc7013e954868b0d45e`: browser real pelo pool WP01 Linux sob Actions, com JS UI96/SQLite/adapter111, resposta perdida, contexto da mesma instalação, restart e perfil de segundo ator. O teste contextual cobre **somente lookup da intenção pendente ao reabrir o formulário**; geração autêntica de sourceRef contextual e POST contextual completo continuam obrigação de host52 e recheck91. Nenhum CDP para obter outputRef.

## Quatro propostas completas para owners (NÃO aplicadas)

`OWNER-52-106-C53.patch` Git blob `205f48bc7ea6b8bac08d339a574f8c4609f94d15` + manifesto `OWNER-52-106-C53.json` blob `7063741dbfe2243637eb95048c1dc945a0e70d03`. O diff está rebased para **preimages exatas C53**, não para a pré-versão da PR40. Os *postimages* foram gerados como blobs Git íntegros para verificar futura aplicação, mas nenhum substituiu os arquivos owners.

| Owner path | C53 preimage | expected postimage |
|---|---|---|
| `product/interface/http.ts` | `eb7322e915c61594a6cf1a05d562dc39ad7b6c38` | `78574180369c9495cbe5e5d3e569bb500fbff277` |
| `product/interface/contextual-decision.ts` | `5245f469fab7f23474c4c406ddd1d2f1f43d65a2` | `c00afe5f9bec072c6236441e1b650327d26853ea` |
| `product/contracts/host-context.ts` | `bd7df025e12aa457898f48fcf9634273ec5be381` | `6c85ddc7544ea8318cfc14b6c6142b1e8faca593` |
| `apps/cli/src/sucafina-product/host-context.ts` | `f03ab621e96cfda23456be73bba2d24f24754d36` | `8e9f96a13efa112b94e2578f9c0b8a663cd04aed` |

Patch específico: o GET é entregue pela **nova** `creation-recovery-http.ts` no topo do `productHttp` chain, sem registrar outro GET em `product/interface/http.ts`; formulário normal recebe `scopeDecisionCreateForm(...,decisionCreationScope(admitted.value.binding))`, o contextual idem após emissão autorizada do ref. POST com escopo divergente rejeita antes de dispatch; C53 status conflict/needs-input corrigidos. Host compõe função **real** `business.cases.recoverCreation` da 96, nunca fallback.

## Sequência de adoção e validação (sem pressupor handoff)

1. Owner106 reconcilia HEAD real + preimages + autoridades posteriores; recebe código da96 (UI e case-port) sem sobrescrever terceiros, depois o adapter111 e seus dois novos testes, e o patch `OWNER-52-106-C53.patch` **somente via owners atribuídos e CAS**. Ao divergirem os blobs, refazer hunks; não aplicar cegamente.
2. Validar revisão de contexto/accessRevision/policy no GET e POST, capacidade e binding, 2 observações da96, estado SQLite antes/depois, readiness do host e formulário instalado normal + contextual. `caseCreationRecovery` é superfície privada host; não expor a models.
3. **Só dispatcher107** pode fazer requests de produto por `test:ci`/workflow existente: conferir dedupe/W/S config/selection, executar os testes C08/HTTP e browser com startup/finalizer WP01 em ordem, sem testes locais. Registrar W/S/run/job/log/artifacts e provas observadas ou falhas, além de typecheck/guards pelo owner108.
4. Solicitar a S1-R1/91 recheck independente **R1-91-001** do produto instalado no candidato exato, inclusive reload após resposta perdida, contextual real, duas intenções iguais, policy/principal/revogação, sem aprovar por fonte/fixture.

Nenhum `OUTPUT_READY` é `DONE`. Receipts históricos e SHA do candidato não foram reescritos. `GLOBAL_RELEASE=false`.
