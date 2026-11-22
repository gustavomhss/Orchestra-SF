# Registro de execução — frente go-live — 22/11/2026

**Este é um índice de provas observadas e integrações. Não é aprovação dos gates finais.** Os recibos originais permanecem nos artefatos de Actions. [status.json](status.json) distingue campos finais ainda nulos dos candidatos de trabalho abaixo.

Observação do consolidado: `2026-11-22T13:16:41Z`. Dev observado: `48768330ce2bdd6dc6673cd0b4926b61778e3bd4`, árvore `10787ab1c2d02d514b97184af2db7f53345fe66b`; referência de integração, não candidato final confirmado.

## Identidade das entregas

| Gate | Dono da entrega | Fonte testada | Árvore | PR / integração |
| --- | --- | --- | --- | --- |
| G05 | Astra go-live | `db896193346305fb1fee2d0d389cfc0b73077a01` | `027c26022afe0ef74ae61f40c21e8e5b0b3995c6` | [#637](https://github.com/gustavomhss/Orchestra-SF/pull/637) / `48768330ce2bdd6dc6673cd0b4926b61778e3bd4` |
| G06 | Astra go-live | `9a6b7323bb35463005c978af5257f4107f7e62d1` | `b189a570fd57ce9cc6a39c1c41dbb321de9cdb2d` | [#638](https://github.com/gustavomhss/Orchestra-SF/pull/638) / `babc660b2cda3e20ed6b68ecab86b973110652cb` |
| G07 | Astra go-live | `b7edac10a2e9bbe10fec6ec1318f568ccde74813` | `fa8734cdf99883488183b5ef423c48d608ba116e` | [#640](https://github.com/gustavomhss/Orchestra-SF/pull/640) / `f07690a41ccf090a39a76ce2733323a98c75c326` |
| G08 | Astra go-live | `aa928b6ae4a5944e5dad4b5bd206d5c123d2238e` | `36794c205023010cf43dc29d6856340f4ed325ea` | [#644](https://github.com/gustavomhss/Orchestra-SF/pull/644) / `ab54723003859c01251617716272ad7ebd834fb6` |
| G10 | Astra go-live | `f5b22050bbe04c228576dbe5ca1356cafbe1f431` | `28a6d7cd0cbecaf6d3f3d364c81cda1bca9ca5c0` | [#639](https://github.com/gustavomhss/Orchestra-SF/pull/639) / `e1ed546cac909208959f60734d601723d3101662` |

Os merges integram ferramentas e controles revisados. Migração e Release ainda não confirmaram um C/T final contendo essas entregas e G01–G04/pool. O estado de dev observado não substitui esse pin. Revisões independentes de assistentes foram registradas como comentários técnicos; não são uma aprovação formal por outra conta nem um aceite operacional dos donos.

## G05 — prova HTTP e Team

[Run 45024901473, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473), fonte `db896193346305fb1fee2d0d389cfc0b73077a01`. **Estado do replay: success, 5/5 jobs.** Coverage/auth/effect: 409/409 cada, zero fail/skip/missing/extra; Team: 11 controles/123 asserções; Server/Sucafina types e 78 guards aprovados.

| Bundle | Artefato | SHA-256 do ZIP |
| --- | --- | --- |
| effect | [14756065892](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14756065892) | `d12edf58b1ef8365cb0de9e3f8bcc9a3c8cffcc6a1b8bde2df33f1c3769bdf2e` |
| validation | [14755800231](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755800231) | `f622c6a7228de0d06281f914a78dcf30f4ecd161fb5bc9205df27f335eef3aa1` |
| teams | [14755382665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755382665) | `077c56778054225b2423cbeabb007a0c39e87dba3e2f4d533cd4c9e9e23eec74` |
| coverage | [14755013627](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755013627) | `693773f32f5cc2440a6388c0c1bbf31158b2f05815538cbd9cf8837592e1f4fe` |
| auth | [14754728044](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14754728044) | `b87ffb8edf45c698934bdd925d9baf82e9ce4db8aa90af14e7b962fc0d011fe6` |

Os cinco bundles foram baixados e conferidos por digest/tamanho. Foram verificados **39 hashes internos** (10 em coverage, 10 em auth, 10 em effect e 9 em Teams), além da identidade C/T/run/attempt, status, cleanup e logs de validação. Auth observou 819 requisições/respostas e peers do listener; effect observou 642, encerrou 409/409 listeners e registrou 4.789 spawns Omni/zero delegações; Teams observou 16/16 passagens pelo ingresso Microsoft. Coverage é catálogo: não afirma execução de HTTP.

Os recibos têm schemas `orchestra.g05.httpapi/1` e `orchestra.g05.team-http/1`, com `installedTeamsProof:false` e `finalCandidate:false`. A prova Teams usa a factory Microsoft com Entra/JWKS/Graph controlados. A limpeza recusa um global vazio e verifica ausência dos diretórios próprios antes do positivo. O PASS de `5c4cb48a…` no run 44999009678 é referência anterior; não é herdado por este head.

## G06 — scanner e aplicação reais

[Run 44998523282, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282), job 137134720749, success. Snapshot somente de requisição `a99d4c650c30ae6581d23c7463e1379757778348`; parent/fonte `9a6b7323bb35463005c978af5257f4107f7e62d1`.

| Campo | Evidência |
| --- | --- |
| Controles | 69 do admission/verificador; 8 reais em três arquivos, 218 asserções; zero falha/skip |
| Omni | 4 declarações, 5 spawns reais; sem delegação |
| Artefato | [14744986410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282/artifacts/14744986410), 25.740 bytes |
| ZIP SHA-256 | `71552dcaa03d1576c6e52047b3f2d6133eca7ebfad98ab931e6337df018bccc8` |
| receipt.json SHA-256 | `7b9098b2af0d097e2ccd9daae4ed75e7176b8a5fa782a577bc7d6f426dad657b` |
| JUnit SHA-256 | `b52e22d0a245c5a362cfa8419d9422d078125e658b63509a3e68797970f631bd` |
| Classe | `COMPONENT_REAL_CLAMD`; `installedTeamsProof:false` |

ZIP e 14 hashes internos conferidos independentemente. Os sete controles originais continuam presentes; o oitavo comprova formato inválido benigno e XLSX truncado, aceitos pelo scanner real e recusados no preview HTTP400/needs-input sem novo efeito durável depois do staging. Cleanup dos quatro fixtures e daemons próprios observado. A identidade privada é local de componente; o resultado não prova a instalação Teams final.

## G07 — verificador do tar original

[Run 44999252013](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999252013), job 137136940722, e [run 44999256028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999256028), job 137136954264: **31 controles Node, 18 Python e 78 guards sem findings**. Logs e steps conferidos. Qualificação do pacote **skipped**; nenhum recibo de tar final foi produzido.

A rota admite os dois ACKs reais antes do produtor, vincula C/T/operator/workflow/run/job/ZIP e verifica o tar original pelo instalador de C. Preserva `installation:null`, `g07Closed:false`, `productionCutover:false` até a prova instalada. Não altera o produtor G09 e não gera outro tar. [Rota e procedimento](g07-linux-package.md).

## G08 — executor privado, homologação ainda não executada

[Run 45003896381, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381): controls 137151128459 success; installed 137151129591 skipped. **84 controles Node, 28 Python, typecheck, import/list Playwright e 78 guards** aprovados.

| Campo | Evidência |
| --- | --- |
| Artefato | [14746898273](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381/artifacts/14746898273), 4.521 bytes |
| ZIP SHA-256 | `17c1d362a945b23c5b10a3c7c13bffd37ef78a61d49d42e7bbae5c09fc4474a8` |
| inventory.json SHA-256 | `a07736cc9d3467cbeafe71820e8f5524c0e407f71e332697bdb562874def71e4` |
| Recibo | `sf-g08-executor-inventory-v1`, `EXECUTOR_INVENTORY_VERIFIED` |
| Execução instalada | Nove casos `LISTED_NOT_RUN`; `installed:false`, `g08Closed:false` |

ZIP, inventário e listagem foram conferidos independentemente. O executor liga tar/manifesto/current/processo/factory/host/Caddy/HTTPS e observa as respostas das próprias ações de browser. Ele depende dos quatro contextos Microsoft originais e da reserva. Há bloqueio concreto nos contratos originais UI/admin do candidato inspecionado; os nove casos não substituem U15/U39/U40/F04/AZ02 nem toda a matriz. [Matriz e entradas](g08-teams-qa.md).

## G10 — backup e clone de arquivos

[Run 45024293423, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423), job 137213794907 success. **15 controles reais de arquivos/SQLite**, zero falha/skip, spawn-imports e 78 guards.

| Campo | Evidência |
| --- | --- |
| Artefato | [14755630213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423/artifacts/14755630213), 1.875 bytes |
| ZIP SHA-256 | `ba3531559a97f82f5a1533c5b2aaa5517aae03f566e9dad90ba052334fd27655` |
| receipt.json SHA-256 | `b6e5932bdc63d759480cfee9c01f6bf6e4d0d8373347839b4d7167917b064d02` |
| Recibo | `orchestra-sf.g10-component-tests.v1`, `FILESYSTEM_COMPONENT_CONTROLS` |
| Alcance | `installedTeamsProof:false`, `releaseQualified:false` |

ZIP e recibo conferidos independentemente. A revisão corrigiu o vínculo de backup pré-corte: observar R instalado sem exigir instalar C primeiro, preservando o destino C/T/tar de G07. O clone verifica os bytes numa VM diferente e não ativa serviço nem substitui dados vivos. Cerca de saída e credenciais desativadas são atestações da reserva a comprovar operacionalmente. Serviço parado/instalação são observações; drenagem é atestação do operador. Presença da chave não prova decriptação. Backup no host, corte, efeito pós-checkpoint, restart/retry e rollback permanecem **NOT_RUN**. [Runbook completo](g10-cutover-rollback.md).

## Dependências e decisão

- **Migração:** último run observado [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), fonte `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`, concluído em falha. Pool, SF4/SF5/SF8, UI operations/decisions e verify têm falhas. A investigação e integração seguem com a sessão proprietária.
- **Release:** ainda não há ACK atual de dono, C/T, rota produtora e toolchain. Os pedidos iniciais e as atualizações concretas [Migração/7079652837](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7079652837) e [Release/7079656702](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7079656702) permanecem sem ACK; uma solicitação não equivale a confirmação.
- **Ambientes:** não foi recebida reserva final de QA/G10 com host/Entra/grants/callbacks e observador externo. Esta frente não modificou um host instalado.
- **Compras 222 (2):** aceite 4/4 preservado no QA original, conforme o handoff. Backlink SHA/tar/reserva original ainda não recuperado. Não é reclassificado como falha nem promovido ao tar novo.
- **Outras frentes:** G01–G04/pool, #349, G09/#588 continuam com seus donos. A [#647](https://github.com/gustavomhss/Orchestra-SF/pull/647) registra a atualização técnica de G09; sua avaliação e decisão não são assumidas por esta frente.

Após o pin conjunto, repetir G05/G06 em C e produzir/verificar G07. Com o mesmo tar instalado, G08 e G10 avançam em paralelo nas reservas isoladas. Só então os recibos permitem avaliar o fechamento pedido. **Gates finais qualificados nesta frente: 0/5. Prontidão para go/no-go: NOT_READY.** A virada de produção depende de janela e decisão específicas; nenhuma foi executada.
