# Missão63 — Operations e scanner: handoff terminal

## Estado para60 e S0

**Material entregue para revisão e composição; qualificação integral bloqueada.** O [PR draft78](https://github.com/gustavomhss/Orchestra-SF/pull/78) aponta `operations-scanner-proof` para `sf2-stack`. Não há liberação global nem declaração de cinco jornadas aprovadas ou ClamD real qualificado.

O pacote próprio contém a correção do adaptador ClamD, dois reparos dos auxiliares de browser, testes de protocolo, seleção explícita de ClamD real e configuração efêmera. Os defeitos compartilhados e as mudanças necessárias ao CI são entregues como patches completos e inertes, com preimage/postimage e hashes. Nenhum workflow, produtor compartilhado, regra financeira ou C12 foi alterado diretamente pela missão63.

## Identidades imutáveis

| Papel | Identidade |
| --- | --- |
| Planejamento | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Controle lido e reconciliado | `173c3507e40579f1a1a2dfb068bda40084a678bc` |
| Base do trabalho | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` |
| ACK63 anterior às alterações de produto | `4a8906bd638a51a95ff13b4c542f62ef7203f486` |
| W1: scanner e configuração | `e1791815218eea8e804d515bf197beeb9f8c8b56` |
| W2: material final próprio | `83aabd95ab423816002a623d1a998eb51bb89173` |
| Tree de W2 | `187cc50fc323e3a6958d4e4489cc124bfc26b302` |
| Último target observado | `faa30fddb7e7b61696b66fd069f51cf18c51125f` |
| Material C28 contido no target | `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, `HOLD_NOT_RUN` |

O commit que contém este handoff adiciona evidência sobre W2. Seu SHA/tree e o readback CAS são publicados externamente no PR e na resposta de entrega; não são inseridos no próprio commit.

## O que mudou e o que foi observado

O adaptador agora admite apenas a resposta completa `stream: OK` com terminador NUL exato, após EOF ordenado e após enfileirar localmente o upload e seu terminador. Rejeita cauda, duplicação, resposta truncada, delimitador incorreto e resposta prematura. O limite é explícito: enfileiramento local não prova consumo pelo daemon. O timeout anterior de30 segundos, endpoint loopback e enquadramento INSTREAM foram preservados.

O helper DOC usa o papel acessível `combobox` com nome exato `Risk rating`, mantendo a opção `Low`. No R4, essa interação e a criação do fornecedor retornaram sucesso; a jornada alcançou o upload e foi recusada no gate do scanner. O helper IMPORT observa imediatamente a rejeição dos waiters previamente registrados, devolvendo a mesma Promise original e mantendo todas as asserções. R4 preserva o erro primário403 e elimina a rejeição secundária ao encerrar a página.

Os cinco nomes originais, spec, oráculos,60.000ms por teste,10.000ms por expect, um worker, uma repetição e zero retries foram preservados.

## Resultados hospedados

| Rodada | W | S | Run / job | Resultado |
| --- | --- | --- | --- | --- |
| R1: sete auxiliares originais | `4a8906bd638a51a95ff13b4c542f62ef7203f486` | `f23937f385ceab4fb0d82d786e5243f5e81f875a` | [43666600846](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43666600846) /132667253684 | 7 PASS,0 FAIL,74 asserções |
| R2: cinco originais, diagnóstico inicial | `4a8906bd638a51a95ff13b4c542f62ef7203f486` | `98522c038cba67a2552890e9daf8898caf146c41` | [43666919712](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43666919712) /132668237542 | 1 PASS,4 FAIL |
| R3: adaptador, protocolo e sete auxiliares | `e1791815218eea8e804d515bf197beeb9f8c8b56` | `296b69cfe746fbac4639b9451f60563d5524fc29` | [43667752670](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667752670) /132670825592 | 22 PASS,0 FAIL,106 asserções |
| R4: cinco originais após os reparos próprios | `83aabd95ab423816002a623d1a998eb51bb89173` | `30bb3c1126163d40906d54aaeef9af3c3b956f4d` | [43668156670](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668156670) /132672057817 | 1 PASS,4 FAIL;0 skipped,0 flaky |

Cada S é filho direto de seu W e altera somente `.ci-run.json`. As árvores, requests, blobs e logs estão em `ci/R*-result.json` e `logs/`. Os artefatos de R2/R4 foram baixados via MCP, tiveram SHA256 conferido e forneceram os diagnósticos de trace. JSONs de execução e seleção estão preservados em `ci/R2/` e `ci/R4/`; os binários originais têm retenção Actions até22/11/2026. Os receipts não copiam cookies nem chaves de idempotência.

R3 compreende cinco testes anteriores do adaptador, dez casos adicionais de recusa e os sete auxiliares originais. Os peers adversariais desses testes são controles de protocolo; nunca são provisionados como scanner de Operations. R1/R3 registram Omni `not applicable`, sem prova de spawn. O log Playwright não contém veredicto positivo Omni; nenhuma paridade nativa é inferida.

### Cinco jornadas: resultado final observado no R4

| Jornada original | Estado e limite |
| --- | --- |
| OP-PROC-01 | PASS: comparação J04 e identidade/drilldown C02 conforme as asserções originais. Não fecha confirmação material C06. |
| OP-PROC-02 | FAIL: UI exibe `30240.000000000004 USD` em lugar de `30240 USD`. Patch de apresentação compartilhada pronto. |
| OP-PROC-03 | FAIL: mesma mensagem de FX aparece duas vezes na descrição acessível. Patch de limpeza de erro compartilhado pronto. |
| OP-IMPORT-01 | FAIL: `import-admit`403, corpo genérico `status: denied`. Sem scanner configurado, admissão bem-sucedida é impossível; o corpo não identifica qual gate privado recusou primeiro. Preview, Apply e recuperação permanecem não qualificados. |
| OP-DOC-01 | FAIL: upload422 com `The scanner did not accept this file.` em `prepareUpload`, antes da transação de upload. O adaptador está sem endpoint e recusa sem abrir conexão; isso não é invocação de ClamD real. Schema, confirmação e revogação permanecem não qualificados. |

`RESULTS-FINAL.json` preserva os251 critérios lidos de WP04/WP06, suas testemunhas parciais e todas as lacunas. Um caso aprovado não é usado para fechar o critério inteiro.

## Unidade completa para consumo

1. `owned/MANIFEST.json` e `owned/operations63-complete.patch`: todos os11 paths próprios de código/testes/setup/README, com preimages oficiais para os três arquivos existentes. A aplicação estática em árvore isolada reproduziu exatamente os11 postimages. Isso não é execução de produto.
2. `DEPENDENCY-CLOSURE.json`: base/tree completas, produtores e fixtures lidos, delta próprio, reconciliação C28 e impacto de W1 para W2.
3. `external/ci/MANIFEST.json`: patch completo para o workflow existente `test-ci.yml`, com ativação restrita a `ci-run-linux-operations63-*` e às seleções exatas. Mantém allowlist, permissões de leitura, comandos, controles e budgets.
4. `external/checks/MANIFEST.json` e `REQUEST-45.json`: patch mínimo para os scripts de typecheck app-shell/sf-e2e na lane existente de45; preserva os demais checks e guards. O workflow deve integrar o produto antes do snapshot que adiciona somente seu envelope.
5. `external/procurement-ui/MANIFEST.json`: dois patches completos, somente de apresentação, para `runtime/procurement.ts` e `src/screen-shell.ts`. S0/60 deve atribuir o owner exato; o título de runtime de59 não concede escrita ampla nesses arquivos.

### ClamD real preparado, ainda não executado

O pacote oficial ClamAV1.5.4 Linuxx86_64 é fixado por URL, tamanho e SHA256 em `tools.lock.json`, extraído com `dpkg-deb --extract` em `RUNNER_TEMP`, sem instalação global. FreshClam exige bases oficiais verificadas. Dois daemons loopback dão os controles de normalidade e erro; PIDs, executáveis, configurações, início e sockets são conferidos. As portas só são exportadas pelo setup após readiness. Cleanup limita a limpeza aos processos e diretórios daquela execução.

A seleção `real-clamd.check.ts` exige clean/EICAR/clean-after, erro real de tamanho e indisponibilidade após encerrar somente o daemon de erro verificado. **Todos esses testes live, instalação/relocação, download de bases, readiness e cleanup hospedados permanecem NOT_RUN.** Recursos indisponíveis devem falhar explicitamente. Não há banco sintético, endpoint alternativo, allowlist relaxada ou servidor sempre limpo.

## Próxima ação autorizada

O novo terminal de60 em `faa30fdd` declara `HANDOFF_TERMINAL_LEASE_ENDED`; não há sucessor automático. Este handoff é endereçado a60 conforme solicitado, com pedido de ACK de consumo. S0 precisa autorizar explicitamente uma retomada ou sucessão, seguida de novo ACK e CAS antes de qualquer escrita em `sf2-stack`.

O integrador autorizado deve conferir os preimages contra seu HEAD, aceitar e compor a unidade completa com os owners compartilhados, solicitar a45 os checks e a capacidade ClamD, e executar as seleções originais sobre o produto composto com novos W/S/run/job. O target C28 alterou dependências de autoridade/Collaboration/Review; nenhum resultado desta fonte é transferido a ele. O avanço seguinte `faa30fdd` adicionou apenas receipts e não justifica repetição técnica por si só.

Permanecem obrigatórios: os três controles ClamD reais; cinco jornadas completas; typecheck/guards; PDF digital, DOCX, texto e controles de formatos recusados; consumidores e invalidação material C06; AM01–AM06, permissões físicas/nativas, compreensão humana, oito seleções, revisões independentes e C/G7-D/G8. ClamD de uploads não substitui o scanner de segredos Atlas/AM05.

Solicita-se ACK que identifique autoridade/lease, SHA/tree fonte e commit de evidência aceitos, paths/blobs consumidos, decisões sobre patches compartilhados, candidato composto e resultados reais. **Nenhum ACK ou consumo é presumido.**

## Autoridade terminal

`AUTHORITY-FINAL.json` encerra `operations-scanner-browser63` quando publicado por CAS com parent W2. Depois desse marco não há continuação automática de escrita de produto. As quatro rodadas hospedadas estão encerradas; não há teste próprio em voo. `CONSUMER-RELEASE.json` libera o material para revisão e conserva o bloqueio de qualificação. `GLOBAL_RELEASE=false`.
