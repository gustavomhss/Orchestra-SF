# Preparação do go-live — G05, G06, G07, G08 e G10

**CAP03, jornadas nativas/F04, observador de restart, registro Microsoft, proveniência e agregador completo já estão integrados em dev. Os cinco gates finais continuam abertos.** Faltam a composição de produto qualificada, o candidato C/T confirmado, os ACKs originais, o tar verificado e as execuções nas reservas isoladas.

Observação desta edição: **22/11/2026 às 15:52:11 em America/Sao_Paulo (22/11/2026 às 18:52:11 UTC)**. Último dev observado: `b7776698e61934ed2cb820658408ff8a8207ec62`, árvore `364344c376a4feb35245d8089bde1941d025ebf9`. Essa identidade é uma composição entregue; **não é o candidato final aprovado**.

O [registro estruturado](status.json) contém dono, SHA/árvore, artefato, recibo e bloqueio por gate. O [registro de execução](execution-2026-11-22.md) conserva os resultados anteriores, inclusive tentativas negativas, e separa cada prova por fonte. O [runbook instalado de G08](g08-installed-execution.md) descreve a rota concreta entregue pela #698.

## Donos e mandato

| Recorte | Dono e responsabilidade |
| --- | --- |
| Integração e G05/G06/G07/G08/G10 | Astra go-live: preparação, integração revisada, coordenação e execução da frente |
| G01–G04 e pool | Writer `focal_migration`, [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673), preservado sob a coordenação |
| Release e G07 | Astra go-live, mandato de coordenação/execução já registrado em [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) e [#247](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7080852007); B vinculará C/T, ACKs e ator GitHub efetivo |
| UI42/UI43/UI44 e design | Frente existente [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613), ainda 12/15 áreas qualificadas |
| QA/Entra/host | Astra coordena; reserva, acesso operacional e contextos Microsoft originais ainda não confirmados |
| Recuperação/backup/chave/observador | Astra conduz o runbook; reserva, operadores do ambiente, chave utilizável e observador externo ainda não confirmados |
| Compras 222 (2) | Aceite4/4 preservado no QA original, sem transferência para outro candidato ou tar |
| #349, G09 e #588 | Permanecem com os responsáveis de suas frentes, conforme o mandato original |

A revisão técnica por assistentes e os COMMENTs da conta compartilhada são identificados como tal. Não representam aceite humano presumido. O papel `recovery` continua pertencendo a G10. A produção exige aprovação específica da janela e decisão go/no-go.

## Integrações recebidas nesta etapa

| Entrega | Merge em dev | Evidência da fonte qualificada |
| --- | --- | --- |
| [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693) — CAP03 reader/Client/factory | `70e3228cf2db` | [45051010616](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051010616): 67 Bun; controles de componente |
| [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691) — CAP03 UI e View source | `7e3e5e2bfd24` | [45050299263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050299263): 79 Bun; controles de componente |
| [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) — 50 jornadas nativas e F04 | `9804ee308485` | [45051200489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051200489): 40 Node + 25 Bun; controles de componente |
| [#697](https://github.com/gustavomhss/Orchestra-SF/pull/697) — Observador original de restart | `19fbe6542cdc` | [45052572893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052572893): 42 Node + 49 Python; controles de componente |
| [#700](https://github.com/gustavomhss/Orchestra-SF/pull/700) — Registro Microsoft e rota Edit | `327e95d552fa` | [45055263348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055263348): 40 Node + 42 Bun + 21 DOM; controles de componente |
| [#701](https://github.com/gustavomhss/Orchestra-SF/pull/701) — Origem dos produtores e autorização | `5cf8419032b5` | [45055493019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055493019): 128 Bun; controles de componente |
| [#699](https://github.com/gustavomhss/Orchestra-SF/pull/699) — Recusa JSON e lifecycle nativo | `47fa6b594ce9` | [45055028234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055028234): 40 Node + 54 Bun; controles de componente |
| [#698](https://github.com/gustavomhss/Orchestra-SF/pull/698) — Coordenador e agregador completo | `b7776698e619` | [45055970646](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055970646): 254 Node + 5 Bun; controles de componente |

A #699 foi entregue e integrada por seu writer existente. O readback confirmou seus hunks de runtime completos junto ao `Pick<NativeManifest, "target">` da #700; os outros24 blobs da #700 e o manifesto histórico v2 foram preservados. O merge da #698 não altera esses paths.

As contagens acima não devem ser somadas como prova de um candidato final. #691 foi qualificada numa composição explícita com o Client da #693. #698 foi qualificada com #700/#701 já integradas e também fez o parser real de proveniência validar seu YAML real. Nenhum desses runs executou a homologação instalada.

As entregas anteriores #665/#677/#685/#688/#689/#690/#692/#695 e seus recibos permanecem no ledger. As fronteiras HTTP já corrigidas, a política persistente corrente, Imports privados, decoder/checkpoint e a rota de release não são pendências de implementação.

## Estado por gate

| Gate | Dono | Entrega disponível | C/T, artefato e recibo finais | Bloqueio para fechamento |
| --- | --- | --- | --- | --- |
| [G05](g05-g06-controls.md) | Astra go-live | HTTP/SQLite reais, isolamento por Team, fronteiras Web e CAP03 readonly integrados; recibos de componente preservados | Nulos | Composição final e replay completo coverage/auth/effect/HTTP/isolamento no mesmo C/T |
| [G06](g05-g06-controls.md) | Astra go-live | ClamD real e16 casos selecionados no B4, Imports privados e política corrente integrados | Nulos | Reexecução completa no C/T final, com payloads, efeitos, armazenamento e cleanup observados |
| [G07](g07-linux-package.md) | Astra go-live | Verificador e rota #668 entregues: B distinto de C, dois ACKs antes do produtor, Q posterior | Nulos | C/T confirmado e ACKs; gerar e verificar o tar original com proveniência e identidade do operador vinculada |
| [G08](g08-teams-qa.md) | Astra go-live | Executor completo:99 obrigações em11 invocações, registro/observador/proveniência/agregador | Nulos | Mesmo tar G07 instalado, reserva acessível, Microsoft real, produtores completos e recibo agregado |
| [G10](g10-cutover-rollback.md) | Astra go-live | Backup/clone, decoder, política corrente de checkpoint/recovery e runbook entregues | Nulos | Reserva de recuperação, R retido, chave utilizável, observador e ensaio de backup/corte/retomada/rollback |

G08 exige **Teams 9 + U15(6) + U39(22) + U40(22) + F04(3) + AZ02(37)**. AZ02 conserva32 IDs históricos e cinco adições, em fases 16/14/2/2/2/1; não é uma suíte Playwright. F04 é Bun/HappyDOM em processo separado após o registro. Todas as99 obrigações permanecem **NOT_RUN na instalação**.

## Migração e design: últimas provas recebidas

A [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673) compôs dev19fbe e teardown no head `9612e7db0319c41ea0161e3924f332d9d76b0f9b`, T `b1dc4bdc3b4a73667e9ee8011667616565d2f9bc`. O [run 45055109181](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055109181) terminou com Decisions 3/5 (dois timeouts originais de 180 s) e dois diagnósticos na inclusão E2E: resultado de page.route incompatível com Promise<void> e declaração original de Window.api fora do tsconfig SF. A recepção independente conferiu os quatro ZIPs e delimitou os reparos para o writer da Migração. Os guards preservam47/69 avisos nas duas bases. #699/#700 não corrigem esses dois paths. Nenhum resultado parcial é promovido a ACK final.

**Operations 5/5 já foi recebido** no [focal45051170458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051170458), fonte bf1c680, conforme [recibo original](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7083227030). SF4 97/97, SF5 156/156 e SF8 140/140 do c9a9b0 continuam históricos. O pool 209/209 do diagnóstico não substitui o replay original sem overlay na composição final. Reports 11/11 continua restrito à fonte e aos consumidores em que foi produzido.

A [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) continua 12/15. O focal 255c35c6 recebeu 8/10; a correção exclusiva do driver de tipos passou 3/3 em [45054387720](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054387720), enquanto C17 / 105 s permanece aberto. O diagnóstico CPU [45054997790](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054997790) falhou, com cleanup SUCCESS, e publicou o artefato 14766639145. Sua metadata não qualifica o perfil ou o produto. A ausência de artefato registrada anteriormente pertence ao coletor cancelado 45045175421, preservado no histórico.

## Acesso operacional

A repetição somente leitura do [inventário 45036787201, tentativa 2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201/attempts/2), concluída às 15:49:43 em São Paulo, confirmou o bloqueio antes do login: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` e `AZURE_RESOURCE_GROUP` chegaram vazias no contexto `azure-mvp`. Login e comandos ARM ficaram SKIPPED. O artefato 14766939588 (876 bytes) foi adquirido e conferido; receipt `ee9d5d941754ae9da9804e2fa569ef89712a8aafa7ee7f64a4189b276dc02de5`. A tentativa 1 das 15:10UTC permanece histórica. A nova leitura de dispositivos também encontrou o Mac offline, visto pela última vez há110 h; não há acesso operacional estabelecido por esse canal.

| Entrada necessária | Responsabilidade pela disponibilização | Próxima ação da frente |
| --- | --- | --- |
| Configuração existente de Azure no contexto correto | Administrador do repositório/environment | Repetir inventário somente leitura e registrar os recursos realmente observados |
| Host/runner QA e contextos Microsoft | Operador do ambiente e responsável Entra | Registrar reserva e autorizações; executar os11 produtores originais de G08 |
| Host/clone de recuperação, backup/chave e observador | Responsáveis operacionais desses recursos | Executar G10 e medir RPO/RTO, mantendo o registro externo fora do restore |
| C/T e ACKs | Migração e Release, coordenadas por Astra | Admitir B e executar G05/G06/G07 na identidade final |
| Janela e decisão de produção | Gustavo | Decidir após receber os gates e seus recibos; a virada não foi autorizada |

O environment existir, uma label constar no workflow ou uma API de metadata retornar403/404 não prova reserva nem ausência de infraestrutura. Não houve mutação de host, concessão de grant ou instalação por esta frente.

## Sequência de fechamento

1. Receber a composição qualificada da Migração e as jornadas restantes de #613, com os respectivos recibos.
2. Confirmar o mesmo C/T com Migração e Release e registrar os ACKs originais; o operador efetivo fica vinculado em B.
3. Executar G05 e G06 completos nesse candidato.
4. Produzir o tar pela rota original e verificar G07, sem reconstrução entre gates.
5. Instalar os mesmos bytes nas reservas isoladas. **G08 e G10 podem avançar em paralelo** com processos, dados, sessões e callbacks separados.
6. Reunir os recibos finais e apresentar a decisão go/no-go e a janela proposta a Gustavo.

O estado permanece **0/5 gates finais; NOT_READY**. As implementações integradas e os recibos de preparação estão entregues. C/T final, tar, reservas confirmadas, provas instaladas e decisão de produção permanecem ausentes. O backlink de Compras 222 (2) continua pendente para qualquer vínculo além de seu QA original.
