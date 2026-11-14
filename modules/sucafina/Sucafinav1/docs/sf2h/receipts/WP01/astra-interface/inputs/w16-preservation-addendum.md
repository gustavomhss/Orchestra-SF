# W16 — adendo de preservação

**Sem bloqueador de preservação.** Commit `f4ed6dfd82502bcebc091b9be6ce74d4eccf89b7`, tree `71fc6e6bb70f44b50cfb66e33a86ccd149ab32ad`, pai direto W15 `5fe39f1259d2f8631cef6172aaa7e6c92f436801`. Esta revisão usa fontes imutáveis e metadata Git/MCP; não atribui resultado de execução.

## Escopo do commit

| Categoria | Paths | Resultado |
|---|---:|---|
| Harness/README autorizados |4| Pool, named startup, driver Node e README |
| Documentos novos |14| Manifest, peer, finding, patch, auditorias e recibos concluídos |
| Produto/consumidores/foreign/protegidos |0| Nenhum arquivo alterado |
| Recibos/documentos anteriores |0| Nenhum arquivo reescrito |
| Arquivos excluídos |0| Nenhum |

Os quatro blobs publicados coincidem com o manifesto congelado. As árvores completas de product, src, runtime e do host CLI permanecem idênticas ao W15. Os 24 consumidores listados, o finalizer e as cinco assertions do startup continuam exatos. O prazo do named startup mudou conforme o manifesto; os prazos e bodies dos consumidores permanecem.

## Blocos preservados

| Bloco | SHA256 idêntico |
|---|---|
| `Node forward transport` | `07c6fa3e71fa30597c6155ac8dc16d97ece44e711bd496c0277453258f627b24` |
| `closedMessage validation` | `6f9fb4d2fca800b0bbb8e63f218cb5d76c4bdb7617e0eb8139bbf398feb20d2f` |
| `normal close/proof/report` | `42c46e1e6076e2d4f899524b57bd75df6e1cedcd4a143beefee4636a3defe6a0` |
| `lease/finalizer/report` | `42b122976f5f39a339217c038e7bd33c8e8f2f434b33a951c5d2a1c719285d0f` |
| `owned browser shutdown` | `9e05062bb51870c9da3d1bbe6972ebabc5a83ea51647eccdba90dce64a59b236` |

## Histórico e fontes

Os 24 commits recuperados continuam ancestrais de W16. Os 32 recibos históricos foram comparados uma única vez ao novo tree e continuam idênticos em modo/tipo/blob. As 256 comparações da auditoria W14 e as 32 comparações do adendo W15 não foram repetidas.

As branches astra-wp01, astra-wp02 e sf2-stack conservam os heads de recovery; astra-interface e PR #31 apontam para W16. Os 65 pins estrangeiros únicos verificados no W14 são herdados intactos. A fonte normativa, prepared-apply mais forte, BCS retido e todos os paths protegidos permanecem. As cópias do adendo W15 publicadas no W16 são byte a byte iguais às fontes.

## Snapshot e estado documental

Snapshot S `3260f74d7620098a91f1f47c703f247893b930f9`, tree `654b008393c8e81cd4012780883d25840348d99e`, tem W16 como pai. As árvores raiz completas diferem apenas pela adição de `.ci-run.json`; todos os outros blobs/subtrees são iguais. Isso prova a relação do envelope, não execução nem PASS.


O manifesto próprio foi publicado com o marcador histórico de peer pendente. O recibo final de peer também foi publicado no mesmo commit, com status NO_BLOCKER_IN_SOURCE_REVIEW_RUNTIME_PENDING e os quatro blobs corretos. Este adendo vincula o resultado final sem reescrever a evidência anterior; a revisão continua sem crédito de runtime.

Nenhum endpoint Actions, teste, typecheck, guard ou browser foi usado nesta auditoria. Ela não é aceite nativo ou gate global independente e não demonstra que o novo deadline resolve o stall de I/O.
