# Handoff — finish-source-tests-20261119

SHA: b866efe17655dc929574862e7e6727f46f61aa0c (último código; este documento é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Migrados os quatro hosts de componente antigos de Hot Topics em `modules/sucafina/Sucafinav1/test/product/wp02/hot-topics.test.ts` e `test/product/wp08/handoff.test.ts` para a nova identidade transacional do produtor.
- O helper compartilhado `test/product/wp02/hot-topic-host-fixture.ts` usa SQLite privado, `createSfSourcePersistence`, `enumerateSfSources` e `bindCreatedSourceIdentity` reais. Correlações só são publicadas pelo host de componente depois de a transação e o guard de fontes concluírem. Atores e controles de autorização de cada componente permanecem os mesmos do teste anterior.
- Removida a semeadura manual de `original-topic-incarnation`. O teste lê a identidade realmente emitida pelo produtor e exige que a correlação retenha essa mesma incarnation.
- Preservadas as provas de retry sem duplicação, intenção alterada, outro principal, CAS, conclusão, leitura, perda de escrita, perda de fonte, congelamento do input antes da autorização assíncrona, IDs ambíguos, link contextual e lease humano real.
- Gate [test-ci 44567897064](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44567897064): SUCCESS, job 135714575117, cleanup 135716088347; 6 testes passaram, 0 falharam, 32 expectativas, 2 arquivos. Código `b866efe17655dc929574862e7e6727f46f61aa0c`; commit de configuração `252d548f01d2e587c05cf5458c655ac701b7ef94`.

## Pendente

- Nenhum item funcional pendente nesta fatia de hosts de componente. O catálogo geral dos shards SF e a qualificação da integração seguem sob coordenação.
- Esta fatia não substitui a prova produtora de transação/autorização de PR358, nem qualifica fluxos de navegador.

## Decisões e justificativas

- Asserções removidas: nenhuma. Todas as 30 expectativas originais permanecem; foram acrescentadas duas sobre identidade/correlação.
- A atribuição manual de sfSources era configuração de fixture, não uma asserção. Foi substituída pela emissão real dentro do guard de fontes; não foi criado um binder que inventa sucesso.
- Os testes de componente continuam explícitos sobre seus atores e contextos. Não afirmam autenticação de instalação que não executam; a emissão de fonte, SQLite e domínio exercitados são reais.
- Nenhum controle de console foi recriado. Não houve alteração em produtores, `runtime/application.ts`, suites, workflows, baseline, coverage ou receipts.
- Toda execução ocorreu em GitHub Actions; nenhum shell local ou acesso à máquina do dono.

## Como retomar

1. Integrar `finish-source-tests-20261119` no SHA de código acima.
2. Continuar as causas restantes do catálogo em arquivos disjuntos; Microsoft foi entregue separadamente em PR359.
3. Se surgir uma regressão concreta, repetir o gate com uma branch `ci-run-linux-*` criada atomicamente no commit que contém o JSON abaixo.
4. Deixar a qualificação global de guards e sf-ci com o coordenador.

## Comandos e resultados

- `bun typecheck` (app-shell): não executado por esta fatia.
- `bun run check:guards --base origin/dev`: não executado por esta fatia.
- `bun run test:ci ...`: SUCCESS no run 44567897064, 6 pass / 0 fail / 32 expect calls.

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp02/hot-topics.test.ts","Sucafinav1/test/product/wp08/handoff.test.ts"]}
```
