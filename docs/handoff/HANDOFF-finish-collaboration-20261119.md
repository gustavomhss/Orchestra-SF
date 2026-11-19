# Handoff — finish-collaboration-20261119

SHA: 0f414ac3486cb7e6bbdab3c321f3a4b9cceb3fe2 (último código; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Migrada a leitura do consumidor de Collaboration em `modules/sucafina/Sucafinav1/test/product/wp02/collaboration-consumer.test.ts` para a projeção produtora real `domain.page.CAP02`, criada por `createSfPeopleProjectionHandlers`.
- A fixture conserva SQLite, login de operador, cookie, role resolver, autoridade de produto, persistência de fontes e admissões humanas originais. `createSfLiveContext` obtém o contexto por `authority.readContextAdmission` e converte as páginas efetivamente admitidas com `sfContextDestinationsFromPages`; o binding é a mesma identidade estável da autoridade. Nenhum stamp, concessão ou estado operacional foi construído manualmente.
- A leitura prova principal, capability CAP02, ID, ação, owner, vencimento, estado e versão exata do Hot Topic recuperado. Também prova 401 sem cookie na projeção e 404 da rota HTML aposentada.
- Preservadas as provas de resposta perdida, retry com mesma correlação, reabertura SQLite, atualização e conclusão, conflito CAS, intenções distintas, grant humano obrigatório, revogação após admissão, revogação de origem, referência removida, reincarnação ABA e privacidade de Talent.
- Gate estreito em GitHub Actions: run [44569329744](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569329744), job 135719751759 e cleanup 135721098119 concluídos com success. Resultado: 7 pass, 0 fail, 117 expect() calls, 1 arquivo.

## Pendente

- Nenhum item unbound nesta fatia. A fixture é uma prova de integração do consumidor com a projeção e autoridade reais; o ingresso completo do browser pertence aos gates E2E próprios.

## Decisões e justificativas

- Asserções removidas: nenhuma prova de negócio removida. A asserção legada `id="record-<id>"` foi substituída pelo mesmo ID e pelos valores e versão produzidos na resposta CAP02, em `collaboration-consumer.test.ts:216`. O status 200 continua exigido no endpoint ativo, e o HTML aposentado passa a ter sua própria asserção 404.
- O arquivo passa de 78 a 80 chamadas estáticas de `expect`; o run executou 117 expectativas. Não há skip, aumento de timeout ou mudança de expectativa para ocultar falha.
- O componente não exige serviços de host alheios à projeção People: `runtime: () => undefined` mantém essa ausência explícita. O contexto usa a admissão real; ações não fornecidas permanecem ausentes.
- Não foram alterados `runtime/application.ts`, workflows, suites, baselines, coverage ou receipts.
- O nome entregue é `finish-collaboration-20261119`, com três segmentos. O branch inicial `finish-collaboration-consumer-20261119` permanece no mesmo SHA de código, sem alterações adicionais.

## Como retomar

1. Revisar e integrar `finish-collaboration-20261119` a partir de `0f414ac3486cb7e6bbdab3c321f3a4b9cceb3fe2` sobre a base `f94dde9e8b1a4d363806f7a54fe6ae86b69c30e8`.
2. Para repetir esta prova apenas quando houver mudança relevante, criar atomicamente uma branch `ci-run-linux-*` com `.ci-run.json`: `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp02/collaboration-consumer.test.ts"]}`.
3. Continuar a correção das demais causas observadas dos shards SF em fatias independentes; este run não qualifica o conjunto inteiro nem o browser.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado nesta fatia de testes Bun.
- `bun run check:guards --base origin/dev`: não rodado; sem declaração de guards PASS.
- `test-ci`, runner Bun, package sucafina, arquivo `Sucafinav1/test/product/wp02/collaboration-consumer.test.ts`: success, run 44569329744; 7 pass / 0 fail / 117 expect.
- Snapshot de configuração executado: `e5cc647216c5479ba5d2567aff5d99ffe7549fd0`, parent de código `0f414ac3486cb7e6bbdab3c321f3a4b9cceb3fe2`. A branch de CI foi criada somente após o commit de configuração e removida pelo cleanup.
- Alteração posterior ao gate: apenas este handoff.
