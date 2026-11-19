# Handoff — finish-units-20261119

SHA: 9b83967a8251430efd115645551bb9985ee2879b (último commit de código; este documento é o commit seguinte)
Data: 2026-11-19
Estado: partial

## Feito

- Corrigida a criação produtora de Hot Topics: o domínio salva a linha real, o guard de persistência reserva sua incarnation real e a correlação grava ID, incarnation e resultado na mesma transação. Arquivos: `product/dashboard/hot-topics.ts`, `product/collaboration/hot-topic-host.ts`, `product/integration/source-lifecycle.ts`, sob `modules/sucafina/Sucafinav1/`.
- O binder existe apenas enquanto o callback da persistência está ativo. Não aceita linha existente, metadados alterados, colisão de identidade, linha reservada modificada ou snapshot expirado. O guard ainda compara os metadados antes/depois; não há dispensa geral por WeakSet.
- A autorização final permanece depois de executar o domínio e antes do commit. O teste retira a admissão humana real nesse ponto e comprova rollback da linha, identidade e correlação.
- Testes usam o wrapper real de persistência de fontes e SQLite. Mantidos os casos de ABA, correlação antiga sem identidade e recusa segura quando o host não possui o seam atômico. Arquivos: `test/product/ui-split/ui-source/source-fixture.ts`, `source-identity.test.ts` e `test/product/wp08/hot-topic-host.test.ts`.
- Gate estreito: [test-ci 44562370162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44562370162), SUCCESS; job 135694822161; 9 testes passaram, 0 falharam, 105 expectativas. Código testado: `be7637b93be0462b440459788f16e41591e9d0cb`; commit de configuração: `1474197495de6c507b3e38c64f40e9c1d625d540`. A única mudança posterior de código, `9b83967`, explicita os tipos Snapshot/string do binder, sem alterar execução.
- O commit anterior `6dd5257b87023263380a3baf56947f9b06791f4e` elimina a declaração duplicada de nome em `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts`; essa fatia já foi incorporada separadamente à integração.
- PR 349/audit-one (`c4d35d42e22314ade57df76c1c19359c28a1c6bc`) e audit-one-tip (`dcdaa904af530dfd020b0454329f8e7808e3097f`) foram consultados somente para proveniência. Não foram importados restauração do console, alterações em application.ts nem a dispensa ampla de metadados de fontes.

## Pendente

- Finalizar a migração dos hosts unitários antigos de Hot Topics — `modules/sucafina/Sucafinav1/test/product/wp02/hot-topics.test.ts:18` — eles clonam Snapshot diretamente e não possuem o binder transacional real. Preservar criação/retry/CAS/completion ao conectar a persistência real.
- Microsoft: corrigir a referência ao manifesto histórico real e executar a fonte canônica atual — `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts:7` — o caminho atual não existe. O manifesto foi localizado em `docs/sf2h/receipts/integration/final-intake-55/source-outputs/microsoft49/integration/mission49-installation-manifest.json`, dentro do módulo; nenhuma receipt foi criada ou substituída.
- A migração dos testes que ainda exigem HTML legado e a qualificação dos oito shards SF seguem na próxima fatia. Este gate não qualifica os shards completos nem o go-live.
- A anotação de tipos pós-gate deve ser incluída no próximo typecheck da integração.

## Decisões e justificativas

- Asserções removidas: nenhuma. As novas expectativas verificam identidade, transação, replay, negação e rollback.
- Nenhum controle de console foi recriado. Nenhuma alteração em `runtime/application.ts`, workflows, suites, baseline, coverage ou receipt.
- O guard é a única autoridade que emite a incarnation. O port nunca inventa IDs físicos nem decide sucesso sem uma linha real.
- As verificações são executadas somente por GitHub Actions. Não houve execução local ou acesso à máquina do dono.

## Como retomar

1. Integrar/revisar a fatia de produção em `finish-units-20261119` no SHA de código acima.
2. Partir da integração atual em branch separada para a continuação Microsoft e hosts de testes; manter os arquivos de outros WPs fora da mudança.
3. Para repetir o gate desta fatia, criar atomicamente uma branch `ci-run-linux-*` apontando a commit que contém `.ci-run.json` com o JSON abaixo. A branch de trabalho não contém esse arquivo.
4. Depois dos gates estreitos das demais causas, o coordenador executa os guards e a qualificação final autorizada.

## Comandos e resultados

- `bun typecheck` (app-shell): não executado por esta fatia.
- `bun run check:guards --base origin/dev`: não executado por esta fatia.
- `bun run test:ci ...`: SUCCESS, run 44562370162, 9 pass / 0 fail / 105 expect calls.

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/ui-split/ui-source/source-identity.test.ts","Sucafinav1/test/product/wp08/hot-topic-host.test.ts"]}
```
