# Missão172 — F01 / handoff terminal para 162, 163 e 164

**Resultado:** autoria publicada, integração/qualificação **pendentes**. Epoch `ux-native-w02-e3-browser172`, branch `sf-ux-w02`, PR#131. Modelo efetivo GPT-6; nenhuma identidade de sessão Astra foi exposta. Sem reset, force, branch nova ou interferência em outros autores.

## Código e pre/post

- **F01 produtor:** `apps/cli/src/sucafina-product/native-ui/live-context.ts`, new → blob `03a47cf080fc5b9751dbadad272c14d17f5cfc34`.
- **16 testes negativos de fronteira:** `modules/sucafina/Sucafinav1/test/native-ui-contract/live-context.test.ts`, new → blob `9fc888c5ceba20ca321e90ff8bc8e64e0c3acdad`, **NOT_RUN**.
- **Handler já existente:** `apps/cli/src/sucafina-product/native-ui/context.ts`, `940f8fc612f7dee3a3c412075a8e16d3d6e21410` pre=post, preservado.
- **ACK172:** `ACK-172.json`, blob `afd10f3c2db80153f0741674f8cfdca121b59341`, emitido antes da escrita.
- **Patch inerte completo:** `PATCHES-162-F01.json`, blob `2d09607af836a81dcfa1dfede97b0a47d74cc271`. Contém conteúdo integral de quatro preimages + postimages e blobs previstos. **Nenhuma alteração protegida aplicada**.

Branch original `4c72ac4f609618f749c1930b5738737d55693027` / tree `950cea310351eaf9671466342b78d9aaddbcaa03`; commit de produção `7537aa3f3d9db88b630c6107d5af0e17d7d83f69` / tree `45649df4875edbad5f1a250f99d3812480b52ad2`.

## Critérios, implementado versus observado

O leitor conserva o **Request original**, só aceita o binding corrente (mesma instância de runtime e instalação/projeto/host), identifica principal/policy/accessRevision exclusivamente na fonte privada e revalida três vezes, inclusive depois da última consulta operacional. CAP pages exigem origem/página exatas e proíbem ações não concedidas; toda operação sem leitura real da disponibilidade permanece `unavailable`, sem promoção por catálogo. Dos 305 IDs de operações/70 recursos, somente o próprio `ctx.context` pode ser `ready` pela execução autenticada atual, quando a ponte existir. O leitor não expõe roles, grupos, grants ou credenciais privados.

**Todos os 16 cenários foram escritos, nenhum foi executado.** São testes negativos de contrato com callbacks sintéticos e não substituem prova de identidade/sessão/grant, runtime, modelo, scanner, AM01–06 ou CI. F01-77-CTX: fonte pronta parcialmente; F01-AC01/02/03 permanecem **NOT_RUN** no candidato. Nenhum PASS de aceitação, deploy, GLOBAL_RELEASE ou Goal.

## Ação exata para a única integradora 162 (PR65)

Adotar os dois blobs autorais, ler `PATCHES-162-F01.json` e reconciliar o patch contra `sf2-stack@913b6b8f143e6c3e869eee293d02f04259c7cdd1` (tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`) **somente se os quatro preimages permanecerem iguais**. Caso mudem, comparar/reconciliar sem reset, force ou reintrodução de bytes antigos. A ponte proposta liga `authority.resolve(originalRequest)` e as páginas via ACL nativo existente, `identity.person(originalRequest)` para 401/403 e o authMode da instalação configurada. Não registrar ação nem operação `ready` a partir de presença de método/catálogo; adicionar posteriormente apenas probes reais autorizados. Só 162 escreve o host, local entry, tipos e produto compartilhado.

## Solicitações cirúrgicas após a integração

**163 / PR107:** usar **a mesma C/tree publicada por 162** para compilar o conjunto `native-ui/context.ts`, `native-ui/live-context.ts`, `host-context.ts`, `product-authority.ts`, `product/contracts/host-context.ts`, `local/entry.ts`, `schema/sucafina/context.ts`, `common.ts` e `operation-registry.ts`; preservar correções de SDK136, protocólos e guards. Geração de SDK só pelo fluxo hospedado autorizado, sem repetição de material inalterado.

**164 / PR106:** selecionar exatamente `modules/sucafina/Sucafinav1/test/native-ui-contract/live-context.test.ts`, `modules/sucafina/Sucafinav1/test/native-ui-contract/sdk-query-repair.test.ts` e `packages/app-shell/test-browser/sucafina-native/context.test.ts` no CI hospedado existente, somente após 162 publicar a C integrada; citar run/job/attempt e falhas/artefatos reais. Executar oráculos independentes positivos no runtime real; não traduzir mock/fixture em AM PASS.

**Continua obrigatório:** C integrada, 8 CI, epic, AM01–06, três FINAL independentes, D e guards. Goal pausada. Nenhuma execução local, nenhum runner, dispatcher, infraestrutura ou engine criado.
