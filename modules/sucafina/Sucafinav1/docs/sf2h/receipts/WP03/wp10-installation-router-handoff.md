# WP10 — registro duplicado da rota da instalação real

Estado: **BLOCKED_EXTERNAL / NOT_APPLIED**. O CLI de produção não chegou a servir a instalação; a jornada do Planner permanece sem prova de navegador. O patch anexado não foi aplicado em código fora do ownership WP03.

## Falha observada

O [run browser W4 43520849840 / job 132214420325](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520849840/job/132214420325) selecionou exatamente `e2e/sucafina/wp03/planner-mounted.spec.ts`, um worker, zero retries e uma repetição. Produto `84b5a08aedce2cfc5fae048d96b39863692a469e`; snapshot `41fe8c068285e8712d43d4af5a784e05f1b11b80`.

O CLI real saiu com código 1 antes de qualquer navegação de produto. Às `2026-11-13T22:39:56.828Z`, seu log registrou `Error: Method 'ACL' already declared for route '/sucafina'`, originado em `find-my-way-ts@0.1.6`. A spec falhou na espera de readiness, que observou `CLI exited: 1`; o resultado foi 0 pass / 1 fail. Não há prova de grid, filtros ou versões nesse run.

Artefato [14082119400](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520849840/artifacts/14082119400), digest SHA-256 `0aee7806ff77e30f6587b5476711474acdbaff28baa6fe296c7997a9306eef87`. O log anexado já é saneado; trace está desligada nesta spec.

## Causa confirmada em fonte primária

`apps/cli/src/sucafina-product/installation.ts` retorna duas layers: uma para `installation.mount` e outra para `${installation.mount}/*`. Ambas usam método `*` e o mesmo handler. Leituras GitHub MCP do seed `73ee7fd812d233f898ef79a9378014d4339d9875` e de W4 retornaram o mesmo Git blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109` para esse arquivo.

O catálogo raiz do seed fixa `effect` e `@effect/platform-node` em `4.0.0-beta.83`. Na implementação primária de [HttpRouter dessa versão](https://github.com/Effect-TS/effect-smol/blob/effect%404.0.0-beta.83/packages/effect/src/unstable/http/HttpRouter.ts), Git blob `3a52c4acd7938674bc209059212efd745cff9715`, o registro de um caminho terminado em `/*` chama `router.all` tanto para o wildcard quanto para `path.slice(0, -2)`. Logo, o registro separado de `/sucafina` duplica a base já inserida pelo wildcard. `ACL` é o primeiro método concreto encontrado no registro de `*`; não é uma ação do Planner.

A fixture inicia um único processo `serve`, passa uma única flag `--installation` e chama somente os helpers de configuração/enrollment no bootstrap anterior. Esses helpers não criam listener nem registram rotas. `serve.ts` carrega a instalação uma vez e fornece sua layer uma vez ao router. A revisão independente confirmou a mesma causa e o delta mínimo.

Há atribuição **estática** ao seed por fonte e dependência iguais. Não foi executado um run separado de boot no seed, portanto este documento não declara uma falha de execução baseline que não foi observada.

## Delta mínimo e preservação do comportamento

Aplicar [wp10-installation-router.patch](./wp10-installation-router.patch) ao blob informado. Substitui o `Layer.merge` por somente `HttpRouter.add("*", `${installation.mount}/*`, route)` e remove o import `Layer` que fica sem uso. A expansão nativa do router mantém base e subrotas; o handler, guards de Host/origin, finalizer e host contributions permanecem os mesmos.

Não há flag legítima do CLI que elimine esse registro interno duplicado. Mudar a porta ou o nome do mount produz a mesma duplicação. Retirar a instalação, usar outro servidor ou injetar HTML não exercitaria o caminho solicitado e não é uma correção.

## Aplicabilidade estática do patch

O conteúdo observado do blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109` foi materializado somente em uma árvore temporária separada. O seu hash Git foi conferido antes de executar `git apply --check --verbose` contra o patch anexado. A verificação retornou **exit 0**, com `Checking patch apps/cli/src/sucafina-product/installation.ts...`. O patch não foi aplicado nessa cópia nem no checkout de produto. Isso comprova somente que o delta é aplicável à fonte indicada; não é execução do CLI corrigido, typecheck ou prova de navegador.

## Validação pelo owner

Após aplicar no owner WP10, executar a mesma seleção de Playwright contra o novo produto, preservando o envelope exato. A readiness deve alcançar `local-operator`; então a spec poderá executar as ações reais e revelar eventual próximo problema. Acrescentar uma regressão do carregador que atenda a base e uma subrota, preserve recusa por Host/origin e prove disposal seria adequado ao owner, sem duplicar a instalação no harness.

Nenhum teste local foi executado, nenhum caminho comum foi editado e nenhum gate foi convertido em PASS. A spec permanece pronta para repetição após a correção do host real.
