# WP11 — inicialização real das fontes no consumidor de apply

Estado: **NOT_APPLIED — delta externo preparado para o owner WP11**. O arquivo de produto/teste externo não foi alterado por WP03. Patch: [wp11-planner-apply-source-initialization.patch](./wp11-planner-apply-source-initialization.patch).

## Falha herdada comprovada

A seleção isolada do teste original `test/product/wp11/planner-apply.test.ts` falhou no seed `73ee7fd812d233f898ef79a9378014d4339d9875` com `SF_SOURCE_IDENTITIES_UNAVAILABLE`: 0 testes passaram, 1 falhou. A evidência é o [run 43517559589 / job 132203295399](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43517559589/job/132203295399). O snapshot `f44f42fa8e7ea685191e863e7416fd21ce1ef455` é um filho direto do seed e a comparação por GitHub MCP mostra apenas `.ci-run.json`, blob `5f0da820458bc966ec7f0799ec6b3b0c7070a41f`, de diferença. O run tem finalidade de atribuição da falha; não qualifica o candidato. O controle omni foi `not applicable` e não prova execução nativa.

## Causa e alteração proposta

O fixture inicializa identidades somente de `planner`. `createSfPreparedApply` usa o estado real que combina o domínio Planner com o ledger/receipt em Dashboard; `createSfProductState` entra em `persistence.transactionAll`. O wrapper `createSfSourcePersistence` preserva e valida as identidades de cada superfície alterada. Sem a inicialização Dashboard, a atualização transacional encontra a pré-condição de fontes ausente e recusa a operação.

O patch troca essa única inicialização por `initializeSources` sequencial para `dashboard`, `planner` e `procurement`, usando o mesmo conjunto do bootstrap real `local/entry.ts`. Não muda o guard de identidades, o apply, as expectativas de CAS/grant nem o banco. Base do patch: conteúdo do arquivo no candidato W3 `8f91131ad3357c94fa135392b6829908356d82e5`, Git blob `7925f873f6638dc02e9d823912699edd48745e82`.

## Evidência independente no escopo WP03

`test/product/wp03/prepared-apply-integration.test.ts` usa o produtor Planner e o consumidor real WP11 com SQLite e as três superfícies inicializadas. No [run W6 43523654974 / job 132223957537](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523654974/job/132223957537), no produto `6f004731e7848bf540434a3ee050cd0f28f342cb` e snapshot `9a62d6c0ed2638960319f8ff3d68eba58d2e92e5`, a observação registrada foi PASS (908,31 ms) para:

> Planner preparation and the real WP11 apply consumer preserve grants, atomic receipts, retry, reopen and stale rejection

Essa prova cobre recusa sem grant, aplicação, receipt atômico, retry idempotente, reabertura e rejeição stale naquele consumidor real. A seleção W6 inteira concluiu com 142 pass / 0 fail em 28 arquivos, 1.521 expectativas e 42,26 s. A passagem do teste WP03 não transforma o patch externo não aplicado em PASS, nem substitui a execução residente SessionV2.

## Ação do owner

Aplicar o patch exato no arquivo WP11 e executar **somente** `Sucafinav1/test/product/wp11/planner-apply.test.ts` pelo envelope/CI autorizado. Se aparecer outra falha depois da pré-condição corrigida, tratá-la com o resultado original preservado. Não remover assertions, não auto-inicializar implicitamente durante o commit e não afrouxar `requireSourceIdentities`.

Nenhum teste local foi executado para este handoff. O patch original ainda requer execução hospedada após aplicação.
