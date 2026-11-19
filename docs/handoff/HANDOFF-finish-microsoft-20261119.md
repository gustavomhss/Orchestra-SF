# Handoff — finish-microsoft-20261119

SHA: 70c16bf749a9742566eb0ca51df2b83b8dc4f110 (último código; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Corrigido o ingresso Microsoft do primeiro membro por chamada ao produtor já existente `initializeConfiguredMicrosoftRoleMaps`, após a inicialização das fontes. Commit isolado `f29f74eb06920a9e5069e15d20057699d1975f01`; arquivo `modules/sucafina/Sucafinav1/local/entry.ts`. Os grupos vêm da configuração privada validada; a rotina não altera mapa já definido, inclusive `[]`. Não há novo papel, autenticador ou semeadura de roleMap na fixture.
- Corrigido o caminho real do manifesto histórico de integração Microsoft: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/final-intake-55/source-outputs/microsoft49/integration/mission49-installation-manifest.json` (blob `89d033326a26ed4c0674a85a5e2ba86a2799d36e`). O helper mantém a verificação SHA-256 e Git blob SHA-1 de cada preimage/postimage arquivado e executa os módulos canônicos do checkout atual. Nenhum artefato histórico foi refeito ou alterado.
- O fixture nativo usa `createSfHostRuntime`, `composeSfInstallation` e `createEmbeddedRoutes` originais. SQLite e Global usam suas implementações reais em diretórios privados do teste. PermissionSaved e ClaudeCodeAccount são fornecidos pelo grafo original conforme o SDK. Não há substituição de identidade, sessão, produtor, contexto ou concessões da resposta.
- Os testes preservam OIDC assinado, cookies seguros, transporte HTTPS explícito, proteção contra forwarded hints, CSRF, replay, logout, privacidade de trace, tenant oid, ownership, CAS, anti-spoof e download autorizado.
- Leituras migradas para as projeções reais CAP01/CAP08/CAP17/CAP24/CAP25. O primeiro membro acessa Dashboard, Planner e Procurement sem administrador inicial. Os testes verificam a autoria do bootstrap e a perda de acesso após revogação do grupo.
- Configuração privada dos testes: a entrada de principal para contexto não concede namespaces nem ações humanas. Os testes de Requests declaram somente `sf_request_read`, exigido pelo produtor real `product/procurement/queue-page.ts:34`. O controle sem concessão usa `grants: []`, prova o papel no autenticador real e prova a negação do produto.
- Gate [44567379453](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44567379453): SUCCESS, job 135712723930 e cleanup 135714403261; 12 testes passaram, 0 falharam, 225 expectativas, 4 arquivos. Código testado: `7913c9367cb629a529ef37ea347ec9e9b73c13eb`; configuração: `620ad91cabe27745831f6a59b52c2406c56a9078`.
- A única alteração de código depois desse gate foi `70c16bf`: a sequência completa de autores de audit agora é comparada com `["microsoft:installation-config", oid, other]`, preservando a detecção de eventos extras. Nenhum produtor ou fixture mudou depois do gate. Esse refinamento de asserção não teve uma nova rodada, conforme orientação do coordenador.

## Pendente

- Nenhuma causa funcional Microsoft permanece aberta nesta fatia. Os oito shards SF completos, guards e a integração final continuam sob coordenação; este gate qualifica somente os quatro arquivos abaixo.
- O refinamento de asserção pós-gate em `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts:139` entra na próxima qualificação da integração. Não se atribui o run anterior a um SHA diferente.
- A migração de hosts unitários Hot Topics é uma fatia separada, `finish-source-tests-20261119`, inicialmente em `test/product/wp02/hot-topics.test.ts:18` e `test/product/wp08/handoff.test.ts:24` (caminhos sob o módulo); não faz parte deste PR.

## Decisões e justificativas

- Asserções de negócio removidas sem substituição: nenhuma. O formato HTML e `data-page` do console descomissionado foram substituídos por status, capabilityId, principal, ações permitidas e dados das projeções JSON reais. GETs autenticados do console continuam explicitamente 404.
- A antiga expectativa de mapa ausente até o primeiro administrador não descreve o contrato do produtor de configuração já existente. Foi substituída por prova do viewer, origem auditada da configuração, negação de escrita e mudança de privilégio somente após mudança real de associação ao grupo.
- A negativa de leitura de um usuário autenticado sem papel usa 403 no contrato nativo; o POST produtor mantém sua negativa original. Sem sessão, a projeção responde 401. As asserções de propriedade, isolamento entre usuários, versão e estado não foram relaxadas.
- A proposta histórica de integration49 já foi integrada e evoluiu. O helper valida sua integridade arquivada e testa a fonte canônica atual; não carrega um postimage antigo para esconder mudanças do checkout.
- O boot do grafo foi separado nos hooks normais de setup. O limite de 5000 ms foi mantido, nenhuma asserção foi movida para fora da verificação e nenhum teste foi pulado.
- Nenhuma alteração em `runtime/application.ts`, suites, workflows, baseline, coverage ou receipts. Não houve execução local nem acesso à máquina do dono.

## Como retomar

1. Integrar `finish-microsoft-20261119` no SHA de código acima após revisão.
2. Prosseguir com as causas restantes do catálogo SF, mantendo essa fixture autenticada para as projeções nativas.
3. Caso uma regressão concreta exija repetir este gate, criar atomicamente uma branch `ci-run-linux-*` no commit com `.ci-run.json` abaixo. A branch de trabalho não contém esse arquivo.
4. Executar a qualificação final pelo coordenador depois de integrar as outras fatias; este handoff não declara GO.

## Comandos e resultados

- `bun typecheck` (app-shell): não executado por esta fatia.
- `bun run check:guards --base origin/dev`: não executado por esta fatia.
- `bun run test:ci ...`: SUCCESS no run 44567379453, 12 pass / 0 fail / 225 expect calls.
- Run [44564134730](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44564134730): FAILURE, 1 pass / 1 fail, antiga leitura HTML esperava 401 e recebeu 404.
- Run [44564811973](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44564811973): FAILURE, 1 pass / 1 fail; o comando produtor recebeu 401 apesar do login, expondo o inicializador Microsoft não conectado.
- Run [44566430880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566430880): FAILURE, 6 pass / 1 fail; first-login excedeu o limite ao incluir startup. Hooks de setup corrigidos, limite mantido; demais testes já passaram.
- Run [44567379453](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44567379453): SUCCESS, 12 pass / 0 fail.

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/microsoft-node.test.ts","Sucafinav1/test/microsoft-composition.test.ts","Sucafinav1/test/microsoft-first-login.test.ts","Sucafinav1/test/microsoft-routes.test.ts"]}
```
