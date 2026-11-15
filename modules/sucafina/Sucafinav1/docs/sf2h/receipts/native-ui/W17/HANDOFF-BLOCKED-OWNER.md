# W17 / A05 — handoff de preflight — BLOCKED_OWNER

**Estado real:** `PREFLIGHT_VERIFIED / ADMISSION_REQUESTED / BLOCKED_OWNER / NOT_ARTIFACT_READY / NOT_INTEGRATED / NOT_QUALIFIED`. **NÃO** foi implementado código em paths de produto. **NÃO** existem testes executados, typecheck, merge, deploy ou Azure por esta sessão. `GLOBAL_RELEASE=false`.

## Identidade, base e autoridades

- Sessão nova: modelo efetivo GPT-6; rótulo solicitado Astra; session ID não exposto pela conexão; GitHub actor `gustavomhss`.
- Branch já existente: `sf-ux-w17` a partir de `f8e442616c96651f3b26013b34b8ce697860e3e2` (tree `39fd91edd2a452097dc333cd2098d326ac87b1e0`).
- Produto C58: `422f1ed7b549021d7c62c834c9d9041279112af4`; source portfolio HTTP blob `6cbfc373ea72a90351e4f9997f65663e0f5fc775`: **SAME_BLOB**; nenhum snapshot antigo restaurado.
- Reserva de lease `ux-native-w17-e1` **NÃO** ativa. `S0-C-e17-browser114` é a única autoridade de admissão/composição.
- [ACK W17](./ACK.json) publicado no commit `9dd2ff1a3cafa118693f06a403a119b62adce72d`; [source equivalence](./SOURCE-EQUIVALENCE.json) commit `b7a31de70f757779c1b3aa9d70c43811f742ca9c`. Solicitação de admissão registrada no [PR65 comentário 6896782092](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896782092), **sem resposta de aprovação confirmada**.
- Documentos normativos `CONTRACTS.md@94553a31`, `host-signatures.ts@e99e094f`, `contract-catalog.json@31dbec17` congelados. `EXECUTION-PROTOCOL.md` na árvore UX contém duas referências antigas aos atores 105/101/45; os trechos normativos equivalentes foram lidos via blob `0151a8e`, e `COMMON.md` explicita 114/120/119. Não há delta semântico portfolio.

## Delimitação objetiva

**Write paths de código exclusivamente W17, quando autorizado:**

- `packages/schema/src/sucafina/portfolio.ts` e `packages/schema/src/sucafina/portfolio/**` — `SfPortfolio`, os dez inputs/outputs source-locked, sem imports de CLI/Core/Server, sem `Any` e sem DTO financeiro inventado.
- `packages/client/src/sucafina/portfolio.ts` e `packages/client/src/sucafina/portfolio/**` — `createSfPortfolioClient`, usando o `SfTransport` fechado de F02 sem endpoint/proxy paralelo.
- `apps/cli/src/sucafina-product/native-ui/portfolio.ts` e `apps/cli/src/sucafina-product/native-ui/portfolio/**` — adapter sobre o produtor JSON já existente `createSfPortfolioHttp`; preserve a referência do `Request`, admissão, `business.withCase`, revalidação e `PortResult` real.
- `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts` — provas de contratos e negativas; testes **somente** pelo dispatcher 120 em Actions.

**Fora da allowlist:** `portfolio-http.ts`, `portfolio-reconciliation-http.ts`, `product/**`, código da99, `packages/schema/src/sucafina/index.ts`, `packages/client/src/index.ts`, operation registry, `protocol/api.ts`, `local/entry.ts`, bundles/generated, `sf2-stack` e paths de outros autores. Qualquer import/export/registro compartilhado é fragmento completo com pre/postimage entregue à 114, nunca escrita concorrente.

## Operações e semânticas verificadas

`SOURCE-EQUIVALENCE.json` contém **as dez** operações do `contract-catalog.json`: evaluate/preview/read/reconcile/results/prepare/promote portfolio e evaluate/read/units sensitivity, suas ações humanas reais, campos de body fechados, função produtora e saída canônica. Não existe REST de recursos novo: todas são `POST {mount}/{surface}?sf=<slug>` JSON com `Idempotency-Key`, inclusive leituras. O F02 governa credenciais/origem, `cache:no-store`, `redirect:error`, native-owner fence, generation+stamp, e unknown outcome após envio.

Invariantes para implementação: caso `{id,incarnation,version}` (sem fallback); seleção/combinação/digest reavaliados e source replay; versions e idempotency key preservadas; `zero != null != ausente`; `stale`, `conflict`, `denied`, `unavailable`, `needs-input`, `provider-conflict` e `failed` sem achatamento; 401 oculta conteúdo, 403 revoga escopo, 503/network não vira sucesso; timeout de mutação não libera nova tentativa automática. A sensibilidade mantém estados de threshold exact/sampled/unavailable. Reconciliation preserva a escolha original e sua prova por componente, sem inventar materialidade. **P03 original permanece FAIL; não etiquetar aprovação nem reconstruir oráculo.**

## Ação necessária e fechamento de gates

1. **114/S0** registrar admissão A05 por output + lease `ux-native-w17-e1`, ou impedimento causal específico (`BLOCKED_CONTRACT`, `BLOCKED_DRIFT`, `BLOCKED_OWNER`). Até esse registro, a escrita de produto está suspensa conforme o próprio pacote W17; não supor GO por silêncio.
2. Após GO, W17 implementa exatamente os quatro leaves acima contra contratos congelados e registra commit/tree/patch/pre/postimage, sem tocar shared code.
3. W17 entrega fragmentos completos de imports/registry/composição para 114; 114 só integra produtores presentes. F01/F02 são dependências para integração e prova, não justificação para stubs.
4. **120** executa seleção Actions cirúrgica e deduplicada no candidato composto; **119** typecheck/compiler/guards. W17 não despacha CI e não altera policy.
5. Apenas após código e integrações reais, criar PR para `sf2-stack` com os commits da implementação e evidências. **Não abrir PR apenas documental como se A05 estivesse ARTIFACT_READY**.

## Evidência e limites

- ACK e mapeamento foram publicados remotamente na própria branch W17; o conteúdo foi lido do GitHub sob os refs/binds registrados.
- `WRITE_PRODUCT=0`; `TESTS_LOCAL=NOT_RUN`; `GH_ACTIONS=NOT_DISPATCHED`; `TYPECHECK=NOT_RUN`; `ARTIFACT_READY=false`; `CI_QUALIFIED=false`.
- Não reivindico admission 114, green, P03 aprovado, source patch, mutação de produtor, PR implementacional, ou entrega final.

Este handoff permite retomada determinística do A05 após admissão explícita sem perder o escopo ou falsear o estado.
