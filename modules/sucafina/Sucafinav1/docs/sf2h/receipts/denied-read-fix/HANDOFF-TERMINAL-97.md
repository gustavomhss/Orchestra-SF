# Missão97 — handoff ao integrador71 e reviewers92/93

**Estado terminal desta sessão:** `DELIVERY_PENDING_OWNER_ADOPTION_AND_CI`; **não é FIXED e não é GLOBAL_RELEASE**. A missão terminou seu escopo independente e está bloqueada por uma edição em arquivo de outro owner, cuja autoria não foi tomada por silêncio.

**Origem e árvore:** branch `denied-read-fix` em W `d369e23f495e41a861f0ebc47b6334d166ddf1d1` (árvore `a608f764ac0513ab29b097f0dfb3067188094525`), pai C45 `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d`. PR draft [#102](https://github.com/gustavomhss/Orchestra-SF/pull/102) base `sf2-stack`. Planejamento fixo `dbf9547211d9b0fade619790de7c19c0869b7c7d`, missão97, lease `denied-read-browser97`. O backend não expõe ID da sessão, modelo GPT-6; GitHub `gustavomhss`. Primeiro ACK publicado antes de escrita [na PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6889592689).

## Causa observada

Com a owner original rebaixada a viewer, `accessRevision` muda. O `withRecordHistory` em `product/host-binding/business-context.ts` chama `freshDashboard` antes de provar que a referência capturada pertence à autoridade corrente. O `createSfDashboardSourceAccess` chama `dashboardIssue` e acaba persistindo metadados `sfSources.scopes` de leitor durante uma transição posteriormente negada. O histórico [Actions run 43678123870](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43678123870), job `132702648942`, snapshot S `a952f1b3ce48b15473f4b07810e79efd05d759fd`, evidenciou +57 linhas no `composed-storage.test.ts:157`. É **VIS88-010, não egress86**.

`source-lifecycle.ts` continua intacto (blob `0e812842ad0d534998c182100a8466548d70e915`) porque a emissão legítima de fonte pode gravar scope de viewer autorizado. Não se deve bloquear toda sessão viewer, nem alterar oráculo, C08/ReadSnapshotRoot, store ou fences.

## Materiais concretos

- `product/host-binding/denied-read.ts` (novo): prova negativa somente-leitura de scope vivo, accessRevision, versão, encarnação e Request. Não cria autoridade nem grava.
- `test/product/denied-read-fix/bound-source-read.test.ts` (novo): original, downgrade, retry, reopen, outro principal, revogação, captura positiva de viewer, versionamento positivo e tombstone.
- `OWNER-BUSINESS-CONTEXT-97.patch` **inteiro**, para `product/host-binding/business-context.ts` preimage `2e7b312561f3f027ab070c61e15ecb6886fa169c` confirmado também no `sf2-stack` observado `b02ac1251c754620c5d8ab98cfd0c1d51315da27`. Importa o check e o chama antes da reemissão via `read(selected,call)`. **Não aplicado** por pertencer ao owner.
- `ACK-97.json`, `PATCH-PREPOST-97.json`, `VALIDATION-97.json`, `CRITERIA-97.json`, `DEPENDENCIES-97.json` e este handoff guardam autoridade, evidência e limites.

## CI pedido, não disparado

Dispatcher45, Linux, `sucafina` / diretório `modules/sucafina` / `bun`; arquivos `Sucafinav1/test/product/denied-read-fix/bound-source-read.test.ts` e `Sucafinav1/test/product/export-artifact-closure/composed-storage.test.ts`. Deduplicar por W/árvore/seleção/runner/config/fixture. `W=d369e23f495e41a861f0ebc47b6334d166ddf1d1`, `S` **null**, run/job novos **null**, **NOT_RUN**. Um run sobre W antes da instalação do patch de owner ainda deve detectar o defeito original; a aceitação só virá sobre o **W integrado**. O run histórico `43678123870` é **FAIL**, não valida código97.

## Próximas ações obrigatórias (donos separados)

1. **Owner71** reconciliar HEAD, consumir os blobs exatos do patch mínimo e integrar via seu próprio lease, sem mover/copy branch inteira. Não assumir ACK sem resposta.
2. **Dispatcher45** rodar somente a seleção cirúrgica deduplicada em GitHub Actions, preservar expectativas e emitir W/S/run/job e assertion counts. Se houver regressão real, retornar witness concreto.
3. **Reviewer92/R2 + reviewer93/R3** reexaminar aplicação ao candidato composto e os controles de segurança/snapshot, independentes da autoria. Pedidos enviados às PRs #97 e #98.
4. **S0** decidir status com evidência instalada e gates restantes. **GLOBAL_RELEASE permanece HOLD.**

Nenhum merge, force, Azure, deploy ou teste local; `product/host-binding/business-context.ts`, `product/reviews/application.ts`, `runtime/local-store.ts` e fixture/oráculo original permaneceram intocados.
