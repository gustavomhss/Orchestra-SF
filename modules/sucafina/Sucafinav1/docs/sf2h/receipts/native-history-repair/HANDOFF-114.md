# HANDOFF115 → 114 (única integradora)

**Entrega de fonte parcial; não declarar correção funcional nem PASS antes da alteração do adapter + CI.**

- Repo/branch/PR: `gustavomhss/Orchestra-SF` / `native-runtime-finish` / #96.
- ACK115: `345b0d0169f704273c721187dc7c8098137b0c3d`, HEAD de início `4159c2e02e8a56900331a8ec646253ce6a6e5ce9` árvore `44da3f1bfd15f591be7f6a1617d436b3a1c0df55`.
- **W115 source**: `2eab3b6df7cbeb1be791a8e451e507b67f8b2f37`, árvore `a80f87cb7b964d1b8f1b5b385bd65e86e7b989d4`; apenas dois paths de testes autorizados alterados. Full patch no receipt `SOURCE-PATCH-115.patch` e pre/post blob no `SOURCE-MANIFEST-115.json`.
- Deadline test: utiliza UI binding original `ui.binding` (inclui `requestId`), explicitamente `TrustedUiContext`; evita espalhar `f.binding` nativo para UI; preserva deadline **400 ms**, abort, zero egress, oráculos.
- Testes novos: retorno sentinel sem Task, alias de autorização vs reserva canônica, disposal bloqueia egress, revogação de pending read não vaza bytes tardios. Original `historical-read.test.ts` não editado.

## Primeiro descompasso causal verificável por código

O leitor nativo `routine-native-records.ts` aceita `Authorization.Granted` e `Dispatch.ReservedV2` validados; ao consultar `ids.authorization` com reserva existente projeta `record.reference = reservation.id` e mantém `record.authorizationID = ids.authorization`. Já `routine-native-adapter.ts` exige `record.reference === reference`, recusando o alias legítimo embora o reader tenha validado esse ID. `observeSfRoutineNative` captura a exceção de `expect(nativeAdmission.status).toBe("ok")` dentro do callback do teste original, e por isso a expectativa externa vê `undefined`. Nova sonda separa retorno do registry, resultado por cada ID e a primeira recusa, sem alterar o oráculo original.

**Proposta em arquivo de ownership compartilhado, NÃO aplicada pela115:** `ADAPTER-ALIAS-PROPOSAL-114.patch` faz estritamente `if (!record || (record.reference !== reference && record.authorizationID !== reference))` no reader helper; preimage `dfde682c3233b36b7c172459f4bc1788c8f7e4b3`, postimage candidato `d70e2e66488d5f4e40d963d664d05a254034e32b`. Esse preimage permanece idêntico em C53, W115 e no HEAD integrador observado `67d5c4f1a6e36eb90d4d2244028011e4476965b7`; conferir novamente no momento do intake e obter owner legítimo. A preservação de `checkPlan`, ACL, caso, fontes, publicação, revogação e ausência de Task é condição do patch, não opcional.

## Validação / responsabilidades

- 120: reexecutar pela Action existente **sete specs originais exatos**, na ordem de CI107 `RUNS-107.json`, mais `native-history-repair/historical-contract.test.ts`, só **após** composição de novo C/árvore com o patch adapter. Dedup contra run original C53 `43707901079/job132792877003`; CI ainda **NOT_RUN para115**. Pedido em `CHECKS-REQUEST-120.json`.
- 119: Bun `typecheck` hospedado dos pacotes sucafina/CLI na árvore composta, fechar três TS diagnostics em deadline e julgar o novo arquivo. `TYPECHECK-REQUEST-119.json`.
- 114: só integradora pode compor C posterior, revalidar preimages, executar/receber patches shared, registrar intake ACK, reconciliar com producer95/admissão110 e demais sources. O código W115 pode ser consumido seletivamente agora; a lacuna adapter bloqueia o caso positivo até alteração autorizada.
- C53 prova precedente: Linux/Bun1.3.14, 7 specs/179 casos, **178 PASS, 1 FAIL**, 954 expect; não é resultado de W115 ou C futuro.

**Critérios abertos:** positive historical read, CI120, compiler119, runtime nativo C15 instalado, AM01–AM06, G7C/G8D, GLOBAL_RELEASE=false. Testes de componente, mesmo verdes, não atestam Task/provider/Relay real.
